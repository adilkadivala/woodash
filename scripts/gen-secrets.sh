#!/usr/bin/env bash
set -euo pipefail
rand() { openssl rand -hex "${1:-16}"; }
cat <<EOF
# Generated $(date -Iseconds). Do not commit.
secrets:
  mariadbRootPassword: "$(rand 12)"
  mariadbPassword: "$(rand 12)"
  postgresPassword: "$(rand 12)"
  wordpressAdminUser: admin
  wordpressAdminPassword: "$(rand 8)"
  wordpressAdminEmail: admin@store.local
  wooConsumerKey: "ck_$(rand 20)"
  wooConsumerSecret: "cs_$(rand 20)"
  wooMcpToken: "$(rand 16)"
  notesMcpToken: "$(rand 16)"
  sessionSecret: "$(rand 24)"
  credentialEncKey: "$(openssl rand -hex 32)"
  bootstrapAdminEmail: admin@gateway.local
  bootstrapAdminPassword: "$(rand 8)"
  llmApiKey: "${LLM_API_KEY:-}"
EOF
