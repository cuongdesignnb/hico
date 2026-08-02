# HICO PR15.6 - Referral Rewards and Notifications Completion

## Delivery

- Source commit: `0b8460d` (`feat(customer): add referral rewards and notifications`).
- Migration head: `010_referral_notifications.sql`.
- Backend baseline after delivery: `173/173` tests passed.
- Root checks passed: `npm run lint`, `npm run build`, `npm run prerender`,
  `npm run security:gate`, and `npm run integrity:check`.
- Customer inventory remains aggregate-only: 5 `LEGACY_UNRESOLVED` orders, 2
  demo customer profiles, 1 mock eSIM, 2 mock manual QR records, and no
  persisted fulfillment, inventory, or inventory-movement data. No legacy order
  was linked by email.

## Implemented Contract

- Referral codes are random, normalized `HICO-[A-Z0-9]{12}` values and are not
  identifiers for login, order claim, or ownership.
- A verified customer can apply one active code. Self-referral and matching
  verified email or phone are blocked or sent to `MANUAL_REVIEW` without
  automatic reward issuance.
- Rewards are read from the database rule configuration and are written as two
  `REFERRAL_REWARD` entries in the PR15.5 ledger after the first owned
  qualifying order milestone. Reward references are unique per relationship and
  side.
- Retries are idempotent. Cancellation/refund reversal appends one `REVERSE`
  entry per reward side and never mutates the original ledger entry.
- Customer notifications are PostgreSQL-backed, deduplicated by customer and
  event key, owner-scoped, paginated, unread/read aware, CSRF-protected for
  writes, and filtered to exclude fulfillment secrets or sensitive payloads.
- Admin referral review is permission-gated and requires an auditable reason.
- `REFERRAL_ENABLED=false` and `CUSTOMER_NOTIFICATIONS_ENABLED=false` remain
  fail-closed defaults. Production remains `NO-GO` until the launch gates and
  remaining customer platform work are complete.

## QA Evidence

- Isolated Docker project: `hico-pr156-qa`; no `cuongdesign-*` container was
  changed.
- Fresh PostgreSQL volume applied migrations `001` through `010`. The legacy
  `loyalty_ledger_check1` constraint was removed by migration 010 and the new
  constraint accepts `REFERRAL_REWARD` with positive points.
- Health checks passed for primary and secondary backend, customer auth,
  referrals, customer notifications, and frontend.
- Customer auth Docker QA passed 10 initial checks and 3 restart/persistence
  checks. Primary outage was observed and recovery returned HTTP 200.
- Referral and notification E2E passed with 1 relationship, 2 reward
  references, 2 reward entries, 2 reverse entries, and 7 notifications. Retry
  qualification and reversal were idempotent; cross-owner notification read
  returned `404`.
- `referrals:validate`, `customer-notifications:validate`, and
  `docker compose config --quiet` passed. The isolated project and volumes were
  removed after QA; only the pre-existing `cuongdesign-*` containers remain.

## Boundaries and Follow-up

- No redemption, mutable balance, support/profile implementation, automatic
  legacy order linking, or production enablement was added.
- PR15.7 owns profile and address management, security-event views, support
  handoff, export/delete workflow, retention decisions, and related account
  hardening.
