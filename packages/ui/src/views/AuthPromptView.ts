import { WALLET_CONNECTOR_PARTS } from '../customization';
import type { WalletAuthField, WalletAuthPrompt } from '../types';
import { getSafeExternalUrl } from '../utils';
import { createStaticView, createWalletImage, getViewElement } from './dom';

export interface AuthPromptViewOptions {
  busy?: boolean;
  error?: string;
  values?: Readonly<Record<string, string>>;
  onValueChange?: (name: string, value: string) => void;
}

const AUTH_FIELD_TYPES = new Set<WalletAuthField['type']>(['text', 'email', 'tel', 'password']);

/** Return the configured OTP length when a field is a supported numeric code field. */
export function getAuthCodeLength(field: WalletAuthField): number | null {
  if (field.type !== 'text' || field.inputMode !== 'numeric') return null;
  if (
    typeof field.codeLength !== 'number' ||
    !Number.isInteger(field.codeLength) ||
    field.codeLength < 4 ||
    field.codeLength > 12
  ) {
    return null;
  }
  return field.codeLength;
}

/** Keep only ASCII decimal digits after normalizing compatible Unicode forms. */
export function normalizeAuthCodeValue(value: string): string {
  return value.normalize('NFKC').replace(/[^0-9]/g, '');
}

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

function getInitialValue(
  values: Readonly<Record<string, string>> | undefined,
  name: string
): string {
  const value = values?.[name];
  return typeof value === 'string' ? value : '';
}

function appendRegularAuthField(
  form: HTMLFormElement,
  field: WalletAuthField,
  index: number,
  options: AuthPromptViewOptions
): void {
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
  input.disabled = options.busy ?? false;
  input.value = getInitialValue(options.values, field.name);
  if (field.autocomplete) input.setAttribute('autocomplete', field.autocomplete);
  if (field.inputMode) input.inputMode = field.inputMode;
  if (field.placeholder) input.placeholder = field.placeholder;
  input.addEventListener('input', () => options.onValueChange?.(field.name, input.value));

  label.append(input);
  form.append(label);
}

function appendCodeAuthField(
  form: HTMLFormElement,
  field: WalletAuthField,
  index: number,
  codeLength: number,
  options: AuthPromptViewOptions
): void {
  const fieldId = `auth-field-${index}`;
  const label = document.createElement('label');
  label.className = 'auth-prompt-field auth-prompt-code-field';
  label.htmlFor = fieldId;

  const labelText = document.createElement('span');
  labelText.className = 'auth-prompt-field-label';
  labelText.textContent = field.label;

  const inputWrapper = document.createElement('span');
  inputWrapper.className = 'auth-prompt-code-input-wrapper';
  inputWrapper.style.setProperty('--auth-code-length', String(codeLength));

  const cells = document.createElement('span');
  cells.className = 'auth-prompt-code-cells';
  cells.setAttribute('aria-hidden', 'true');
  const cellElements: HTMLSpanElement[] = [];
  for (let cellIndex = 0; cellIndex < codeLength; cellIndex += 1) {
    const cell = document.createElement('span');
    cell.className = 'auth-prompt-code-cell';
    cellElements.push(cell);
    cells.append(cell);
  }

  const input = document.createElement('input');
  input.id = fieldId;
  input.name = field.name;
  input.type = 'text';
  input.className = 'auth-prompt-code-input';
  input.dataset.authField = '';
  input.dataset.authCode = '';
  input.autocomplete = 'one-time-code';
  input.inputMode = 'numeric';
  input.pattern = '[0-9]*';
  input.maxLength = codeLength;
  input.spellcheck = false;
  input.disabled = options.busy ?? false;
  input.placeholder = field.placeholder ?? '';

  const renderCells = (value: string, cursor = value.length): void => {
    const activeIndex = Math.min(Math.max(cursor, 0), codeLength - 1);
    for (const [cellIndex, cell] of cellElements.entries()) {
      cell.textContent = value[cellIndex] ?? '';
      cell.classList.toggle('auth-prompt-code-cell--filled', cellIndex < value.length);
      cell.classList.toggle('auth-prompt-code-cell--active', cellIndex === activeIndex);
    }
  };

  const setValue = (value: string, notify = true, cursor?: number): void => {
    const next = normalizeAuthCodeValue(value).slice(0, codeLength);
    const rawCursor = cursor ?? input.selectionStart ?? value.length;
    const nextCursor = Math.min(
      cursor ?? normalizeAuthCodeValue(value.slice(0, rawCursor)).length,
      next.length
    );
    if (input.value !== next) input.value = next;
    if (input.selectionStart !== nextCursor || input.selectionEnd !== nextCursor) {
      input.setSelectionRange(nextCursor, nextCursor);
    }
    renderCells(next, nextCursor);
    if (notify) options.onValueChange?.(field.name, next);
  };

  const initialValue = getInitialValue(options.values, field.name);
  setValue(initialValue, false, normalizeAuthCodeValue(initialValue).length);
  input.addEventListener('input', () => setValue(input.value));
  input.addEventListener('paste', (event: ClipboardEvent) => {
    event.preventDefault();
    const pasted = normalizeAuthCodeValue(event.clipboardData?.getData('text') ?? '');
    const current = normalizeAuthCodeValue(input.value).slice(0, codeLength);
    const start = Math.min(input.selectionStart ?? current.length, current.length);
    const end = Math.min(input.selectionEnd ?? start, current.length);
    const next = `${current.slice(0, start)}${pasted}${current.slice(end)}`.slice(0, codeLength);
    const caret = Math.min(start + pasted.length, codeLength);
    setValue(next, true, caret);
    input.setSelectionRange(caret, caret);
  });
  input.addEventListener('pointerdown', (event: PointerEvent) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey) return;
    const bounds = inputWrapper.getBoundingClientRect();
    if (!bounds.width) return;
    const cellIndex = Math.min(
      codeLength - 1,
      Math.max(0, Math.floor(((event.clientX - bounds.left) / bounds.width) * codeLength))
    );
    const current = normalizeAuthCodeValue(input.value).slice(0, codeLength);
    const start = Math.min(cellIndex, current.length);
    const end = current.length > cellIndex ? start + 1 : start;
    event.preventDefault();
    input.focus({ preventScroll: true });
    input.setSelectionRange(start, end);
    renderCells(current, start);
  });
  const updateActiveCell = (): void => {
    renderCells(input.value, input.selectionStart ?? input.value.length);
  };
  input.addEventListener('select', updateActiveCell);
  input.addEventListener('keyup', updateActiveCell);
  input.addEventListener('click', updateActiveCell);

  inputWrapper.append(cells, input);
  label.append(labelText, inputWrapper);
  form.append(label);
}

