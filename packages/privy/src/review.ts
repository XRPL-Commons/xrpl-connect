import type {
  NetworkInfo,
  Transaction,
  WalletTransactionReview,
  WalletTransactionReviewDetail,
} from 'xrpl-connect';

/**
 * Details are ordered by what the user needs first: what moves and where, then
 * every other field of the transaction type, then cost, network and signer,
 * and last the sequencing and signing fields. `network` is not a field.
 */
const LEADING_DETAILS: ReadonlyMap<string, string> = new Map([
  ['TransactionType', 'Transaction type'],
  ['Amount', 'Amount'],
  ['Destination', 'Destination'],
  ['DestinationTag', 'Destination tag'],
]);
const TRAILING_DETAILS: ReadonlyMap<string, string> = new Map([
  ['Fee', 'Fee'],
  ['network', 'Network'],
  ['Account', 'Account'],
]);
const BOOKKEEPING_FIELDS: ReadonlySet<string> = new Set([
  'Sequence',
  'TicketSequence',
  'LastLedgerSequence',
  'NetworkID',
  'SigningPubKey',
]);

/** Fields holding an XRPL amount: XRP drops, an issued currency, or an MPT amount. */
const AMOUNT_FIELDS: ReadonlySet<string> = new Set([
  'Amount',
  'Amount2',
  'BidMax',
  'BidMin',
  'DeliverMax',
  'DeliverMin',
  'EPrice',
  'Fee',
  'LPTokenIn',
  'LPTokenOut',
  'LimitAmount',
  'MinAccountCreateAmount',
  'SendMax',
  'SignatureReward',
  'TakerGets',
  'TakerPays',
]);

/** Format a drops string exactly as XRP, e.g. `1500000` as `1.5 XRP`. */
export function formatXrpDrops(drops: string): string {
  if (!/^[0-9]+$/.test(drops)) return drops;
  const digits = drops.padStart(7, '0');
  const whole = digits.slice(0, -6).replace(/^0+(?=[0-9])/, '');
  const fraction = digits.slice(-6).replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''} XRP`;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const present = Object.keys(value);
  return present.length === keys.length && keys.every((key) => typeof value[key] === 'string');
}

/**
 * Format an XRPL amount. Returns `undefined` for any other shape, which is
 * then shown as JSON so that no part of it is hidden.
 */
export function formatAmount(value: unknown): string | undefined {
  if (typeof value === 'string') return formatXrpDrops(value);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const amount = value as Record<string, unknown>;
  if (hasOnlyKeys(amount, ['currency', 'issuer', 'value'])) {
    return `${amount.value} ${amount.currency} (issuer ${amount.issuer})`;
  }
  if (hasOnlyKeys(amount, ['mpt_issuance_id', 'value'])) {
    return `${amount.value} MPT (issuance ${amount.mpt_issuance_id})`;
  }
  return undefined;
}

function formatField(name: string, value: unknown): string {
  const amount = AMOUNT_FIELDS.has(name) ? formatAmount(value) : undefined;
  if (amount !== undefined) return amount;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

/**
 * Describe the exact transaction to sign. Every field appears exactly once,
 * key details first; amounts are formatted and anything else keeps its raw value.
 */
export function createTransactionReview(
  transaction: Transaction,
  network: NetworkInfo,
  action: WalletTransactionReview['action']
): WalletTransactionReview {
  // The JSON form is what the signing serialization covers: fields without a
  // value are not part of it.
  const fields: Record<string, unknown> = JSON.parse(JSON.stringify(transaction));
  const details: WalletTransactionReviewDetail[] = [];
  const shown = new Set<string>();
  const show = (name: string, label = name): void => {
    if (shown.has(name) || !Object.prototype.hasOwnProperty.call(fields, name)) return;
    shown.add(name);
    details.push({ name, label, value: formatField(name, fields[name]) });
  };

  for (const [name, label] of LEADING_DETAILS) show(name, label);
  for (const name of Object.keys(fields)) {
    if (!TRAILING_DETAILS.has(name) && !BOOKKEEPING_FIELDS.has(name)) show(name);
  }
  for (const [name, label] of TRAILING_DETAILS) {
    if (name === 'network') details.push({ name, label, value: network.name });
    else show(name, label);
  }
  // Everything left is bookkeeping; nothing is ever left out.
  for (const name of Object.keys(fields)) show(name);
  // Frozen, so no prompt listener can change what another one shows.
  return deepFreeze({
    action,
    network: { ...network },
    transaction: JSON.parse(JSON.stringify(transaction)),
    details,
  });
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
