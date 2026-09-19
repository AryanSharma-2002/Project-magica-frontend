#!/usr/bin/env bash
# CI guard: vendored contracts must match contracts.lock.json (i.e. never hand-edited).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXPECTED="$(python3 -c "import json;print(json.load(open('$ROOT/contracts.lock.json'))['sha256'])")"
ACTUAL="$(cd "$ROOT/src/contracts" && find . -type f -name '*.ts' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -d' ' -f1)"
[ "$EXPECTED" = "$ACTUAL" ] && echo "contracts OK" || { echo "src/contracts differs from contracts.lock.json — run pnpm contracts:sync" >&2; exit 1; }
