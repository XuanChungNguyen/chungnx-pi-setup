# Contributing

Use Node 24.18.0 or newer within the Node 24 line.

Before proposing a change:

```bash
npm run check
npm test
npm run doctor
```

For dependency/profile changes, update `template.json` and the matching
`runtime/<profile>/package.json`, regenerate the lockfile without `--force` or
`--legacy-peer-deps`, then run `npm audit --omit=dev --audit-level=high`.
Document compatibility exclusions instead of suppressing them.

Tests must use synthetic data and temporary directories. Never add auth files,
tokens, session history, journals, customer names or machine-specific caches.
Keep destructive file operations behind path canonicalization, link checks,
dry-run coverage and rollback tests.

Update README, CHANGELOG and validation/release documentation when behavior,
requirements or known limitations change. A passing unit test does not replace
clean-machine, multi-platform or real-provider evidence required by the release checklist.