function appendAuthField(
  form: HTMLFormElement,
  field: WalletAuthField,
  index: number,
  options: AuthPromptViewOptions
): void {
  const codeLength = getAuthCodeLength(field);
  if (codeLength === null) appendRegularAuthField(form, field, index, options);
  else appendCodeAuthField(form, field, index, codeLength, options);
}

export function renderAuthPromptView(
  prompt: WalletAuthPrompt,
  options: AuthPromptViewOptions = {}
): DocumentFragment {
  const busy = options.busy ?? false;
  const view = createStaticView`
      <div class="header auth-prompt-header">
        <button class="back-button" id="auth-prompt-cancel-button" aria-label="Back">←</button>
        <span class="auth-prompt-header-spacer" aria-hidden="true"></span>
        <button class="close-button" aria-label="Close">×</button>
      </div>

      <div class="content auth-prompt-content">
        <div class="auth-prompt-view">
          <h2 class="auth-prompt-title" id="wallet-dialog-title"></h2>
          <p class="auth-prompt-description" id="auth-prompt-description"></p>
          <form id="auth-prompt-form" novalidate></form>
          <p class="auth-prompt-error" id="auth-prompt-error" role="alert" aria-live="assertive"></p>
          <div class="auth-prompt-actions">
            <button class="error-button error-button-primary" id="auth-prompt-submit-button" type="submit"></button>
          </div>
          <div class="auth-prompt-secondary-action">
            <p class="auth-prompt-secondary-description"></p>
            <button class="auth-prompt-secondary-button" id="auth-prompt-secondary-button" type="button"></button>
          </div>
        </div>
      </div>
    `;

  getViewElement(view, '.close-button').setAttribute(
    'part',
    WALLET_CONNECTOR_PARTS.walletModal.closeButton
  );
  const title = prompt.title.trim() || 'Authentication';
  getViewElement<HTMLHeadingElement>(view, '#wallet-dialog-title').textContent = title;

  const icon = createWalletImage(prompt.icon, `${title} icon`, {
    className: 'auth-prompt-icon',
    width: 56,
    height: 56,
  });
  if (icon) getViewElement(view, '.auth-prompt-view').prepend(icon);

  const description = getViewElement(view, '#auth-prompt-description');
  if (prompt.description?.trim()) description.textContent = prompt.description;
  else description.remove();

  const form = getViewElement<HTMLFormElement>(view, '#auth-prompt-form');
  const safeUrl = getSafeExternalUrl(prompt.url);
  if (safeUrl) {
    const link = document.createElement('a');
    link.className = 'auth-prompt-link';
    link.href = safeUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open authentication page';
    form.before(link);
  }

  if (prompt.qrCode) {
    const qrContainer = document.createElement('div');
    qrContainer.className = 'auth-prompt-qr-container';
    const loading = document.createElement('p');
    loading.className = 'qr-loading';
    loading.setAttribute('role', 'status');
    loading.textContent = 'Loading QR code…';
    qrContainer.append(loading);
    form.before(qrContainer);
  }

  if (prompt.captcha) {
    const captchaContainer = document.createElement('div');
    captchaContainer.className = 'auth-prompt-captcha';
    captchaContainer.id = 'auth-prompt-captcha';
    form.before(captchaContainer);
  }

  form.setAttribute('aria-busy', String(busy));
  for (const [index, field] of (prompt.fields ?? []).filter(isAuthField).entries()) {
    appendAuthField(form, field, index, options);
  }

  const submitButton = getViewElement<HTMLButtonElement>(view, '#auth-prompt-submit-button');
  if (prompt.submit) {
    submitButton.setAttribute('form', 'auth-prompt-form');
    submitButton.textContent = busy ? 'Submitting…' : prompt.submitLabel?.trim() || 'Continue';
    submitButton.disabled = busy;
  } else {
    submitButton.remove();
  }

  const secondaryContainer = getViewElement(view, '.auth-prompt-secondary-action');
  const secondaryButton = getViewElement<HTMLButtonElement>(view, '#auth-prompt-secondary-button');
  if (prompt.secondaryAction) {
    const secondaryDescription = getViewElement(
      secondaryContainer,
      '.auth-prompt-secondary-description'
    );
    if (prompt.secondaryAction.description?.trim()) {
      secondaryDescription.textContent = prompt.secondaryAction.description;
    } else {
      secondaryDescription.remove();
    }
    secondaryButton.textContent = prompt.secondaryAction.label;
    secondaryButton.disabled = busy;
  } else {
    secondaryContainer.remove();
  }

  const error = getViewElement<HTMLElement>(view, '#auth-prompt-error');
  error.hidden = !options.error;
  if (options.error) error.textContent = options.error;

  return view;
}
