#!/bin/sh
set -eu
echo "[gateway] waiting for postgres and applying schema..."
i=0
while [ "$i" -lt 40 ]; do
  if bunx prisma db push; then
    exec bun run src/index.ts
  fi
  i=$((i + 1))
  echo "[gateway] db not ready, retry $i/40..."
  sleep 3
done
echo "[gateway] database never became ready" >&2
exit 1
