# HICO PR15.3 - Real Customer Dashboard

## Completion baseline

- PR15.3 implementation commit: `686dbbf`
- Final PR15.2 completion commit: `bed4b16bced873b408576f27e506c3a0fb138a1d`
- PR15.2 foundation: `2dd562a`
- PR15.1 customer identity: `57e3079`
- Migration head: `007_order_ownership.sql`
- Production status: `NO-GO`

## Runtime evidence

- Canonical catalog version: `catalog-4080debd5f765c41ca08`
- Canonical source: 93 products and 21,879 variants; checksum and legacy parity passed.
- Frontend build and prerender: passed, 88 public routes generated.
- Backend regression: 155/155 tests passed, including projection redaction, aggregate summary and inventory surface tests.
- Backend production dependency audit: 0 vulnerabilities.
- Final ownership validator: 5 orders, 0 owned, 0 guest-unclaimed, 5 legacy-unresolved, 0 manual-review, 0 conflicts.
- Final database snapshot during QA: 2 customer rows, 5 ownership events, 0 claim tokens remaining after cleanup.

## Docker and security QA

- Isolated topology passed with PostgreSQL, Mailpit, frontend, and backend instances on ports 5000 and 5001.
- Migration status was current for migrations 001 through 007.
- Customer auth passed cross-instance session, refresh replay, restart persistence, logout, and Admin isolation checks.
- Ownership QA passed authenticated owner list/detail, cross-customer IDOR returning 404, hashed claim token storage, Mailpit claim delivery, and concurrent claim with one winner.
- PostgreSQL outage returned customer-orders health 503; recovery returned 200 without restarting the full stack.
- QA rows and claim tokens were removed; the five legacy orders remained `LEGACY_UNRESOLVED`.
- QA project `hico-pr152-qa` and its volume were removed. `cuongdesign-*` containers were not touched.

## Delivered customer surface

- Customer auth: `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/dat-lai-mat-khau`, `/xac-thuc-email`.
- Account dashboard: `/tai-khoan`, `/tai-khoan/don-hang`, `/tai-khoan/don-hang/:orderId` with `CustomerAuthProvider` and `CustomerProtectedRoute`.
- Dashboard APIs: `GET /api/customer/dashboard/summary`, paginated `GET /api/customer/orders`, and safe owner-scoped detail.
- Summary counts and totals use a PostgreSQL owner aggregate; recent orders and details use a strict safe projection.
- Private responses use `private, no-store`; IDOR returns `404 ORDER_NOT_FOUND`; QR/LPA/PIN/PUK/provider/audit fields are excluded.
- Account UI has loading, error, empty, status filter, pagination, responsive navigation and pending refresh backoff.

## Remaining mock and legacy files

- `src/components/UserDashboard/UserDashboard.tsx` remains a legacy mock source and must not be reconnected.
- Legacy JSON orders, demo customer profiles, mock eSIM data, and manual QR fixtures remain outside Customer production ownership.
- Legacy `/api/user/*` routes are fail-closed and deprecated.

## QA evidence

- Inventory: 5 legacy orders classified `LEGACY_UNRESOLVED`, 2 demo profiles, 1 mock eSIM, 2 manual QR, no persisted fulfillment or inventory projection, and no email auto-linking.
- Production surface scan: UserDashboard route 0, `/api/user` references in account production files 0, sensitive hard-coded fields in account production files 0. The old mock file remains disconnected for later cleanup.
- Docker QA passed dashboard summary/list/detail, no-store headers, IDOR, secret redaction and aggregate query execution on PostgreSQL. QA project and volume were removed; only `cuongdesign-*` containers remain.
- Browser QA passed 9 checks on desktop and mobile: dashboard render, empty orders, detail error state, responsive navigation and zero page errors.

## Remaining scope

Keep sensitive fulfillment reveal, loyalty, referral, support and production launch out of scope. PR15.4 should discover and implement the asset read model only after ownership, re-authentication, CSRF, audit and no-store reveal contracts are reviewed.
