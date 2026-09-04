export interface TxResult {
  hash: string;
  /** Ledger engine result code, e.g. `tesSUCCESS`, `tecUNFUNDED_PAYMENT`, `tecNO_LINE`. */
  engineResult: string;
  validated: boolean;
}

interface SubmitAndWaitResponse {
  result: {
    hash?: string;
    validated?: boolean;
    meta?: string | { TransactionResult?: string };
  };
}

export function toTxResult(response: SubmitAndWaitResponse): TxResult {
  const meta = response.result.meta;
  const engineResult =
    typeof meta === 'object' && meta !== null && typeof meta.TransactionResult === 'string'
      ? meta.TransactionResult
      : 'unknown';

  return {
    hash: response.result.hash ?? '',
    engineResult,
    validated: response.result.validated ?? false,
  };
}
