# Validation of candidate 0.1.0

Date: 2026-09-17. Local environment: Windows, Node 24.18.0, npm 11.16.0.

## Completed

- 43 Node regression tests passed. No model credentials required.
- Syntax checks for CLI, file transaction library and team runner passed.
- All three profiles generated and passed strict config/lock consistency checks.
- minimal, coding and full installed using `npm ci --ignore-scripts` into a separate
  HOME under the development workspace. Installed direct versions matched locks.
- npm audit reported zero high/critical findings after pi-worktree was excluded.
- Minimal, coding and full Pi 0.85.1 completed an RPC `get_state` probe without a
  model prompt. Coding/full emitted expected Advisor notifications because the
  isolated HOME intentionally had no provider login/model catalog.
- The one-command minimal `setup` flow completed restore, npm install, version
  verification and a subsequent RPC smoke probe in a fresh isolated HOME.
- Tests exercised LF/CRLF manifests, traversal/symlink rejection, secret redaction,
  stale managed-file removal, idempotency, full rollback, recovery from write
  failure, refusal to overwrite subsequent edits, and bounded workflow handoffs.

## Not yet verified

- The configured Windows/Linux/macOS GitHub Actions jobs have not run remotely.
- Coding/full extension runtime behavior, native/browser/desktop setup and Bun.
- Authentication validity and real provider responses.
- Full three-role task with real models and an independent acceptance test.
- New-user onboarding and upgrade/rollback across different released versions.
- License selection for the new template and treatment of inherited historical commits.

The installation checks do not run lifecycle scripts; they prove dependency
resolution and package availability, not readiness of every native feature.
The unit workflow tests use simulated phase results. No claim of production
readiness or 10/10 certification is made by this candidate.
