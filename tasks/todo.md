# RC package-scope correction

- [x] Inventory every public React/Vue package-name and release-preflight reference.
- [x] Rename the public bindings to `@xrpl-commons/xrpl-connect-react` and `@xrpl-commons/xrpl-connect-vue`.
- [x] Update the guarded publisher, registry checks, packed-artifact tests, documentation, examples, and lockfile.
- [x] Verify formatting, lint, builds, tests, package dry-runs, and registry preflight behavior.
- [x] Review the final diff, commit, push, and open a release-blocker pull request.

## Review

- Renamed both framework package manifests and every consumer-facing install/import reference to the real XRPL Commons npm scope.
- Updated the RC publisher and registry assertions, including an invariant preventing framework candidates from drifting outside `@xrpl-commons`.
- Removed inherited `npm_config_dir` from child npm commands so `pnpm --dir` does not emit npm's unknown-config warning.
- Verified with formatting, lint, the complete monorepo suite, the versioned-docs snapshot check, three-package npm dry-runs, clean packed-consumer ESM/CJS/type/SSR checks, and the live read-only npm preflight.
