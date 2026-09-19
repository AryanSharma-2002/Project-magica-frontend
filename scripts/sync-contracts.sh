#!/usr/bin/env bash
# Vendors the backend's Zod contracts into src/contracts and records a lock.
# Usage: pnpm contracts:sync [<backend-path-or-git-url>] [<git-ref>]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-../agent-chat-backend}"
REF="${2:-}"
DEST="$ROOT/src/contracts"
TMP=""
cleanup() { if [ -n "$TMP" ]; then rm -rf "$TMP"; fi; }
trap cleanup EXIT

if [[ "$SRC" == http* || "$SRC" == git@* ]]; then
  TMP="$(mktemp -d)"
  git clone --quiet --depth 1 ${REF:+--branch "$REF"} "$SRC" "$TMP/repo"
  SRC="$TMP/repo"
fi
[ -d "$SRC/packages/contracts/src" ] || { echo "contracts not found at $SRC/packages/contracts/src" >&2; exit 1; }

COMMIT="$(git -C "$SRC" rev-parse --verify -q HEAD 2>/dev/null || echo unknown)"
rm -rf "$DEST" && mkdir -p "$DEST"
cp "$SRC"/packages/contracts/src/*.ts "$DEST"/
HASH="$(cd "$DEST" && find . -type f -name '*.ts' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -d' ' -f1)"
cat > "$ROOT/contracts.lock.json" <<JSON
{
  "source": "agent-chat-backend/packages/contracts/src",
  "commit": "$COMMIT",
  "sha256": "$HASH",
  "syncedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON
echo "contracts synced from $COMMIT ($HASH)"
