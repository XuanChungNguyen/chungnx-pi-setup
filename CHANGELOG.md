# Changelog

## 0.1.0 — candidate, not yet published

- Cross-platform Node CLI with Bash compatibility entrypoints.
- File-only scratch, dry-run, canonical path guards and strict external allowlist.
- Transaction journals, automatic rollback on write errors and explicit rollback
  that protects subsequent user edits.
- Secret-blocking setup export and SHA-256 checked JSON bundles.
- Minimal/coding/full profiles, exact versions and npm lockfiles.
- Excludes pi-worktree 1.3.3 because it introduces deprecated Pi 0.73.1 and
  high-severity audit findings through transitive dependencies.
- Doctor checks config, lock consistency, installed versions and opt-in RPC startup.
- Configurable local Git identity without changing global GitHub authentication.
- Bounded sequential planner/implementer/reviewer workflow and evidence files.
- CI matrix and regression tests.

Breaking changes: legacy tarball import and export of auth/sessions/memory/missions
are deliberately unsupported. See docs/MIGRATION.md. The full profile excludes
three packages whose declared peer ranges do not support Pi 0.85.1.
