# Secret Rotation Runbook

1. Create new Worldmove, webhook, session, CSRF, SMTP, and bootstrap-admin
   credentials in the deployment secret manager. Do not place values in source,
   JSON seed files, Docker image layers, or tickets.
2. Update `WORLDMOVE_*`, `WORLDMOVE_WEBHOOK_SECRET`, `SESSION_SECRET`,
   `CSRF_SECRET`, and `SMTP_*` through the deployment environment.
3. Deploy a canary. Confirm `/api/health/security` is healthy, a fresh admin
   login succeeds, protected writes require CSRF, and a signed webhook passes.
4. Revoke the old provider and SMTP credentials. Restart remaining instances
   to invalidate session material derived from the old session secret.
5. Remove `ADMIN_BOOTSTRAP_PASSWORD` after the first administrator is created.
   Production validation treats it as a blocker.
6. Record the rotation actor, time, and secret names in the security audit. Do
   not record secret values or raw tokens.
