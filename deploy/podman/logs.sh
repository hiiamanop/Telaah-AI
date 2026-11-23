#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-app}" = "tunnel" ]; then
  podman logs -f telaah-tunnel
else
  podman logs -f telaah-app
fi
