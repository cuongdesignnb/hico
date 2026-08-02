# Incident: Pending Orders

Severity: High. Owner: Fulfillment owner.

Detect pending count/age threshold alerts. Segment by fulfillment state and
provider, preserve request IDs, avoid duplicate retries, use existing retry
controls, verify stock/QR availability, communicate customer impact, and close
only after state transitions and fulfillment references pass integrity checks.
