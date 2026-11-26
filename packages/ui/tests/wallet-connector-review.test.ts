import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { WalletManager } from '@xrpl-connect/core';
import type {
  NetworkInfo,
  WalletAdapter,
  WalletAuthPrompt,
  WalletTransactionReview,
} from '@xrpl-connect/core';
import { TIMINGS } from '../src/constants';
import '../src/register';

const NETWORK: NetworkInfo = { id: 'testnet', name: 'Testnet', wss: 'wss://example' };

type Connector = HTMLElement & {
  setWalletManager(manager: WalletManager): void;
  open(): Promise<void>;
  close(): void;
  disconnectedCallback(): void;
  getOverlayRoot(): ShadowRoot | null;
  getAccountModalRoot(): ShadowRoot | null;
  openAccountModal(): void;
  submitAuthPrompt(): Promise<void>;
};

type PromptListener = (prompt: WalletAuthPrompt | null) => void;

function createSigningAdapter(id = 'embedded') {
  const listeners = new Set<PromptListener>();
  const adapter: WalletAdapter = {
    id,
    name: 'Embedded',
    isAvailable: async () => true,
    connect: vi.fn(async () => ({ address: 'rSigner', network: NETWORK })),
    disconnect: vi.fn(async () => {}),
    getAccount: vi.fn(async () => null),
    getNetwork: vi.fn(async () => NETWORK),
    sign: vi.fn(),
    signAndSubmit: vi.fn(),
    signMessage: vi.fn(),
    onAuthPrompt: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const emit = (prompt: WalletAuthPrompt | null) => {
    for (const listener of [...listeners]) listener(prompt);
  };
  return { adapter, listeners, emit };
}

const review: WalletTransactionReview = {
  action: 'signAndSubmit',
  network: NETWORK,
  transaction: {
    TransactionType: 'Payment',
    Account: 'rSigner',
    Destination: 'rDest',
    Amount: '1500000',
  },
  details: [
    { name: 'TransactionType', label: 'Transaction type', value: 'Payment' },
    { name: 'network', label: 'Network', value: 'Testnet' },
    { name: 'Amount', label: 'Amount', value: '1.5 XRP' },
    { name: 'Memos', label: 'Memos', value: '[\n  {\n    "Memo": {}\n  }\n]' },
  ],
};

function createReviewPrompt(
  overrides: Partial<WalletAuthPrompt> = {},
  onSettle?: (approved: boolean) => void
): WalletAuthPrompt {
  return {
    title: 'Review transaction',
    description: 'Approving signs this transaction.',
    review,
    submitLabel: 'Approve',
    submit: vi.fn(async () => onSettle?.(true)),
    cancel: vi.fn(() => onSettle?.(false)),
    ...overrides,
  };
}

describe('WalletConnector transaction review', () => {
  let elements: Connector[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    for (const element of elements) element.disconnectedCallback();
    elements = [];
    document.body.replaceChildren();
    document.body.style.overflow = '';
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function mountConnector(manager: WalletManager): Connector {
    const connector = document.createElement('xrpl-wallet-connector') as Connector;
    connector.setWalletManager(manager);
    document.body.append(connector);
    elements.push(connector);
    return connector;
  }

  async function connectedSetup() {
    const signing = createSigningAdapter();
    const manager = new WalletManager({ adapters: [signing.adapter], autoConnect: false });
    const connector = mountConnector(manager);
    await manager.connect(signing.adapter.id);
    await vi.advanceTimersByTimeAsync(0);
    const dialog = () =>
      connector.getOverlayRoot()?.querySelector<HTMLElement>('[role="dialog"]') ?? null;
    const button = (id: string) =>
      connector.getOverlayRoot()?.querySelector<HTMLButtonElement>(id) ?? null;
    return { ...signing, manager, connector, dialog, button };
  }

  it('opens the closed modal on a review and closes it once the wallet withdraws it', async () => {
    const { connector, emit, listeners, dialog, button } = await connectedSetup();
    const events: string[] = [];
    connector.addEventListener('open', () => events.push('open'));
    connector.addEventListener('close', () => events.push('close'));
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    expect(listeners.size).toBe(1);
    expect(dialog()).toBeNull();

    const prompt = createReviewPrompt({}, () => emit(null));
    emit(prompt);

    const shown = dialog()!;
    expect(shown.querySelector('#wallet-dialog-title')?.textContent).toBe('Review transaction');
    expect(shown.querySelector('#auth-prompt-cancel-button')).toBeNull();
    const rows = [...shown.querySelectorAll('.auth-prompt-review-row')].map((row) => [
      row.querySelector('dt')?.textContent,
      row.querySelector('dd')?.textContent,
    ]);
    expect(rows).toEqual(review.details.map(({ label, value }) => [label, value]));
    expect(shown.querySelectorAll('.auth-prompt-review-row--block')).toHaveLength(1);
    expect(button('#auth-prompt-reject-button')?.textContent).toBe('Reject');
    expect(button('#auth-prompt-submit-button')?.textContent).toBe('Approve');
    expect(document.body.style.overflow).toBe('hidden');

    await vi.advanceTimersByTimeAsync(TIMINGS.TRANSACTION_REVIEW_APPROVAL_DELAY);
    expect(button('#auth-prompt-submit-button')?.disabled).toBe(false);
    await connector.submitAuthPrompt();

    expect(prompt.submit).toHaveBeenCalledWith({});
    expect(prompt.cancel).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
    expect(events).toEqual(['open', 'close']);
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps approval locked briefly so a double click cannot approve a new review', async () => {
    const { connector, emit, button } = await connectedSetup();
    const prompt = createReviewPrompt();
    emit(prompt);

    expect(button('#auth-prompt-submit-button')?.disabled).toBe(true);
    button('#auth-prompt-submit-button')?.click();
    await connector.submitAuthPrompt();
    await vi.advanceTimersByTimeAsync(TIMINGS.TRANSACTION_REVIEW_APPROVAL_DELAY - 1);
    expect(prompt.submit).not.toHaveBeenCalled();
    expect(button('#auth-prompt-submit-button')?.disabled).toBe(true);

    await vi.advanceTimersByTimeAsync(1);
    expect(button('#auth-prompt-submit-button')?.disabled).toBe(false);
    button('#auth-prompt-submit-button')?.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(prompt.submit).toHaveBeenCalledOnce();
  });

  it.each([
    [
      'the reject button',
      (root: ShadowRoot) =>
        root.querySelector<HTMLButtonElement>('#auth-prompt-reject-button')!.click(),
    ],
    [
      'the close button',
      (root: ShadowRoot) => root.querySelector<HTMLButtonElement>('.close-button')!.click(),
    ],
    [
      'Escape',
      (root: ShadowRoot) =>
        root
          .querySelector('[role="dialog"]')!
          .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    ],
  ])('rejects the review and closes the modal on %s', async (_name, act) => {
    const { connector, emit, dialog } = await connectedSetup();
    const prompt = createReviewPrompt({}, () => emit(null));
    emit(prompt);

    act(connector.getOverlayRoot()!);

    expect(prompt.cancel).toHaveBeenCalledOnce();
    expect(prompt.submit).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
  });

  it('shows a newer review only after rejecting the stale one on screen', async () => {
    const { emit, dialog } = await connectedSetup();
    const first = createReviewPrompt();
    const second = createReviewPrompt({
      review: {
        ...review,
        details: [{ name: 'Amount', label: 'Amount', value: '25 XRP' }],
      },
    });
    emit(first);
    emit(second);

    expect(first.cancel).toHaveBeenCalledOnce();
    expect(second.cancel).not.toHaveBeenCalled();
    expect(dialog()?.querySelector('dd')?.textContent).toBe('25 XRP');
    await vi.advanceTimersByTimeAsync(TIMINGS.TRANSACTION_REVIEW_APPROVAL_DELAY);
    expect(dialog()?.querySelector<HTMLButtonElement>('#auth-prompt-submit-button')?.disabled).toBe(
      false
    );
  });

  it('renders hostile review values as text', async () => {
    const { emit, dialog } = await connectedSetup();
    const hostile = '<img src=x onerror="globalThis.__reviewXss=true"><script>1</script>';
    emit(
      createReviewPrompt({
        title: hostile,
        description: hostile,
        review: { ...review, details: [{ name: 'Memo', label: hostile, value: hostile }] },
      })
    );

    const shown = dialog()!;
    expect(shown.querySelector('img:not(.auth-prompt-icon), script, [onerror]')).toBeNull();
    expect(shown.querySelector('dd')?.textContent).toBe(hostile);
    expect((globalThis as { __reviewXss?: boolean }).__reviewXss).toBeUndefined();
  });

  it.each([
    ['no details', { review: { ...review, details: [] } }],
    ['no approval handler', { submit: undefined }],
    ['malformed details', { review: { ...review, details: [{ name: 'x', label: 'X' }] } }],
  ])('rejects a review with %s without opening the modal', async (_name, overrides) => {
    const { emit, dialog } = await connectedSetup();
    const prompt = createReviewPrompt(overrides as Partial<WalletAuthPrompt>);
    emit(prompt);
    expect(prompt.cancel).toHaveBeenCalledOnce();
    expect(dialog()).toBeNull();
  });

  it('leaves sign-in prompts to connection attempts', async () => {
    const { emit, dialog } = await connectedSetup();
    const signIn: WalletAuthPrompt = { title: 'Verify', submit: vi.fn(), cancel: vi.fn() };
    emit(signIn);
    expect(dialog()).toBeNull();
    expect(signIn.cancel).not.toHaveBeenCalled();
  });

  it('closes the account modal to show a review', async () => {
    const { connector, emit, dialog } = await connectedSetup();
    connector.openAccountModal();
    expect(connector.getAccountModalRoot()?.querySelector('[role="dialog"]')).not.toBeNull();

    emit(createReviewPrompt());
    expect(connector.getAccountModalRoot()?.querySelector('[role="dialog"]')).toBeNull();
    expect(dialog()?.getAttribute('aria-labelledby')).toBe('wallet-dialog-title');
  });

  it('rejects the review and stops listening when the wallet disconnects', async () => {
    const { manager, emit, listeners, dialog } = await connectedSetup();
    const prompt = createReviewPrompt();
    emit(prompt);

    await manager.disconnect();
    expect(prompt.cancel).toHaveBeenCalledOnce();
    expect(dialog()).toBeNull();
    expect(listeners.size).toBe(0);

    const late = createReviewPrompt();
    emit(late);
    expect(dialog()).toBeNull();
  });

  it('rejects the review when the connector is removed or its manager replaced', async () => {
    const removed = await connectedSetup();
    const prompt = createReviewPrompt();
    removed.emit(prompt);
    removed.connector.remove();
    expect(prompt.cancel).toHaveBeenCalledOnce();
    expect(removed.listeners.size).toBe(0);

    const replaced = await connectedSetup();
    const replacedPrompt = createReviewPrompt();
    replaced.emit(replacedPrompt);
    replaced.connector.setWalletManager(new WalletManager({ adapters: [], autoConnect: false }));
    expect(replacedPrompt.cancel).toHaveBeenCalledOnce();
    expect(replaced.dialog()).toBeNull();
    expect(replaced.listeners.size).toBe(0);
  });

  it('subscribes when mounted on an already connected manager', async () => {
    const signing = createSigningAdapter();
    const manager = new WalletManager({ adapters: [signing.adapter], autoConnect: false });
    await manager.connect(signing.adapter.id);
    const connector = mountConnector(manager);
    expect(signing.listeners.size).toBe(1);

    signing.emit(createReviewPrompt());
    expect(connector.getOverlayRoot()?.querySelector('.auth-prompt-review')).not.toBeNull();
  });

  it('shows a review shared by several connectors in only one modal', async () => {
    const { manager, emit } = await connectedSetup();
    const second = mountConnector(manager);
    emit(createReviewPrompt());

    const openDialogs = elements.filter((element) =>
      element.getOverlayRoot()?.querySelector('[role="dialog"]')
    );
    expect(openDialogs).toHaveLength(1);
    expect(second.getOverlayRoot()?.querySelector('[role="dialog"]') ?? null).toBeNull();
  });
});
