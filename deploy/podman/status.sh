#!/usr/bin/env bash
set -euo pipefail

echo "Pod:"
podman pod ps 2>/dev/null || true
echo
echo "Containers:"
podman ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || true
echo
printf "Local app: "
curl -sS -o /dev/null -w "%{http_code}\n" -m 5 http://127.0.0.1:3000 2>/dev/null || echo "tidak merespons"
printf "Public domain: "
curl -sS -o /dev/null -w "%{http_code}\n" -m 15 https://hiiamanop.my.id 2>/dev/null || echo "tidak merespons"
