# HICO PR15.6 - Referral Rewards and Notifications Handoff

## PR15.5 baseline

- Final PR15.5 source/completion commit: `f5589ea`.
- Migration head: `009_loyalty_ledger.sql`.
- Backend baseline: `165/165` tests; lint, build/prerender, security gate and
  integrity checks passed.
- Runtime inventory: 5 `LEGACY_UNRESOLVED` orders, 2 demo profiles, 1 mock
  eSIM, 2 mock manual QR records, and no persisted fulfillment/inventory data.
- Loyalty rules: `catalog_fulfillment/v1` and `admin_adjustment/v1`.
  Earn is 1 point per 10,000 VND with floor, VND only, milestone-gated, with
  no expiry or cap. Redemption is unavailable.
- QA proved migration 009, A/B health, owner-safe ledger behavior, concurrent
  earn/reversal idempotency, outage 503/recovery 200 and full Docker teardown.
- `LOYALTY_ENABLED=false` remains the default. Production is `NO-GO`.

## PR15.6 scope

1. Add explicit referral attribution and qualifying-order state without using
   referral data for login, claim or ownership.
2. Append referral rewards through the PR15.5 ledger with unique reward keys,
   retry-safe writes and valid event-linked reversal.
3. Add customer notifications, unread/read state, safe pagination and delivery
   retry semantics for loyalty/referral events.
4. Add anti-abuse limits, self-referral prevention, account-state checks and
   auditable admin review signals.

## Boundaries

- Reuse customer/admin identity separation and owner-scoped authorization.
- Do not add support/profile work, email-based order assignment, redemption or
  a mutable balance.
- Keep referral rewards disabled until business approval, anti-abuse rules,
  notification delivery and reversal behavior are tested in isolated QA.
- Do not start Docker outside QA and do not touch `cuongdesign-*` containers.
