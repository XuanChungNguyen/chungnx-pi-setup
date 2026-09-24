# Release evidence

A candidate is not a 10/10 release solely because unit tests pass.

- [ ] Windows, Linux and macOS CI checks pass on the release commit.
- [ ] All profiles install from their committed locks on clean supported machines.
- [ ] Full-profile native/browser/desktop prerequisites are verified interactively.
- [ ] Doctor RPC startup succeeds; each configured provider completes a real request.
- [ ] A sample task passes planner -> implementer -> reviewer with recorded evidence.
- [ ] Upgrade from the previous release and rollback are exercised on a clean machine.
- [ ] No secrets in current files, release archive, journals or Git history.
- [ ] Rights for inherited scripts/history are resolved and an appropriate LICENSE is approved.
- [ ] Changelog, package versions, compatibility exclusions and release checksum agree.
- [ ] A new user can follow README without author assistance.

Current exclusions: pi-background-tasks 2.5.0, pi-goal-x 0.31.5 and
@pi-unipi/notify 2.20.1 declare incompatible peer ranges for Pi 0.85.1.
pi-worktree 1.3.3 pulls deprecated Pi 0.73.1 plus dependencies with high-severity
advisories. Do not use --force, --legacy-peer-deps or audit overrides to conceal them.

Full includes pi-smart-fetch which declares Node >=24.18.0 and Bun >=1.3.0.
Lifecycle scripts are disabled during install. Native dependencies may need
documented, package-specific preparation before an extension is usable.
