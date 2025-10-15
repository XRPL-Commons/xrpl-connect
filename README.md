# XRPL Connect

A framework-agnostic wallet connection and management toolkit for the XRPL ecosystem.

## Project Status

**Phase 1 Complete:** Core SDK implemented and building successfully!

### Completed

- Monorepo structure with pnpm + Turbo
- `@xrpl-connect/core` - Framework-agnostic core SDK
  - WalletManager orchestrator
  - Unified WalletAdapter interface
  - Event-driven architecture (EventEmitter)
  - Storage layer (localStorage + memory)
  - Error handling system
  - Logger system
  - Full TypeScript support

### Next Steps

- Implement wallet adapters:
  - Xaman (formerly Xumm)
  - Crossmark
  - WalletConnect
  - GemWallet (later)
- Create examples (vanilla JS, React, Vue)
- Add tests
- Documentation site

## Project Structure

```
xrpl-connect/
├── packages/
│   ├── core/                 # ✅ Complete - Core SDK
│   └── adapters/
│       ├── xaman/            # 🔜 Next
│       ├── crossmark/        # 🔜 Next
│       ├── walletconnect/    # 🔜 Next
│       └── gemwallet/        # Later
├── examples/
│   └── vanilla-js/           # 🔜 Next
└── docs/                     # Future
```

## Quick Start (Once Adapters Are Ready)

```bash
pnpm install @xrpl-connect/core @xrpl-connect/adapter-xaman xrpl
```

```typescript
import { WalletManager } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';

const manager = new WalletManager({
  adapters: [new XamanAdapter()],
  network: 'testnet',
});

// Connect
const account = await manager.connect('xaman');

// Sign transaction
const signed = await manager.sign({
  TransactionType: 'Payment',
  Account: account.address,
  Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
  Amount: '1000000',
});
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint

# Format
pnpm format
```

## Architecture

See [claude.md](../claude.md) for detailed technical architecture and implementation guide.

## License

MIT
