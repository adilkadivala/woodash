# Threat model (summary)

## Shared upstream credentials

Members never receive upstream bearer tokens or Woo keys. They only hold **gateway API keys**. With a member key they can invoke any tool allowed by policy—equivalent to sharing the upstream credential’s capabilities for those tools. Mitigation: optional `tool_policies` (deny beats allow), audit on every call.

## No client token passthrough

External `Authorization: Bearer kgw_...` is verified at the gateway. Upstream calls use **stored** credentials decrypted only in the gateway process. Upstreams never see member keys.

## Untrusted upstream tool descriptions

Tool metadata from upstreams is treated as untrusted data. Digests detect declaration changes; chat wraps results as data for the LLM; **policy** restricts who can call what—not prompt text alone.

## Member vs member

One member cannot impersonate another: audit and rate limits bind to `userId` from session or API key. Members cannot read others’ API key plaintext (hashed storage) or upstream secrets (write-only API).

## Admin-added malicious URL (SSRF)

URL validation blocks private IPs and metadata hosts in production; cluster-internal hosts are allowed via `.svc` naming for legitimate in-cluster MCP services. Admins should only register servers they trust—compromised upstreams can return misleading tool output (prompt injection surface).

## Store namespaces

Each extra store is a namespace with default-deny NetworkPolicies: Woo MCP accepts only the gateway ServiceAccount’s pods in `platform`; MariaDB accepts only WordPress/wp-init in that namespace. Store secrets never leave Kubernetes Secrets plus AES-GCM in Postgres. The gateway’s ClusterRole is limited to the APIs Helm needs for store charts (not cluster-admin). Members can only delete stores they created (admins can delete any).

## Revocation

Revoked API keys fail closed on next request. Disabled users and disabled upstreams are enforced in `executeTool` and listing.
