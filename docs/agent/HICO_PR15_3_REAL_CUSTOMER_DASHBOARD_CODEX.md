# HICO PR15.3 - Real Customer Dashboard

## Handoff baseline

- Final PR15.2 completion commit: `bed4b16bced873b408576f27e506c3a0fb138a1d`
- PR15.2 foundation: `2dd562a`
- PR15.1 customer identity: `57e3079`
- Migration head: `007_order_ownership.sql`
- Production status: `NO-GO`

## Runtime evidence

- Canonical catalog version: `catalog-4080debd5f765c41ca08`
- Canonical source: 93 products and 21,879 variants; checksum and legacy parity passed.
- Frontend build and prerender: passed, 88 public routes generated.
- Backend regression: 151/151 tests passed.
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

## Current customer surface

- Customer auth: `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/dat-lai-mat-khau`, `/xac-thuc-email`.
- Account shell: `/tai-khoan/*` with `CustomerAuthProvider` and `CustomerProtectedRoute`.
- Order APIs now available: `GET /api/customer/orders`, `GET /api/customer/orders/:orderId`, and guest claim request/confirm routes.
- No real order dashboard pages exist yet; the account shell remains intentionally minimal.

## Remaining mock and legacy files

- `src/components/UserDashboard/UserDashboard.tsx` remains a legacy mock source and must not be reconnected.
- Legacy JSON orders, demo customer profiles, mock eSIM data, and manual QR fixtures remain outside Customer production ownership.
- Legacy `/api/user/*` routes are fail-closed and deprecated.

## PR15.3 scope

Build the real owner-scoped dashboard only: summary API, recent orders, list/detail pages, loading/error/empty states, pagination, status and currency display, direct-route refresh, and responsive mobile/desktop behavior. Keep sensitive fulfillment reveal, loyalty, referral, support, and full asset platform out of scope.
