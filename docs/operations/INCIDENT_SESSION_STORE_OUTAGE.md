# Incident: Session Store Outage

Severity: High. Owner: Platform on-call.

Detect through session-store health/readiness and error-rate alerts. Keep admin
writes closed, preserve public reads where safe, capture redacted database
health evidence, restore connectivity/pool capacity, then verify login across
two instances, logout revocation, cleanup, and production readiness before
reopening writes. Communicate operator impact and create follow-ups.
