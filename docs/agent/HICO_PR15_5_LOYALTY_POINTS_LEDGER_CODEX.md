# HICO PR15.5 - Loyalty Points Ledger Completion

## Completion

- Source and QA completion commit: `f5589ea` (`feat(loyalty): add customer points ledger foundation`).
- Migration head: `009_loyalty_ledger.sql`.
- Production remains `NO-GO`; `LOYALTY_ENABLED=false` is the default and no
  production ledger writes were enabled.
- Docker QA used isolated project `hico-pr155-qa`; it was removed with
  `down -v --remove-orphans`. Existing `cuongdesign-*` containers were not
  changed.

## Data model

- `loyalty_accounts`: one customer-owned account row, no mutable balance source
  of truth.
- `loyalty_ledger`: append-only `EARN`, `REDEEM`, `RESERVE`, `RELEASE`,
  `REVERSE`, `ADJUST_ADMIN`, and `EXPIRE` entries.
- `loyalty_rules`: versioned VND/floor rule seed `catalog_fulfillment/v1`.
- Foreign keys protect customer/order ownership. Constraints reject zero points,
  invalid signs and self-reversal. Unique business event/idempotency keys and
  customer/time, order, type and reverse-source indexes are present.
- Balance is `SUM(loyalty_ledger.points)`. There is no direct balance mutation;
  reconciliation reports that no cached balance projection is enabled.

## Runtime contract

- Customer: `GET /api/customer/loyalty`,
  `GET /api/customer/loyalty/transactions?page=&pageSize=`, and
  `GET /api/customer/loyalty/rules/public`.
- Admin: `POST /api/admin/customers/:customerId/loyalty/adjust`, protected by
  admin auth, CSRF, rate limit, production write gate and `loyalty.adjust`.
  Adjustment requires a signed integer, reason and `Idempotency-Key`.
- Health: `GET /api/health/loyalty`; production readiness checks loyalty only
  when the feature flag is enabled.
- Customer responses are owner-scoped, private/no-store and expose safe ledger
  projections only. Public rules omit internal JSON configuration.
- Earn keys are stable per order/item/rule/milestone. Fulfillment events earn
  eSIM/top-up at `PROVISIONED`, physical SIM/device at `SHIPPED`; cancellation
  reversal appends one linked `REVERSE` entry. Unowned or legacy-unresolved
  orders are skipped.
- Redemption, reservation runtime, expiry, tiers, referral rewards and customer
  notifications are not enabled in PR15.5.

## Inventory and reconciliation

The aggregate inventory report remains safe and reproducible:

- 5 legacy orders, all `LEGACY_UNRESOLVED`; zero email auto-links.
- 2 demo customer profiles, 1 mock eSIM and 2 mock manual QR records.
- Fulfillment, inventory and inventory-movement JSON datasets are absent.
- Production loyalty scan reports no fake cash equivalent, wallet wording,
  local points balance, legacy points API reference or direct balance mutation.
- Default local scripts return `DATABASE_REQUIRED` without creating data.
- Docker synthetic test created one owned VND eSIM order, then verified 8
  concurrent earn calls produce 1 `EARN`, 3 concurrent reversal calls produce
  1 `REVERSE`, and ledger balance returns to 0. Synthetic rows were deleted.

## Verification

- Backend: `165/165` tests passed.
- `npm run lint`: pass.
- `npm run build`: pass; prerender generated 88 public routes.
- `npm run security:gate`: pass with the two previously accepted React Router
  advisories; backend audit baseline remains 0 vulnerabilities.
- `npm run integrity:check`: pass.
- `docker compose config --quiet`: pass with QA-only required variables.
- Docker A/B loyalty health: ports 5000 and 5001 both returned 200; migration
  output reported `009_loyalty_ledger.sql` current. During database outage the
  loyalty health endpoint returned 503 and after recovery returned 200.
- UTF-8/no-BOM and raw secret/QR/LPA/PIN/PUK checks remain covered by existing
  inventory/security tests. No new raw sensitive value is committed.
- No authenticated browser session was used for this private feature during QA;
  the existing PR15.4 browser baseline remains the visual baseline. A real
  customer browser smoke test is a follow-up before enabling the feature.

## Risks and handoff

- Production-like fulfillment/inventory persistence is still missing locally;
  real earning remains fail-closed until canonical fulfillment evidence exists.
- Legal retention/anonymization and redemption conversion are unresolved and
  remain production blockers.
- Existing legacy promo/demo sources remain inventory findings and are not a
  loyalty source.
- PR15.6 must add referral attribution/reward events, idempotent and reversible
  referral ledger entries, customer notification/unread delivery, and anti-abuse
  limits. It must not add support/profile scope or infer ownership from email.
