import Privy from '@privy-io/js-sdk-core';
import { PrivyMfaController } from '../../src/mfa';

const status = document.querySelector('output')!;
const confirm = document.querySelector<HTMLButtonElement>('#confirm')!;
const cancel = document.querySelector<HTMLButtonElement>('#cancel')!;
const base64url = (text: string) =>
  btoa(text).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const challenge = crypto.getRandomValues(new Uint8Array(32));
const expectedChallenge = base64url(String.fromCharCode(...challenge));
const token = [
  base64url(JSON.stringify({ alg: 'ES256' })),
  base64url(JSON.stringify({ sub: 'did:privy:fixture', exp: Math.floor(Date.now() / 1000) + 600 })),
  'fixture',
].join('.');
let credentialId: string;

// Keep the real SDK's message proxy, MFA retries and deferred lifecycle.
// Only the two external services (the iframe and option generation) are local.
const client = new Privy({
  appId: 'offline-mfa-test',
  storage: {
    get: (key) => (key === 'privy:pat' ? token : null),
    getKeys: () => [],
    put() {},
    del() {},
  },
});
client.mfa.passkey.generateAuthenticationOptions = async function () {
  if (this !== client.mfa.passkey) throw new Error('Lost Privy method receiver');
  return {
    options: {
      challenge: expectedChallenge,
      rp_id: location.hostname,
      user_verification: 'required',
      allow_credentials: [{ type: 'public-key', id: credentialId }],
    },
  };
};
client.setMessagePoster({
  reload() {},
  postMessage(message) {
    const { id, event, data } = JSON.parse(message);
    queueMicrotask(() => {
      if (event === 'privy:iframe:ready') {
        client.embeddedWallet.onMessage({ id, event, data: {} });
      } else if (event === 'privy:user-signer:sign') {
        if (
          !data.mfaCode ||
          document.querySelector<HTMLInputElement>('#reject-assertion')!.checked
        ) {
          client.embeddedWallet.onMessage({
            id,
            event,
            data: {},
            error: { type: 'missing_or_invalid_mfa', message: 'Passkey required' },
          });
          return;
        }
        const assertion = data.mfaCode;
        const signedData = JSON.parse(
          atob(assertion.response.client_data_json.replace(/-/g, '+').replace(/_/g, '/'))
        );
        if (
          data.mfaMethod !== 'passkey' ||
          data.relyingParty !== location.origin ||
          signedData.type !== 'webauthn.get' ||
          signedData.challenge !== expectedChallenge ||
          signedData.origin !== location.origin ||
          assertion.raw_id !== credentialId ||
          !assertion.response.signature ||
          !assertion.response.authenticator_data
        ) {
          throw new Error('Invalid MFA assertion');
        }
        client.embeddedWallet.onMessage({ id, event, data: { signature: 'verified-fixture' } });
      }
    });
  },
});

const mfa = new PrivyMfaController(
  'prompt',
  (prompt) => {
    cancel.hidden = confirm.hidden = !prompt;
    confirm.onclick = prompt ? () => void prompt.submit!({}) : null;
    cancel.onclick = prompt ? () => prompt.cancel() : null;
    return true;
  },
  () => location.origin
);
mfa.attach(client);
document.querySelector<HTMLButtonElement>('#register')!.onclick = async () => {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { id: location.hostname, name: 'Offline test' },
      user: { id: new Uint8Array([1]), name: 'tester', displayName: 'Tester' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    },
  });
  if (!credential) throw new Error('Virtual authenticator returned no credential');
  credentialId = credential.id;
  status.textContent = 'registered';
};
document.querySelector<HTMLButtonElement>('#sign')!.onclick = async () => {
  const invocation = mfa.beginInvocation();
  try {
    const result = await client.embeddedWallet.signWithUserSigner({ message: 'fixture' });
    status.textContent = result.signature;
  } catch (error) {
    status.textContent = (error as { reason?: string }).reason ?? String(error);
  } finally {
    mfa.finishInvocation(invocation);
  }
};
