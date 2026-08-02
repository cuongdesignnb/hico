# HICO PR15.4 - Customer Assets and Secure Reveal Handoff

## Starting baseline

- PR15.3 implementation commit: `686dbbf`
- Migration head: `007_order_ownership.sql`
- Canonical catalog: `catalog-4080debd5f765c41ca08` with 93 products and 21,879 variants.
- Production status: `NO-GO` until customer asset ownership and secure reveal evidence are complete.

## What PR15.3 delivered

- Real customer account routes: `/tai-khoan`, `/tai-khoan/don-hang`, and `/tai-khoan/don-hang/:orderId`.
- Owner-scoped APIs: `GET /api/customer/dashboard/summary`, paginated `GET /api/customer/orders`, and safe order detail.
- PostgreSQL aggregate summary for all owner orders, recent-order projection, masked customer/shipping fields, status/currency totals and pending fulfillment counts.
- Safe projection excludes ICCID, QR/LPA, PIN/PUK, redemption code, provider response and audit data. Private responses use `Cache-Control: private, no-store` and `Pragma: no-cache`.
- Responsive account navigation, summary cards, recent orders, status filter, pagination, detail state, loading/error/empty states and pending polling with 5/10/20/30 second backoff.

## Current asset and fulfillment facts

- Inventory report: 5 orders are `LEGACY_UNRESOLVED`; no order was auto-linked by email.
- Legacy fixtures: 2 demo customer profiles, 1 mock eSIM and 2 manual QR records.
- Persisted fulfillment projection: none. Persisted inventory projection: none.
- Customer asset capability is false by default. No customer list API exposes sensitive assets.
- `src/components/UserDashboard/UserDashboard.tsx` remains a disconnected legacy mock file. Production UserDashboard route count is 0.
- Account production files contain 0 `/api/user` references and 0 hard-coded sensitive asset markers.

## Required PR15.4 decisions

1. Define canonical customer asset projection and ownership join from `orders` and fulfillment records without copying raw provider payloads into customer responses.
2. Define reveal authorization: owner session, CSRF, re-authentication after 10 minutes, append-only audit and `private, no-store` response.
3. Decide how assets become available for `PROVISIONED` eSIM and `SHIPPED` physical items while preserving immutable order snapshots.
4. Keep QR/LPA/PIN/PUK out of list and summary APIs. Add explicit redaction and IDOR tests before enabling any reveal endpoint.
5. Record retention, export and anonymization decisions with the owner; do not invent legal retention periods.

## Verification baseline

- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run prerender`: passed, 88 public routes.
- Backend tests: 155/155 passed.
- Inventory scan: passed with aggregate-only output and no raw PII or secrets.
- Docker QA: dashboard API, PostgreSQL aggregate query, IDOR, no-store and secret redaction passed. QA project was torn down with its volume.
- Browser QA: 9 checks passed on desktop and mobile with no page errors.
- Docker is currently off for HICO QA. The unrelated `cuongdesign-*` containers were not touched.
