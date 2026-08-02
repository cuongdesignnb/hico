# Incident: Secret Leak

Severity: Critical. Owner: Security on-call.

Contain by revoking the exposed provider, webhook, SMTP, database, or backup
credential in its manager; do not paste it into tickets or logs. Preserve scope
evidence, rotate to a new managed version, verify with a safe provider sandbox
or health check, scan source/image/config, and record customer impact and
communications. Never roll back to the leaked credential.
