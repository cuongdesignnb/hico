# HICO PR15.7 - Profile, Addresses, Security and Support Completion

## Completion status

PR15.7 is implemented as an additive customer platform foundation. Source
completion commit: `1eeddb2`. The docs completion commit is the commit with
message `docs(customer): record PR15.7 completion and PR15.8 handoff`.
Production remains `NO-GO`; no production writes or automatic legacy ownership
assignment are authorized.

## Delivered

- Migration head: `011_customer_profile_security_support.sql`.
- PostgreSQL-backed profile read/update with a strict display-field allowlist.
- Hashed, expiring, single-use email contact change; phone change fails closed
  until a real SMS provider is configured.
- Owner-scoped address CRUD with a transaction lock and one-default index.
- Password change, session list/revoke/logout-all, redacted security events,
  audit events, and customer security notifications.
- Owner-scoped support tickets, messages, close flow, order/asset link checks,
  permissioned admin reply/assignment/status actions, internal notes, and
  private attachment storage with content signatures and size/count limits.
- Customer account routes: `/tai-khoan/ho-so`, `/dia-chi`, `/bao-mat`,
  `/ho-tro`, and `/ho-tro/:ticketId`, protected and noindex.
- Health endpoints `/api/health/customer-profile` and `/api/health/support`.
- Read-only profile/support validators and expanded aggregate inventory.

## Feature flags and safety

`.env.example` and compose default `CUSTOMER_PROFILE_ENABLED=false` and
`CUSTOMER_SUPPORT_ENABLED=false`. QA may enable them only in an isolated
project. Support attachments are stored below the private backend directory,
never under the public catalog `/uploads` route. When no malware scanner is
configured, upload audit records `unscanned` risk and makes no scan claim.

## Inventory snapshot

The safe inventory remains: 5 `LEGACY_UNRESOLVED` orders, 2 legacy demo
customer profiles, 1 mock eSIM, 2 mock manual QR records, no persisted
fulfillment/inventory/inventory-movement data, and 0 email auto-links. The
report emits counts and finding codes only; it does not emit email, ICCID,
QR/LPA/PIN/PUK, tokens, or raw attachment keys.

## Verification

- `npm run lint`: pass.
- `npm run build`: pass; existing Vite chunk-size warning remains.
- `npm run prerender`: pass, 88 public routes generated.
- `npm --prefix server test`: pass, 178 tests.
- `npm run customer:inventory`: pass with the snapshot above.
- `npm run security:gate`: pass; the existing React Router advisory remains an
  accepted high-risk baseline item. `npm run integrity:check`: pass.
- Profile/support validators: pass in isolated QA with zero orphan/default/
  sensitive/storage findings. Host-only validator runs are unavailable without
  `DATABASE_URL`.
- `npm audit`: frontend reports the same two accepted React Router advisory
  entries; backend reports zero vulnerabilities. `docker compose config
  --quiet`: pass with QA-only required variables.
- Isolated Docker QA: migration 011 current; backend, frontend, database and
  Mailpit healthy; customer-profile/support health endpoints returned 200;
  project and volume were torn down. Browser console/390px screenshot QA was
  not available because no browser automation runtime is installed.
- Docker is not started for docs/source verification. Existing
  `cuongdesign-*` containers are never touched.

## Handoff to PR15.8

PR15.8 must perform migration/backfill/cutover evidence using fresh runtime
counts, remove demo-mode paths only after proof, verify cross-instance revoke,
support IDOR, attachment privacy, and retain the five legacy orders unresolved.
It must not implement full export/delete or invent legal retention periods.
