# Production Rollback Runbook

1. Declare the incident, freeze production writes and preserve logs/metrics.
2. Confirm the rollback approver and record start time, release and image digest.
3. Deploy the last schema-compatible immutable application image.
4. Keep current secrets and key-ring behavior. Never restore a revoked provider,
   webhook, database or signing secret.
5. Verify readiness, public routes, canonical catalog, checkout safety,
   pending-fulfillment continuity and session behavior across instances.
6. Prefer a forward fix over a destructive database down migration. Restore the
   database only under the data-recovery incident runbook.
7. Record end time, data/session/order impact, result, approvers and follow-ups.

Rollback is not complete until integrity checks pass and the write gate remains
closed or is re-approved through the normal launch gate.
