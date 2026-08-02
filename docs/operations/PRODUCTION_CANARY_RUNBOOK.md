# Production Canary Runbook

## Phases

1. **Staging**: same image, environment shape, PostgreSQL major version,
   reverse proxy, shared sessions, backup and alert integration.
2. **Internal production**: real domain and production services, internal users
   only, no public customer traffic.
3. **Limited canary**: approved internal accounts, products or traffic slice.
4. **Expanded canary**: approved larger slice for an approved time window.
5. **Full production**: only after Go/No-Go is `GO`.

## Before each phase

- Record commit SHA, image digest, frontend/prerender hash, catalog version and
  migration version.
- Verify backup, integrity, readiness, alert delivery and on-call acknowledgement.
- Record the approved traffic scope, observation window and abort thresholds.

## Observe

Readiness, 5xx, P95/P99 latency, login/session errors, 401/403/CSRF anomalies,
catalog conflicts, checkout failures, idempotency conflicts, provider timeouts,
webhook invalid/replay events, pending orders, QR/stock mismatches and resource
pressure. Do not include PII or secrets in evidence.

## Abort

Abort immediately on readiness failure, data-integrity failure, duplicate order
or QR assignment, negative stock, session inconsistency, accepted webhook replay,
backup failure without fallback, or an approved 5xx/latency threshold breach.
Thresholds are release evidence, not code defaults.

Run `node server/scripts/runProductionCanaryChecks.js` only with an approved
production base URL and read-only route checks. Internal write/checkout tests
must be captured separately in `CANARY_INTERNAL_EVIDENCE_PATH`.
