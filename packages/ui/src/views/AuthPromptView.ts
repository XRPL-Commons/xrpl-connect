import { WALLET_CONNECTOR_PARTS } from '../customization';
import type { WalletAuthField, WalletAuthPrompt, WalletTransactionReview } from '../types';
import { getSafeExternalUrl } from '../utils';
import { createStaticView, createWalletImage, getViewElement } from './dom';

export interface AuthPromptViewOptions {
  busy?: boolean;
  error?: string;
  values?: Readonly<Record<string, string>>;
  onValueChange?: (name: string, value: string) => void;
  /** Keep the submit button disabled, e.g. until a review can be approved. */
  submitLocked?: boolean;
}

/** Whether a prompt carries a complete transaction review the user can approve. */
export function isTransactionReviewPrompt(prompt: WalletAuthPrompt): boolean {
  const details: unknown = prompt.review?.details;
  return (
    typeof prompt.submit === 'function' &&
    Array.isArray(details) &&
    details.length > 0 &&
    details.every(
      (detail) =>
        typeof detail?.label === 'string' &&
        detail.label.trim() !== '' &&
        typeof detail.value === 'string'
    )
  );
}

/** Values longer than this, such as addresses and keys, get a line of their own. */
const INLINE_REVIEW_VALUE_LENGTH = 24;

const REVIEW_BOOKKEEPING_FIELDS = new Set([
  'Sequence',
  'TicketSequence',
  'LastLedgerSequence',
  'NetworkID',
  'SigningPubKey',
]);

function appendReviewRow(list: HTMLElement, detail: WalletTransactionReview['details'][number]): void {
  const row = document.createElement('div');
  row.className =
    detail.value.includes('\n') || detail.value.length > INLINE_REVIEW_VALUE_LENGTH
      ? 'auth-prompt-review-row auth-prompt-review-row--block'
      : 'auth-prompt-review-row';
  const label = document.createElement('dt');
  label.textContent = detail.label;
  const value = document.createElement('dd');
  value.textContent = detail.value;
  row.append(label, value);
  list.append(row);
}

function appendBatchTransactions(list: HTMLElement, detail: WalletTransactionReview['details'][number]): boolean {
  let transactions: unknown;
  try {
    transactions = JSON.parse(detail.value);
  } catch {
    return false;
  }
  if (
    !Array.isArray(transactions) ||
    transactions.length === 0 ||
    !transactions.every((transaction) => typeof transaction === 'object' && transaction !== null)
  ) {
    return false;
  }

  const batch = document.createElement('details');
  batch.className = 'auth-prompt-review-batch';
  const summary = document.createElement('summary');
  summary.textContent = detail.label;
  batch.append(summary);
  transactions.forEach((transaction, index) => {
    const transactionObject = transaction as Record<string, unknown>;
    const inner = transactionObject.RawTransaction;
    const fieldsObject =
      typeof inner === 'object' && inner !== null && !Array.isArray(inner)
        ? (inner as Record<string, unknown>)
        : transactionObject;
    const transactionDetails = document.createElement('details');
    transactionDetails.className = 'auth-prompt-review-batch-transaction';
    const transactionSummary = document.createElement('summary');
    const transactionType =
      typeof fieldsObject.TransactionType === 'string' ? `: ${fieldsObject.TransactionType}` : '';
    transactionSummary.textContent = `Transaction ${index + 1}${transactionType}`;
    transactionDetails.append(transactionSummary);
    const fields = document.createElement('dl');
    fields.className = 'auth-prompt-review-batch-fields';
    for (const [name, value] of Object.entries(fieldsObject)) {
      const formatted =
        typeof value === 'string'
          ? value
          : typeof value === 'number' || typeof value === 'boolean'
            ? String(value)
            : JSON.stringify(value, null, 2) ?? String(value);
      appendReviewRow(fields, { name, label: name, value: formatted });
    }
    transactionDetails.append(fields);
    batch.append(transactionDetails);
  });
  list.append(batch);
  return true;
}

/**
 * List every detail of the review; values are text, never markup. The list
 * scrolls on its own so the approve and reject actions stay in view.
 */
