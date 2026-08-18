# RC registry verification correction

- [x] Confirm the live registry state and npm's required `latest` invariant.
- [x] Accept the valid first-publication framework tag state during preflight and final verification.
- [x] Retry post-publish registry verification across the propagation window.
- [x] Add regression coverage for valid tags, transient failures, and bounded exhaustion.
- [x] Run publisher tests and live read-only registry verification.
- [x] Review, commit, push, and open the release-blocker pull request.

## Review

- Confirmed npm requires every package to expose `latest`; both first-time bindings validly map `latest` and `rc` to `1.0.0-rc.0`.
- Updated preflight and final assertions while preserving `xrpl-connect@latest` at `0.8.2`.
- Added asynchronous post-publish verification retries after 1, 2, 4, 8, and 16 seconds.
- Added regression coverage for transient recovery and bounded exhaustion.
- Verified formatting, lint, the full monorepo suite, and both live read-only prepublish and final registry checks.
