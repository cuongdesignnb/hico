# Canary And Rollback Drill

1. Capture the immutable image digest, catalog version, pending-order count,
backup verification, dependency gate, and current readiness result.
2. Run expand-only migrations, then start one canary instance against the shared
PostgreSQL auth store.
3. Verify login through instance A and authenticated read/write/logout through
instance B without sticky sessions.
4. Observe session-store latency/errors, 401/403/CSRF anomalies, 5xx rate,
catalog health, checkout scope health, webhook failures, pending-order growth,
and resource use for the approved canary window.
5. Stop rollout immediately on a critical alert or failed readiness check.
6. Roll back only to an image compatible with the expanded schema. Keep current
secrets or use the documented key-ring grace period; never restore revoked
provider credentials.
7. Verify public routes, canonical catalog read, pending fulfillment continuity,
and readiness after rollback. Prefer forward-fix over destructive database down
migrations.

Record owner, image digest, timestamps, metrics, decision, and follow-ups in
the release report.
