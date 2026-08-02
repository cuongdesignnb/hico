# Incident: Admin Authentication Compromise

Severity: Critical. Owner: Security on-call.

Detect from anomalous login/audit activity. Preserve request IDs and redacted
logs, disable affected users, revoke their sessions or all admin sessions, and
rotate active cookie keys with the key-ring grace plan. Do not let a suspected
session delete its audit trail. Verify 401 on revoked sessions, notify affected
operators, document customer impact, and complete a postmortem.
