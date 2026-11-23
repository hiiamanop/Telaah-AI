#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "ERROR: .env tidak ditemukan. Salin dari .env.example dan isi OPENROUTER_API_KEY."
  exit 1
fi

if [ ! -f data/brokers_registry.json ]; then
  echo "ERROR: data/brokers_registry.json tidak ditemukan."
  exit 1
fi

if [ "${REBUILD:-0}" = "1" ] || ! podman image exists telaah-ai:local; then
  echo "Building image telaah-ai:local ..."
  podman build -t telaah-ai:local .
fi

if podman pod exists telaah-pod; then
  echo "Removing existing pod telaah-pod ..."
  podman pod rm -f telaah-pod >/dev/null
fi

echo "Creating pod ..."
podman pod create --name telaah-pod -p 127.0.0.1:3000:3000

echo "Starting app ..."
podman run -d \
  --pod telaah-pod \
  --name telaah-app \
  --env-file .env \
  -v "$ROOT/data:/app/data:Z" \
  telaah-ai:local

TOKEN="$(grep -E '^TUNNEL_TOKEN=' .env | head -1 | cut -d= -f2- || true)"
if [ -n "${TOKEN:-}" ]; then
  echo "Starting Cloudflare Tunnel connector ..."
  podman run -d \
    --pod telaah-pod \
    --name telaah-tunnel \
    --env "TUNNEL_TOKEN=$TOKEN" \
    docker.io/cloudflare/cloudflared:latest \
    tunnel --no-autoupdate run
else
  echo "TUNNEL_TOKEN belum diisi di .env; app berjalan lokal tanpa tunnel."
fi

echo
podman pod ps
podman ps --pod --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo
echo "Lokal:  http://127.0.0.1:3000"
echo "Subdomain: https://telaah.hiiamanop.my.id (jika tunnel aktif)"
