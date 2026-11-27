#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
SECRET="$(grep -E '^ALERT_SECRET=' .env | head -1 | cut -d= -f2- | tr -d '"' || true)"
if [ -z "${SECRET:-}" ]; then echo "ERROR: ALERT_SECRET kosong."; exit 1; fi
CURSOR=0
for _ in $(seq 1 40); do
  RESP="$(curl -fsS --max-time 300 -X POST "http://127.0.0.1:3000/api/screener/full-snapshot" \
    -H "x-alert-secret: ${SECRET}" -H 'content-type: application/json' \
    -d "{\"cursor\":${CURSOR},\"batchSize\":40}")"
  echo "$RESP"
  NEXT="$(printf '%s' "$RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("nextCursor", 0))')"
  DONE="$(printf '%s' "$RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("done", False))')"
  if [ "$DONE" = "True" ]; then break; fi
  CURSOR="$NEXT"
done
