import { WALLET_CONNECTOR_PARTS } from '../customization';
import { getSafeImageUrl } from '../security';
import type { WalletAuthField, WalletAuthPrompt } from '../types';
import { getSafeExternalUrl } from '../utils';
import { createStaticView, getViewElement } from './dom';

export interface AuthPromptViewOptions {
  busy?: boolean;
  error?: string;
}

const AUTH_FIELD_TYPES = new Set<WalletAuthField['type']>(['text', 'email', 'tel', 'password']);

function isAuthField(value: WalletAuthField): boolean {
  return Boolean(
    value &&
    typeof value.name === 'string' &&
    value.name.trim() &&
    typeof value.label === 'string' &&
    value.label.trim() &&
    AUTH_FIELD_TYPES.has(value.type)
  );
}

function appendAuthField(form: HTMLFormElement, field: WalletAuthField, index: number): void {
  const fieldId = `auth-field-${index}`;
  const label = document.createElement('label');
  label.className = 'auth-prompt-field';
  label.htmlFor = fieldId;
  label.textContent = field.label;

  const input = document.createElement('input');
  input.id = fieldId;
  input.name = field.name;
  input.type = field.type;
  input.dataset.authField = '';
  if (field.autocomplete) input.setAttribute('autocomplete', field.autocomplete);
  if (field.inputMode) input.inputMode = field.inputMode;
  if (field.placeholder) input.placeholder = field.placeholder;

  label.append(input);
  form.append(label);
}

export function renderAuthPromptView(
  prompt: WalletAuthPrompt,
  options: AuthPromptViewOptions = {}
): DocumentFragment {
  const busy = options.busy ?? false;
  const view = createStaticView`
      <div class="header">
        <div class="header-with-back">
          <button class="back-button" id="auth-prompt-cancel-button" aria-label="Back">←</button>
          <h2 class="title" id="wallet-dialog-title"></h2>
        </div>
        <button class="close-button" aria-label="Close">×</button>
      </div>

      <div class="content auth-prompt-content">
        <div class="auth-prompt-view">
          <p class="auth-prompt-description" id="auth-prompt-description"></p>
          <div class="auth-prompt-link-container"></div>
          <div class="auth-prompt-qr-container"></div>
          <div class="auth-prompt-captcha" id="auth-prompt-captcha"></div>
          <form id="auth-prompt-form" novalidate></form>
          <p class="auth-prompt-error" id="auth-prompt-error" role="alert" aria-live="assertive"></p>
          <div class="auth-prompt-actions">
            <button class="error-button error-button-primary" id="auth-prompt-submit-button" type="submit"></button>
            <button class="error-button error-button-secondary" id="auth-prompt-secondary-button" type="button"></button>
          </div>
        </div>
      </div>
    `;

  getViewElement(view, '.close-button').setAttribute(
    'part',
    WALLET_CONNECTOR_PARTS.walletModal.closeButton
  );
  getViewElement<HTMLHeadingElement>(view, '#wallet-dialog-title').textContent =
    prompt.title.trim() || 'Authentication';

  const description = getViewElement(view, '#auth-prompt-description');
  if (prompt.description?.trim()) description.textContent = prompt.description;
  else description.remove();

  const linkContainer = getViewElement(view, '.auth-prompt-link-container');
  const safeUrl = getSafeExternalUrl(prompt.url);
  if (safeUrl) {
    const link = document.createElement('a');
    link.className = 'auth-prompt-link';
    link.href = safeUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open authentication page';
    linkContainer.append(link);
  }

  const qrContainer = getViewElement(view, '.auth-prompt-qr-container');
  const safeQrCode = getSafeImageUrl(prompt.qrCode);
  if (safeQrCode) {
    const image = document.createElement('img');
    image.className = 'auth-prompt-qr';
    image.src = safeQrCode;
    image.alt = 'Authentication QR code';
    qrContainer.append(image);
  }

  const form = getViewElement<HTMLFormElement>(view, '#auth-prompt-form');
  form.setAttribute('aria-busy', String(busy));
  for (const [index, field] of (prompt.fields ?? []).filter(isAuthField).entries()) {
    appendAuthField(form, field, index);
  }

  const submitButton = getViewElement<HTMLButtonElement>(view, '#auth-prompt-submit-button');
  if (prompt.submit) {
    submitButton.setAttribute('form', 'auth-prompt-form');
    submitButton.textContent = busy ? 'Submitting…' : prompt.submitLabel?.trim() || 'Continue';
    submitButton.disabled = busy;
  } else {
    submitButton.remove();
  }

  const secondaryButton = getViewElement<HTMLButtonElement>(view, '#auth-prompt-secondary-button');
  if (prompt.secondaryAction) {
    secondaryButton.textContent = prompt.secondaryAction.label;
    secondaryButton.disabled = busy;
  } else {
    secondaryButton.remove();
  }

  const error = getViewElement<HTMLElement>(view, '#auth-prompt-error');
  error.hidden = !options.error;
  if (options.error) error.textContent = options.error;

  return view;
}