function appendTransactionReview(form: HTMLFormElement, review: WalletTransactionReview): void {
  const list = document.createElement('dl');
  list.className = 'auth-prompt-review';
  list.setAttribute('aria-label', 'Transaction details');
  list.tabIndex = 0;
  let bookkeeping: HTMLDetailsElement | null = null;
  let bookkeepingList: HTMLDListElement | null = null;
  for (const detail of review.details) {
    if (detail.name === 'RawTransactions' && appendBatchTransactions(list, detail)) continue;
    if (REVIEW_BOOKKEEPING_FIELDS.has(detail.name)) {
      if (!bookkeeping) {
        bookkeeping = document.createElement('details');
        bookkeeping.className = 'auth-prompt-review-details';
        const summary = document.createElement('summary');
        summary.textContent = 'Details';
        bookkeepingList = document.createElement('dl');
        bookkeepingList.className = 'auth-prompt-review-details-list';
        bookkeeping.append(summary, bookkeepingList);
        list.append(bookkeeping);
      }
      appendReviewRow(bookkeepingList!, detail);
      continue;
    }
    appendReviewRow(list, detail);
  }
  form.before(list);
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
  input.setAttribute('part', WALLET_CONNECTOR_PARTS.walletModal.input);
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

  // Each cell shows its digit as the value of an inert input rather than as a
  // text node: session-replay tools mask input values but record text.
  const cells = document.createElement('span');
  cells.className = 'auth-prompt-code-cells';
  cells.setAttribute('aria-hidden', 'true');
  const cellElements: HTMLInputElement[] = [];
  for (let cellIndex = 0; cellIndex < codeLength; cellIndex += 1) {
    const cell = document.createElement('input');
    cell.className = 'auth-prompt-code-cell';
    cell.type = 'text';
    cell.autocomplete = 'off';
    cell.disabled = true;
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
  input.setAttribute('part', WALLET_CONNECTOR_PARTS.walletModal.input);
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
      cell.value = value[cellIndex] ?? '';
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

function getSubmitLabel(prompt: WalletAuthPrompt, busy: boolean): string {
  return busy ? 'Submitting…' : prompt.submitLabel?.trim() || 'Continue';
}

/**
 * Toggle the busy state of a rendered prompt in place, so embedded widgets
 * such as a solved CAPTCHA survive the request.
 */
export function updateAuthPromptBusy(
  root: ParentNode,
  prompt: WalletAuthPrompt,
  busy: boolean
): void {
  root.querySelector('#auth-prompt-form')?.setAttribute('aria-busy', String(busy));
  for (const input of root.querySelectorAll<HTMLInputElement>('[data-auth-field]')) {
    input.disabled = busy;
  }
  const submitButton = root.querySelector<HTMLButtonElement>('#auth-prompt-submit-button');
  if (submitButton) {
    submitButton.textContent = getSubmitLabel(prompt, busy);
    submitButton.disabled = busy;
  }
  const secondaryButton = root.querySelector<HTMLButtonElement>('#auth-prompt-secondary-button');
  if (secondaryButton) secondaryButton.disabled = busy;
  const rejectButton = root.querySelector<HTMLButtonElement>('#auth-prompt-reject-button');
  if (rejectButton) rejectButton.disabled = busy;
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
  // A review has no previous step: closing the modal or rejecting cancels it.
  const review = prompt.review;
  if (review) getViewElement(view, '#auth-prompt-cancel-button').remove();
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
  const safeUrl = review ? null : getSafeExternalUrl(prompt.url);
  if (review) appendTransactionReview(form, review);
  if (safeUrl) {
    const link = document.createElement('a');
    link.className = 'auth-prompt-link';
    link.href = safeUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open authentication page';
    form.before(link);
  }

  if (prompt.qrCode && !review) {
    const qrContainer = document.createElement('div');
    qrContainer.className = 'auth-prompt-qr-container';
    const loading = document.createElement('p');
    loading.className = 'qr-loading';
    loading.setAttribute('role', 'status');
    loading.textContent = 'Loading QR code…';
    qrContainer.append(loading);
    form.before(qrContainer);
  }

  if (prompt.captcha && !review) {
    const captchaContainer = document.createElement('div');
    captchaContainer.className = 'auth-prompt-captcha';
    captchaContainer.id = 'auth-prompt-captcha';
    form.before(captchaContainer);
  }

  form.setAttribute('aria-busy', String(busy));
  const fields = review ? [] : (prompt.fields ?? []);
  for (const [index, field] of fields.filter(isAuthField).entries()) {
    appendAuthField(form, field, index, options);
  }

  const submitButton = getViewElement<HTMLButtonElement>(view, '#auth-prompt-submit-button');
  if (prompt.submit) {
    submitButton.setAttribute('form', 'auth-prompt-form');
    if (review) submitButton.setAttribute('part', WALLET_CONNECTOR_PARTS.walletModal.approveButton);
    submitButton.textContent = getSubmitLabel(prompt, busy);
    submitButton.disabled = busy || (options.submitLocked ?? false);
  } else {
    submitButton.remove();
  }
  if (review) {
    const rejectButton = document.createElement('button');
    rejectButton.className = 'error-button error-button-secondary';
    rejectButton.id = 'auth-prompt-reject-button';
    rejectButton.setAttribute('part', WALLET_CONNECTOR_PARTS.walletModal.rejectButton);
    rejectButton.type = 'button';
    rejectButton.textContent = 'Reject';
    rejectButton.disabled = busy;
    const actions = getViewElement(view, '.auth-prompt-actions');
    actions.classList.add('auth-prompt-actions--review');
    actions.prepend(rejectButton);
  }

  const secondaryContainer = getViewElement(view, '.auth-prompt-secondary-action');
  const secondaryButton = getViewElement<HTMLButtonElement>(view, '#auth-prompt-secondary-button');
  if (prompt.secondaryAction && !review) {
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
