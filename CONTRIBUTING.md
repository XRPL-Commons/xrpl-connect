# Contributing to xrpl-connect

Thanks for your interest in contributing! This document covers the conventions
that aren't already in `README.md` or enforced by tooling.

## Persisted-state migrations

`@xrpl-connect/core` persists wallet-connection state (the `StoredState`
shape) through the `Storage` class in `packages/core/src/storage.ts`. The
stored value is always wrapped in a versioned envelope:

```ts
{ version: number, payload: StoredState }
```

`Storage.loadState()` reads the envelope, runs any registered migrations to
bring the payload up to the current version, and **never throws** —
unrecognized, too-new, or un-migratable entries are cleared so
`WalletManager.autoConnect` cannot fail because of stale data.

### When you have to bump the version

Bump `STORED_STATE_VERSION` (in `packages/core/src/storage.ts`) whenever you
change `StoredState` in a way an older runtime cannot safely interpret:

- renaming a field,
- changing a field's type,
- adding a field that downstream code assumes is present,
- changing the semantic meaning of a field (e.g. switching adapter ids).

Additive changes that older code would silently ignore (a new optional field
that's never read except by new code paths) do **not** require a bump.

### How to add a migration

1. Bump `STORED_STATE_VERSION` to `N + 1`.
2. Add an entry to `STATE_MIGRATIONS` keyed by `N` (the *source* version)
   whose function takes the previous payload and returns the new shape:
   ```ts
   export const STATE_MIGRATIONS: Record<number, StoredStateMigration> = {
     1: (payload) => {
       const p = payload as OldStoredStateV1;
       return { ...p, newField: defaultValue };
     },
   };
   ```
3. Add a unit test in `packages/core/src/storage.test.ts` that writes a
   `version: N` envelope through `MemoryStorageAdapter` and asserts the
   loaded result matches the new shape.
4. Avoid throwing inside a migration — `Storage` already treats thrown
   migrations as "discard and clear." Use that escape hatch sparingly; the
   point of a migration is to preserve the user's session, not drop it.

### What gets cleared instead of migrated

`Storage.loadState()` will clear the entry and return `null` if:

- the value is not JSON,
- the value parses but isn't a `{ version, payload }` envelope (data
  written by a pre-versioning release falls here),
- `version` is greater than `STORED_STATE_VERSION`,
- there's no registered migration for some intermediate version,
- a migration throws.

This is deliberate: a partially-migrated or unknown payload is worse than a
fresh reconnect prompt.
