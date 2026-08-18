# Lessons

## 2026-08-18 — Make documentation versioning discoverable

- A locale selector hidden behind a globe does not satisfy a visible documentation version switcher. Use the displayed version label as the dropdown trigger and verify both rendered destinations before handoff.

## 2026-08-18 — Verify registry ownership before release approval

- A package manifest and dry-run cannot prove that its npm scope is owned by the publishing organization. Confirm the real organization, existing package ownership, and candidate-name availability against the registry before declaring a release path ready.

## 2026-08-18 — Verify registry invariants before prescribing tag cleanup

- npm package metadata requires a `latest` dist-tag, including for a package whose first version is an RC. Check the live registry contract before recommending tag removal, and treat immediate post-publish reads as eventually consistent.
