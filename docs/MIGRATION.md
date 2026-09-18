# Migration from the personal snapshot

The original README/config remains available in Git history as historical reference,
not as a recommended install source. It is omitted from the template tree to avoid
shipping personal cache/config data. Existing Pi runtime is never changed until you
explicitly run restore/install against it.

1. Install Node 24.18.0+ within the Node 24 line. Git Bash is optional with the Node CLI.
2. Generate a new directory with `configure`; choose provider/model yourself.
3. Run `doctor --from-config NEW_DIR --strict`, then `restore --from-config NEW_DIR --scratch`.
4. Preview the real restore using `--dry-run`. Close active Pi sessions before applying.
5. Apply and save the printed journal path. Run install, doctor --live, and optionally --smoke.
6. Log in interactively. Run a small task before using the setup for real work.

`backup --config-dir` now blocks unpinned package references and possible secrets.
Manually review and pin the live package list first. The scanner is a safety net,
not a guarantee that arbitrary documents contain no sensitive information.

JSON bundles replace tarballs. This removes archive extraction and its link/path
risks. Do not rename a tarball to JSON. Inspect a trusted old archive separately,
copy only setup files into a clean directory, pin packages and validate that directory.
Auth/history/state are no longer exportable by this tool.

The old `--personal`/`--work` identity presets are replaced with explicit `--name`
and `--email`. No shell profile is modified; use the Node project command directly.

Restores merge on first use. Later restores remove only stale files recorded in
`.pi-setup-managed.json`; unrelated runtime files remain. External config is an
explicit allowlist currently containing Pi Lens only. A profile without Pi Lens
does not delete an existing global Pi Lens config.

Rollback restores files, not node_modules. After rolling back an upgrade, run install
again to rebuild npm from the restored lockfile. npm ci failure can leave an incomplete
node_modules tree: the CLI reports failure and you must reinstall before using Pi.

Crash recovery: inspect the pending journal and use rollback. A transaction.lock left
by a killed process must only be removed after checking that no setup process is active.
Journals contain previous local file contents, possibly sensitive; keep them private.
Do not import or execute someone else's journal: its absolute paths are machine-local.
