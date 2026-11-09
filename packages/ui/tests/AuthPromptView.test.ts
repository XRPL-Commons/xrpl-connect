import { describe, expect, it, vi } from 'vite-plus/test';
import { renderAuthPromptView } from '../src/views/AuthPromptView';
import type { WalletAuthPrompt } from '../src/types';

describe('renderAuthPromptView', () => {
  it('renders typed fields without exposing callbacks or unsafe resources', () => {
    const prompt: WalletAuthPrompt = {
      title: 'Verify account',
      description: 'Enter the code sent to you.',
      fields: [
        {
          name: 'code',
          label: 'Verification code',
          type: 'text',
          inputMode: 'numeric',
          autocomplete: 'one-time-code',
        },
      ],
      url: 'javascript:alert(1)',
      qrCode: 'farcaster://connect?uri=https%3A%2F%2Fexample.test%2Fauth',
      submit: vi.fn(),
      cancel: vi.fn(),
    };
    const host = document.createElement('div');
    host.append(renderAuthPromptView(prompt));

    expect(host.querySelector('#wallet-dialog-title')?.textContent).toBe('Verify account');
    expect(host.querySelector('input[name="code"]')?.getAttribute('autocomplete')).toBe(
      'one-time-code'
    );
    expect(host.querySelector('input[name="code"]')?.getAttribute('inputmode')).toBe('numeric');
    expect(host.querySelector('a')).toBeNull();
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('.auth-prompt-qr-container')?.textContent).toContain(
      'Loading QR code'
    );
    expect(host.querySelector('[data-auth-field]')?.getAttribute('value')).toBeNull();
    expect(host.querySelector('[data-auth-field]')?.getAttribute('data-callback')).toBeNull();
  });
});
