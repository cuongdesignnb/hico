# PR15.1 Customer Identity and Authentication Report

## Result

PR15.1 implements isolated Customer identity/authentication. It does not assign
orders, import demo profiles, expose mock eSIM/QR assets, or build a real
Customer dashboard. Production remains NO-GO.

## Schema and APIs

Migration 006_customer_identity.sql adds Customer identity, profile, session,
email verification, password reset, security-event, and address tables with
normalized-email, customer/session, token-expiry, and phone indexes. Admin
tables and cookies remain unchanged.

Customer routes provide register, login, logout, refresh, email verification,
password reset, GET /api/customer/me, session list/revoke, logout-all, and safe
health. Customer cookies are hico_customer_session and hico_customer_csrf.
Client-supplied account type, role, permission, and Customer ID are ignored.

## QA evidence

The isolated hico-pr151-qa Docker project ran PostgreSQL, Mailpit, and two
backend instances. It passed register/verify, cross-instance session use,
concurrent refresh single-successor behavior, restart persistence,
cross-instance logout, Customer-to-Admin isolation, database outage
fail-closed health, and recovery. Aggregate QA counts were 1 Customer,
2 sessions, 1 verification, 0 resets, and 6 security events. The project and
volume were removed after QA.

Repository inventory remains 5 LEGACY_UNRESOLVED orders, 2 demo profiles,
1 mock eSIM, 2 mock manual QR, and missing persisted fulfillment/inventory.

## Remaining blockers

PR15.2 must establish order ownership and guest claims. PR15.3 must replace the
account shell with a persisted owner-scoped dashboard. Production evidence,
legal retention decision, and all existing launch controls remain outstanding.
