# Issue #171

## Issue summary

- The React modal hook drops the web component's readiness and asynchronous API, so consumers cannot safely call or await it.
- `open` must preserve failures, `openAndWait` must return the selected `AccountInfo`, and pre-registration calls must reject with a clear namespaced setup error.
- Connector registration remains last-mounted-owner-wins, with reactive readiness through registration and unregistration.
- Tests, public type assertions, and React documentation must describe and enforce the complete contract.

## Plan

- [x] Validate GitHub access, refresh `origin/develop`, and confirm issue state, comments, linked PRs, and acceptance criteria.
- [x] Create a clean isolated worktree from the refreshed default branch and review applicable repository guidance.
- [x] Trace the React provider/hook/types lifecycle, Vue parity implementation, tests, public type checks, and documentation.
- [x] Implement the smallest production-ready async modal context API while preserving connector ownership semantics.
- [x] Add focused runtime and public type regressions for pre-registration calls, lifecycle readiness, rejected opens, and `openAndWait`.
- [x] Update React documentation for readiness and awaitable modal usage.
- [x] Run formatting, linting, focused tests, builds/type checks, and relevant repository-level verification.
- [x] Review the final diff against every acceptance criterion and record results below.
- [x] Commit only intentional files, push the branch, open the PR, and verify remote PR metadata/checks.

## Review

- The provider now exposes connector registration as reactive `ready` state while preserving the insertion-ordered `Set` that gives the newest connector ownership and falls back when it unmounts.
- `open()` and `openAndWait()` preserve native results and failures; missing registration and synchronous connector failures become rejected promises with a React-namespaced setup error, while `close()` remains a safe no-op.
- Runtime tests cover pre-registration calls, lifecycle readiness, open failures, `openAndWait` success/close rejection, newest ownership, and fallback; source plus packed ESM/CJS type fixtures enforce the public contract.
- The package README, React framework guide, API reference, and Unreleased changelog document readiness, async behavior, errors, and multi-connector ownership without changing versioned documentation.
- `pnpm exec vp check`, `pnpm --filter @xrpl-commons/xrpl-connect-react... build`, focused React tests, `pnpm test`, `pnpm docs:snapshot:check`, `pnpm --filter xrpl-connect test:publish`, and `git diff --check` pass.
- Independent final review found no correctness, lifecycle, declaration, documentation, or scope findings.
