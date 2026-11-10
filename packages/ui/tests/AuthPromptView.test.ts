import { describe, expect, it, vi } from 'vite-plus/test';
import {
  getAuthCodeLength,
  normalizeAuthCodeValue,
  renderAuthPromptView,
} from '../src/views/AuthPromptView';
import type { WalletAuthPrompt } from '../src/types';

const ICON = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E';

function mount(prompt: WalletAuthPrompt, options?: Parameters<typeof renderAuthPromptView>[1]) {
  const host = document.createElement('div');
  host.append(renderAuthPromptView(prompt, options));
  return host;
}

describe('renderAuthPromptView', () => {
  it('renders the centered prompt and OTP cells without unused resources', () => {
    const prompt: WalletAuthPrompt = {
      title: 'Enter confirmation code',
      icon: ICON,
      description: 'We sent a code to user@example.com.',
      fields: [
        {
          name: 'code',
          label: 'Verification code',
          type: 'text',
          inputMode: 'numeric',
          autocomplete: 'one-time-code',
          codeLength: 6,
        },
      ],
      submitLabel: 'Verify',
      submit: vi.fn(),
      secondaryAction: {
        label: 'Resend code',
        description: "Didn't get an email?",
        run: vi.fn(),
      },
      cancel: vi.fn(),
    };
    const host = mount(prompt);

    expect(host.querySelector('#wallet-dialog-title')?.textContent).toBe('Enter confirmation code');
    expect(host.querySelector('.auth-prompt-icon')?.getAttribute('src')).toBe(ICON);
    expect(host.querySelector('.auth-prompt-description')?.textContent).toBe(
      'We sent a code to user@example.com.'
    );
    expect(host.querySelectorAll('.auth-prompt-code-cell')).toHaveLength(6);
    const input = host.querySelector<HTMLInputElement>('input[name="code"]');
    expect(input?.dataset.authField).toBe('');
    expect(input?.getAttribute('autocomplete')).toBe('one-time-code');
    expect(input?.getAttribute('inputmode')).toBe('numeric');
    expect(input?.getAttribute('maxlength')).toBe('6');
    expect(host.querySelector('.auth-prompt-secondary-description')?.textContent).toBe(
      "Didn't get an email?"
    );
    expect(host.querySelector('.auth-prompt-link')).toBeNull();
    expect(host.querySelector('.auth-prompt-qr-container')).toBeNull();
    expect(host.querySelector('.auth-prompt-captcha')).toBeNull();
    expect(input?.getAttribute('value')).toBeNull();
  });

  it('keeps populated URL, QR, and CAPTCHA resources conditional', () => {
    const prompt: WalletAuthPrompt = {
      title: 'Authenticate',
      description: 'Follow the instructions.',
      url: 'https://example.test/auth',
      qrCode: 'farcaster://connect?uri=https%3A%2F%2Fexample.test%2Fauth',
      captcha: { provider: 'turnstile', siteKey: 'site-key' },
      cancel: vi.fn(),
    };
    const host = mount(prompt);

    expect(host.querySelector('.auth-prompt-link')).not.toBeNull();
    expect(host.querySelector('.auth-prompt-qr-container')).not.toBeNull();
    expect(host.querySelector('.auth-prompt-captcha')).not.toBeNull();
  });

  it('normalizes pasted and typed digits while retaining leading zeros and caret focus', () => {
    const onValueChange = vi.fn();
    const prompt: WalletAuthPrompt = {
      title: 'Verify',
      fields: [
        {
          name: 'code',
          label: 'Code',
          type: 'text',
          inputMode: 'numeric',
          codeLength: 6,
        },
      ],
      cancel: vi.fn(),
    };
    const host = mount(prompt, { onValueChange });
    const input = host.querySelector<HTMLInputElement>('input[name="code"]')!;
    input.value = '０a1-2';
    input.setSelectionRange(3, 3);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.value).toBe('012');
    expect(onValueChange).toHaveBeenLastCalledWith('code', '012');
    expect(
      [...host.querySelectorAll('.auth-prompt-code-cell')].map((cell) => cell.textContent)
    ).toEqual(['0', '1', '2', '', '', '']);

    input.value = '12a34';
    input.setSelectionRange(3, 3);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.value).toBe('1234');
    expect(input.selectionStart).toBe(2);
    input.value = `${input.value.slice(0, 2)}9${input.value.slice(2)}`;
    input.setSelectionRange(3, 3);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.value).toBe('12934');
    expect(input.selectionStart).toBe(3);

    input.value = '012';
    input.setSelectionRange(3, 3);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.setSelectionRange(1, 1);
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', {
      value: { getData: () => '9x8765' },
    });
    input.dispatchEvent(paste);
    expect(input.value).toBe('098765');
    expect(input.selectionStart).toBe(6);
    expect(input.selectionEnd).toBe(6);

    input.setSelectionRange(2, 2);
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft' }));
    expect(host.querySelectorAll('.auth-prompt-code-cell--active')).toHaveLength(1);
    expect(
      host
        .querySelectorAll('.auth-prompt-code-cell')[2]
        ?.classList.contains('auth-prompt-code-cell--active')
    ).toBe(true);
  });

  it('maps pointer clicks to visual cells so an existing digit can be replaced', () => {
    const host = mount({
      title: 'Verify',
      fields: [
        {
          name: 'code',
          label: 'Code',
          type: 'text',
          inputMode: 'numeric',
          codeLength: 6,
        },
      ],
      cancel: vi.fn(),
    });
    const input = host.querySelector<HTMLInputElement>('input[name="code"]')!;
    const wrapper = host.querySelector<HTMLElement>('.auth-prompt-code-input-wrapper')!;
    vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 600,
      bottom: 52,
      width: 600,
      height: 52,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    input.value = '123456';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 350 }));
    expect(input.selectionStart).toBe(3);
    expect(input.selectionEnd).toBe(4);
    input.value = `${input.value.slice(0, 3)}9${input.value.slice(4)}`;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.value).toBe('123956');
  });

  it('falls back to a regular text field for invalid code lengths', () => {
    const field = {
      name: 'code',
      label: 'Code',
      type: 'text' as const,
      inputMode: 'numeric' as const,
      codeLength: 3,
    };
    expect(getAuthCodeLength(field)).toBeNull();
    expect(normalizeAuthCodeValue('０a1-2')).toBe('012');
    const host = mount({ title: 'Verify', fields: [field], cancel: vi.fn() });
    expect(host.querySelectorAll('.auth-prompt-code-cell')).toHaveLength(0);
    expect(host.querySelector('input[name="code"]')).not.toBeNull();
  });
});
