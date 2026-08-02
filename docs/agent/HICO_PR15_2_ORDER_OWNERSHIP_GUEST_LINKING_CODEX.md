# HICO PR15.2 - Order Ownership and Guest Linking

## Objective

Implement canonical PostgreSQL order ownership, authenticated checkout linkage,
guest signed-email claims, ownership audit, and owner-scoped Customer order APIs.
Do not build the full dashboard in this phase.

## Runtime context

- Baseline: PR15.1 committed as 57e307991617db4442e6c14dc4f118dcb6e9f96e.
- Customer schema head: 006_customer_identity.sql.
- PR15.1 modules: server/customer, customer auth API routes, CustomerAuthProvider,
  CustomerProtectedRoute, CustomerGuestRoute, and the account shell.
- Current Customer APIs: register, login, logout, refresh, email verification,
  password reset, session management, GET /api/customer/me, and health.
- Isolated Docker QA used PostgreSQL and two backends. Before teardown it had
  1 customer, 2 sessions, 1 verification, 0 resets, and 6 security events.
- Repository inventory remains 5 LEGACY_UNRESOLVED orders, 2 demo profiles,
  1 mock eSIM, 2 mock manual QR, and no persisted fulfillment/inventory data.
- Baseline backend suite: 151 passing tests before PR15.2.

## Scope

1. Add PostgreSQL orders, order_items, guest_order_claims, and append-only
   order_ownership_events.
2. Preserve public order IDs and the six existing statuses.
3. Bind authenticated checkout only from the validated Customer session.
4. Support hashed, expiring, single-use guest email claims consumed in a
   transaction with the ownership event.
5. Keep all five legacy JSON orders LEGACY_UNRESOLVED. Never auto-link by email,
   ICCID, browser state, QR allocation, or callback data.
6. Add owner-scoped Customer order reads. A non-owner receives 404
   ORDER_NOT_FOUND.
7. Remove public checkout order lookup from the Customer contract and move retry
   fulfillment to a permissioned Admin operation.
8. Keep JSON only as import/rollback adapter and report aggregate reconciliation.

## Out of scope

Full dashboard UX, sensitive fulfillment reveal, loyalty/referral, demo profile
import, legacy auto-linking, production launch, and retention-policy decisions.

## Data, API, and security

The next advisory-lock migration must be idempotent and preserve all Admin and
Customer identity tables. Import needs dry-run, source/target count and hash
reconciliation, rollback adapter evidence, and forward-fix rules. Do not delete
legacy JSON.

Freeze the Customer order/claim routes in CUSTOMER_API_CONTRACT.md. Claim
request is generic 202; claim consume requires Customer auth. Customer identity,
not client-supplied IDs or email, authorizes every operation. Provider callbacks
may update fulfillment/status but cannot modify ownership.

## Frontend

Do not reintroduce the mock UserDashboard. PR15.2 may add a minimal order API
client only after owner-scoped persisted data exists.

## Tests and acceptance

Test migration reruns, five unresolved orders, no auto-links, session-bound
checkout, claim expiry/replay/race, cross-customer IDOR, callback ownership
protection, status/public-ID snapshot parity, reconciliation/rollback, and full
PR15.1/Admin/catalog/checkout/fulfillment regression.

PR15.2 is complete only when PostgreSQL ownership is canonical, claims are
transaction-safe, legacy orders remain unresolved, and non-owner access returns
404 ORDER_NOT_FOUND.

## Risks and handoff

Order ownership and IDOR remain Critical. Legal retention remains a PR15.7
blocker. On PR15.2 completion create
docs/agent/HICO_PR15_3_REAL_CUSTOMER_DASHBOARD_CODEX.md from the actual runtime
state; do not mark the next handoff complete before that file exists.
