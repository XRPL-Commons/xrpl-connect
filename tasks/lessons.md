# Lessons

- When a branch already has a dedicated local worktree, locate and use that branch-attached worktree for fixes, verification, commits, and pushes instead of creating a detached review worktree.
- When review findings become implementation work, move immediately to the branch-attached worktree and complete the commit/push loop there; detached review worktrees are only for read-only verification.
- A parser regression fixture must be proven against the known-bad artifact before being accepted; pin the complete consumer toolchain when floating transitive versions can make the failure disappear.
- After rewriting a PR branch, verify every commit both locally with Git's signature status and remotely through GitHub's verification result; a locally valid GPG signature is not enough when GitHub persisted a verifier-service error.
