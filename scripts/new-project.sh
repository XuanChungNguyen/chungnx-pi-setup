#!/usr/bin/env bash
# Compatibility entrypoint; all file operations use the cross-platform Node CLI.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  exec node "$SCRIPT_DIR/pi-setup.mjs" help
fi
exec node "$SCRIPT_DIR/pi-setup.mjs" project "$@"
