import { Buffer } from 'buffer';

// Ledger's browser transport uses Buffer while its module is being evaluated.
globalThis.Buffer ??= Buffer;
