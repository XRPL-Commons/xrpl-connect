import { describe, expect, it, vi } from 'vite-plus/test';
import { PrivyMfaController } from '../src/mfa';

type Deferred = {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

function deferred(): Deferred {
  return { resolve: vi.fn(), reject: vi.fn() };
}

function credential(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const bytes = new Uint8Array([1, 2, 3]).buffer;
  return {
    id: 'credential-id',
    rawId: bytes,
    type: 'public-key',
    response: {
      clientDataJSON: bytes,
      authenticatorData: bytes,
      signature: bytes,
      userHandle: null,
      ...overrides,
    },
    getClientExtensionResults: () => ({}),
  };
}

function clientFixture() {
  let listener: (() => void) | undefined;
  const rootPromise = { current: null as Deferred | null };
  const passkey = {
    generateRegistrationOptions: vi.fn(function (this: unknown, relyingParty?: string) {
      expect(this).toBe(passkey);
      return Promise.resolve({
        options: {
          challenge: 'AQI',
          rp: { name: 'Wallet', id: 'wallet.example' },
          user: { id: 'AwQ', name: 'user@example.com', display_name: 'User' },
          pub_key_cred_params: [{ alg: -7 }],
          relying_party: relyingParty,
        },
      });
    }),
    linkWithPasskey: vi.fn(function (this: unknown, response: unknown, relyingParty?: string) {
      expect(this).toBe(passkey);
      expect(relyingParty).toBe('https://wallet.example');
      expect(response).toMatchObject({ id: 'credential-id', type: 'public-key' });
      return Promise.resolve({});
    }),
  };
  const mfaPasskey = {
    generateAuthenticationOptions: vi.fn(function (this: unknown, args: Record<string, unknown>) {
      expect(this).toBe(mfaPasskey);
      expect(args).toEqual({ relying_party: 'https://wallet.example' });
      return Promise.resolve({
        options: {
          challenge: 'AQI',
          rp_id: 'wallet.example',
          user_verification: 'required',
        },
      });
    }),
  };
  const client = {
    auth: { passkey },
    mfa: {
      passkey: mfaPasskey,
      submitEnrollMfa: vi.fn().mockResolvedValue(undefined),
    },
    user: {
      get: vi.fn().mockResolvedValue({
        user: {
          linked_accounts: [{ type: 'passkey', credential_id: 'credential-id' }],
          mfa_methods: [{ type: 'passkey' }],
        },
      }),
    },
    mfaPromises: {
      rootPromise,
      on: vi.fn((_event: 'mfaRequired', callback: () => void) => {
        listener = callback;
      }),
      off: vi.fn(),
    },
  };
  return {
    client,
    rootPromise,
    emitMfaRequired(): void {
      if (!listener) throw new Error('MFA listener was not attached');
      listener();
    },
  };
}

describe('Privy transaction MFA', () => {
  it('captures the deferred assigned after js-sdk-core emits and preserves method receivers', async () => {
    const fixture = clientFixture();
    const prompts: Array<Record<string, unknown> | null> = [];
    const controller = new PrivyMfaController(
      'prompt',
      (prompt) => {
        prompts.push(prompt as Record<string, unknown> | null);
        return true;
      },
      () => 'https://wallet.example',
      1_000
    );
    controller.attach(fixture.client);

    const challenge = deferred();
    fixture.emitMfaRequired();
    // The pinned SDK emits before assigning rootPromise.current.
    fixture.rootPromise.current = challenge;

    await vi.waitFor(() => expect(prompts.some((prompt) => prompt !== null)).toBe(true));
    const prompt = prompts[0];
    expect(prompt?.kind).toBe('mfa');
    const get = vi.fn().mockResolvedValue(credential());
    vi.stubGlobal('navigator', { credentials: { get } });
    await (prompt?.submit as ((values: Record<string, string>) => Promise<void>))({});

    await vi.waitFor(() =>
      expect(challenge.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          mfaMethod: 'passkey',
          relyingParty: 'https://wallet.example',
          mfaCode: expect.objectContaining({
            raw_id: 'AQID',
            response: expect.objectContaining({ client_data_json: 'AQID' }),
          }),
        })
      )
    );
    expect(get).toHaveBeenCalledWith(
      expect.objectContaining({
        publicKey: expect.objectContaining({
          challenge: expect.any(Uint8Array),
          rpId: 'wallet.example',
        }),
      })
    );
    // A bad assertion makes js-sdk-core install a replacement root deferred
    // without another event; the enclosing request must be able to reject it.
    const retry = deferred();
    fixture.rootPromise.current = retry;
    controller.cancelActive();
    expect(retry.reject).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'mfa_timeout' })
    );
    vi.unstubAllGlobals();
  });

  it('rejects the SDK deferred and aborts native WebAuthn when the prompt is cancelled', async () => {
    const fixture = clientFixture();
    const prompts: Array<Record<string, unknown> | null> = [];
    const controller = new PrivyMfaController(
      'prompt',
      (prompt) => {
        prompts.push(prompt as Record<string, unknown> | null);
        return true;
      },
      () => 'https://wallet.example',
      1_000
    );
    controller.attach(fixture.client);
    const challenge = deferred();
    fixture.emitMfaRequired();
    fixture.rootPromise.current = challenge;
    await vi.waitFor(() => expect(prompts).toHaveLength(1));

    let nativeSignal: AbortSignal | undefined;
    const get = vi.fn(({ signal }: { signal?: AbortSignal }) => {
      nativeSignal = signal;
      return new Promise<never>(() => undefined);
    });
    vi.stubGlobal('navigator', { credentials: { get } });
    const submitting = (prompts[0]?.submit as (values: Record<string, string>) => Promise<void>)({});
    await vi.waitFor(() => expect(get).toHaveBeenCalled());
    (prompts[0]?.cancel as () => void)();
    await submitting;

    expect(nativeSignal?.aborted).toBe(true);
    await vi.waitFor(() =>
      expect(challenge.reject).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'mfa_cancelled' })
      )
    );
    vi.unstubAllGlobals();
  });

  it('reports a bounded prompt timeout separately from user cancellation', async () => {
    const fixture = clientFixture();
    const prompts: Array<Record<string, unknown> | null> = [];
    const controller = new PrivyMfaController(
      'prompt',
      (prompt) => {
        prompts.push(prompt as Record<string, unknown> | null);
        return true;
      },
      () => 'https://wallet.example',
      20
    );
    controller.attach(fixture.client);
    const challenge = deferred();
    fixture.emitMfaRequired();
    fixture.rootPromise.current = challenge;
    await vi.waitFor(() => expect(prompts.some((prompt) => prompt !== null)).toBe(true));
    await vi.waitFor(() =>
      expect(challenge.reject).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'mfa_timeout' })
      )
    );
  });

  it('fails closed without a prompt subscriber and supports link/enroll/status', async () => {
    const fixture = clientFixture();
    const controller = new PrivyMfaController(
      'none',
      () => false,
      () => 'https://wallet.example',
      1_000
    );
    controller.attach(fixture.client);
    const challenge = deferred();
    fixture.emitMfaRequired();
    fixture.rootPromise.current = challenge;
    await vi.waitFor(() =>
      expect(challenge.reject).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'mfa_required' })
      )
    );

    const create = vi.fn().mockResolvedValue(
      credential({ attestationObject: new Uint8Array([4, 5, 6]).buffer })
    );
    const linked = await controller.linkPasskey({ credentials: { create } });
    expect(linked.credentialId).toBe('credential-id');
    expect(create).toHaveBeenCalledOnce();
    const status = await controller.status();
    expect(status).toEqual({ credentialIds: ['credential-id'], enrolled: true });
    await expect(controller.enrollPasskey()).resolves.toEqual(status);
    expect(fixture.client.mfa.submitEnrollMfa).toHaveBeenCalledWith({
      method: 'passkey',
      credentialIds: ['credential-id'],
    });
  });
});
