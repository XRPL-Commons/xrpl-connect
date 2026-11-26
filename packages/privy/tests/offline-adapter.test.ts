// @vitest-environment node
import { describe, expect, it, vi } from 'vite-plus/test';
import { decode, encodeForSigning, verifyKeypairSignature } from 'xrpl';
import { MemoryStorageAdapter, WalletManager, type WalletAuthPrompt } from 'xrpl-connect/core';
import { MockPrivyAdapter } from '../src/testing';

describe('offline Privy adapter', () => {
  it('restores twice through one manager and signs the exact reviewed transaction offline', async () => {
    const storage = new MemoryStorageAdapter();
    const privateKey = new Uint8Array(32).fill(1);
    const first = new WalletManager({ storage, adapters: [new MockPrivyAdapter({ privateKey })] });
    const account = await first.connect('privy');
    const adapter = new MockPrivyAdapter({ privateKey });
    const restored = new WalletManager({ storage, adapters: [adapter] });
    const connect = vi.spyOn(adapter, 'connect');
    await expect(Promise.all([restored.reconnect(), restored.reconnect()])).resolves.toEqual([
      account,
      account,
    ]);
    expect(connect).toHaveBeenCalledOnce();
    let prompt: WalletAuthPrompt | null = null;
    adapter.onAuthPrompt((value) => {
      prompt = value;
    });
    const tx = {
      TransactionType: 'AccountSet',
      Account: account.address,
      Fee: '12',
      Sequence: 1,
    } as const;
    const signing = restored.sign(tx);
    await vi.waitFor(() => expect(prompt?.review?.transaction).toMatchObject(tx));
    await prompt!.submit!({});
    const result = await signing;
    const signed = decode(result.tx_blob!);
    expect(
      verifyKeypairSignature(encodeForSigning(signed), signed.TxnSignature!, account.publicKey!)
    ).toBe(true);
    await expect(restored.signAndSubmit(tx)).rejects.toMatchObject({ code: 'UNSUPPORTED_METHOD' });
    await expect(
      restored.sign({ TransactionType: 'AccountSet', Account: account.address })
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_METHOD' });
    await restored.disconnect();
  });

  it('handles an offline OTP including retry and cancellation', async () => {
    const adapter = new MockPrivyAdapter();
    const manager = new WalletManager({ adapters: [adapter], storage: new MemoryStorageAdapter() });
    let prompt: WalletAuthPrompt | null = null;
    adapter.onAuthPrompt((value) => {
      prompt = value;
    });
    const login = manager.connect('privy', { loginMethod: 'email' });
    await vi.waitFor(() => expect(prompt?.submit).toBeTypeOf('function'));
    await expect(prompt!.submit!({ code: '111111' })).rejects.toThrow('000000');
    await prompt!.submit!({ code: '000000' });
    await expect(login).resolves.toMatchObject({ publicKey: expect.any(String) });
    await manager.disconnect();
    const cancelled = manager.connect('privy', { loginMethod: 'email' });
    await vi.waitFor(() => expect(prompt?.cancel).toBeTypeOf('function'));
    prompt!.cancel();
    await expect(cancelled).rejects.toMatchObject({ code: 'CONNECTION_REJECTED' });
  });
});
