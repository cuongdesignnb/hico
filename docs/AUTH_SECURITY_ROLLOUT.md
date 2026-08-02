# Auth and Security Rollout

## Session model

HICO uses server-side opaque sessions. The browser receives a short-lived
HttpOnly `hico_admin_session` cookie and a separate CSRF cookie. The server
stores only a hash of the session token and can revoke it immediately on
logout, expiry, disabled account, or password change. No auth token, role, or
permission is stored in browser local storage.

## Bootstrap

For an empty local auth store, set `ADMIN_BOOTSTRAP_EMAIL` and a password of at
least 12 characters through the environment. It creates one `super_admin` only
when no admin exists. Remove the bootstrap password immediately afterward.

## Production limits

The current repository-backed auth store is appropriate for local and
single-instance deployment QA only. Production must replace it with a shared
database/session store before public launch; otherwise the deployment must keep
admin writes disabled. Production validation also requires HTTPS public origin,
strong session and CSRF secrets, a non-wildcard CORS allowlist, and a webhook
secret.

## Rollback

Deploy the prior application artifact only after revoking sessions created by
the new deployment. Do not restore frontend localStorage auth: it is not a
security rollback path. Keep provider credential rotation independent from an
application rollback.
