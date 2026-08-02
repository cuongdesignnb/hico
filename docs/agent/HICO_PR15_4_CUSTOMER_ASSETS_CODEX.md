# HICO PR15.4 - Customer Assets Completion and PR15.5 Handoff Baseline

## Commits and migration

- PR15.3 source: `686dbbf`.
- PR15.4 source: `ea4ff11` (`feat(customer): add customer asset platform`).
- PR15.4 completion and QA documentation is committed separately after this source baseline.
- Migration head: `008_customer_assets.sql`.
- The migration adds `customer_sessions.last_authenticated_at` and an index for recent re-authentication. No duplicate customer asset table was added because the current fulfillment projection is read safely from owned PostgreSQL order snapshots plus fulfillment records.
- Production status remains `NO-GO`.

## Delivered runtime contract

- `GET /api/customer/assets/summary` returns per-module totals and an explicit `available` map. Dashboard asset capability is derived from that map, never from a hard-coded count.
- `GET /api/customer/esims` and `GET /api/customer/esims/:esimId` return owner-scoped metadata only. ICCID is masked; QR, LPA, PIN, PUK, redemption code and provider payloads are absent.
- `POST /api/customer/esims/:esimId/reveal` requires the customer session, CSRF, owner-scoped lookup, a recent authentication within `CUSTOMER_REAUTH_WINDOW_MINUTES` (default 10), rate limiting and safe audit metadata. Response headers are `Cache-Control: private, no-store`, `Pragma: no-cache`, and `Expires: 0`.
- `GET /api/customer/physical-sims`, `/api/customer/devices`, `/api/customer/topups` and corresponding detail routes use the same ownership boundary. Missing tracking, warranty, serial, activation and expiry values remain `null` or unavailable; no value is inferred.
- Customer re-authentication is `POST /api/customer/auth/reauth`; customer and Admin cookies remain separate.
- `/api/user/*` remains a deprecated 410 fail-closed boundary. The new Account pages do not call it.
- Service worker caching excludes both `/api/*` and `/tai-khoan/*`.

## Source and projection rules

- Ownership is only `order.customerId -> session.customerId` with `ownershipStatus=OWNED`. Email, phone, ICCID, IP, device and QR filenames are never claim keys.
- Asset type derives from canonical item operation/medium/fulfillment method. Fulfillment records are the source for secrets, provider references, tracking and completion state. Order snapshots supply immutable product, coverage, quantity, price and currency history.
- Unassigned QR pool, orphan records, `LEGACY_UNRESOLVED`, guest orders and mock/demo/sample records are excluded.
- Projection IDs are deterministic per order item and asset type, so callback retry and process restart do not create a second customer asset.

## Backfill and validation

- `npm run customer-assets:backfill` is dry-run by default and never writes source data. `--write-report` writes an aggregate report under `server/uploads/migration_reports/` without PII or secrets.
- `npm run customer-assets:validate` checks ownership, duplicate source references, raw-secret redaction, mock exclusion and integrity flags. It passed with asset mode disabled in the local baseline.
- `008_customer_assets.sql` is the only new migration. There are no asset tables, raw-secret indexes or plaintext asset backups.

## Current data facts

- Local inventory: 5 orders, all `LEGACY_UNRESOLVED`; auto-linked by email: 0.
- Legacy demo sources: 2 customer profiles, 1 mock eSIM, 2 mock manual QR records.
- Fulfillment file: missing. Inventory and inventory movements: missing. Persisted production-like customer asset count: 0.
- Legacy order status distribution: 4 `PROVISIONED`, 1 `CANCELLED`; currency is absent in all 5 JSON legacy rows (`UNKNOWN: 5`).
- Local backfill dry-run is `DATABASE_URL_REQUIRED`, so it reports no created assets rather than inventing counts.
- QA-only synthetic projection verified 2 owned eSIM orders across two customers; each customer saw 1 asset and the other customer returned 404 on detail/reveal access. QA rows and volume were removed.

## Existing promotion and wallet behavior

- The existing surface has legacy promo-code validation and Admin promo CRUD backed by `promos.json`.
- No customer wallet, points ledger, redemption reservation or membership tier is implemented in this PR. The disconnected legacy dashboard contains promo/demo UI and is not a customer asset source.

## Verification

- `npm run lint`: pass.
- `npm run build`: pass.
- `npm run prerender`: pass, 88 public routes; private asset routes are not prerendered.
- Backend tests: 155 existing tests pass, plus PR15.4 projection/reveal tests pass; current full baseline is 157 tests after the added asset test file.
- `npm run customer:inventory`: pass; UTF-8 aggregate-only scan, 0 Account `/api/user` references, 0 hard-coded asset values.
- `npm run customer-dashboard:validate`: pass.
- `npm run customer-assets:validate`: pass.
- `npm run customer-orders:validate` and `migration:status` require `DATABASE_URL` in a local shell; the isolated Docker QA database ran both ownership queries and migration head checks successfully.
- Root `npm audit --omit=dev` reports the two previously accepted `react-router` advisories; backend `npm --prefix server audit --omit=dev` is 0 vulnerabilities and `npm run security:gate` passes with those two findings explicitly accepted.
- `git diff --check`: pass.
- Docker QA: isolated PostgreSQL, migration runner, Mailpit and Backend A/B passed migration 008, summary/list/detail, cross-instance session, IDOR 404, no-store, reveal, re-auth 428, and database outage 503 to recovery 200. QA project `hico-pr154-qa` was removed with its volume.
- Browser baseline from PR15.3 remains 9 desktop/mobile checks with no page errors. The PR15.4 account routes are protected and use the same private account shell; a production customer browser run remains blocked by the default disabled asset mode and no persisted local customer data.
- Only `cuongdesign-web`, `cuongdesign-ai-worker` and `cuongdesign-db` remain running.

## Risks and next phase

- Five legacy orders remain unresolved and are never auto-assigned.
- Provider usage API, legal retention/anonymization decisions and production asset persistence readiness remain open blockers.
- Loyalty, referral, wallet, support and production launch remain out of scope.
- Next-phase Markdown is created at `docs/agent/HICO_PR15_5_LOYALTY_POINTS_LEDGER_CODEX.md` and must use the final PR15.4 documentation commit SHA below.
