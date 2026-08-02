# Incident: Provider Outage

Severity: High. Owner: Fulfillment owner.

Detect provider timeout/failure and pending-order threshold alerts. Do not retry
unboundedly or expose provider details to customers. Preserve redacted request
IDs, apply existing retry policy, use sandbox/status evidence, verify no
duplicate fulfillment, communicate expected delay, and reconcile pending orders
after recovery.
