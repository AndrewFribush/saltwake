#!/bin/sh
# Writes the operator config and runtime approval from secrets, then starts the hosted testnet server.
set -eu
: "${SALTWAKE_PUBLIC_ORIGIN:?set SALTWAKE_PUBLIC_ORIGIN (https://<app>.fly.dev)}"
: "${SALTWAKE_CONFIG_JSON:?set secret SALTWAKE_CONFIG_JSON (contents of .state/testnet-<account>.json)}"
: "${SALTWAKE_APPROVAL_JSON:?set secret SALTWAKE_APPROVAL_JSON (contents of .state/testnet-<account>-approval.json)}"
mkdir -p /app/.state
umask 077
printf '%s' "$SALTWAKE_CONFIG_JSON" > /app/.state/hosted-config.json
printf '%s' "$SALTWAKE_APPROVAL_JSON" > /app/.state/hosted-approval.json
exec npx tsx apps/server/src/main.ts --testnet --config .state/hosted-config.json --approval .state/hosted-approval.json \
  --public-origin "$SALTWAKE_PUBLIC_ORIGIN" --serve-web apps/web/dist --listen 0.0.0.0 --port "${PORT:-8080}" \
  --rpc-cache-ms 20000 --crowd "${SALTWAKE_CROWD:-0}"
