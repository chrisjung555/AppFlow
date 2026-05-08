#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ -f .venv/bin/activate ]]; then
  # shellcheck source=/dev/null
  source .venv/bin/activate
fi
exec uvicorn app.main:app --reload --host 127.0.0.1 --port 9000
