import { describe, expect, it } from 'vite-plus/test';
import { formatLedgerError, parseLedgerError } from '../src/errors';
import { LedgerDeviceState } from '../src/types';

describe('Ledger error messages', () => {
  it.each(['Account not found.', 'Transaction not found.', 'Ledger not found.'])(
    'does not turn "%s" into USB advice',
    (message) => {
      const error = new Error(message);
      expect(parseLedgerError(error)).toEqual({ state: LedgerDeviceState.UNKNOWN, message });
      expect(formatLedgerError(error)).toBe(message);
    }
  );

  it.each(['No device found', 'Device not found', 'Cannot open device', 'Device disconnected'])(
    'retains USB advice for "%s"',
    (message) => {
      expect(parseLedgerError(new Error(message)).state).toBe(LedgerDeviceState.NOT_CONNECTED);
      expect(formatLedgerError(new Error(message))).toContain('connected via USB');
    }
  );
});
