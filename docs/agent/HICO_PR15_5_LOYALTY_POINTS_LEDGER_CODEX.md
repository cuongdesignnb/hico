# HICO PR15.5 - Loyalty Points Ledger Handoff

## Handoff evidence

- Based on final PR15.4 completion commit: `da01e1a`.
- PR15.4 source commits: `ea4ff11` and persistence hardening `ab40fdb`.
- Migration head: `008_customer_assets.sql`.
- Next-phase Markdown: created at `docs/agent/HICO_PR15_5_LOYALTY_POINTS_LEDGER_CODEX.md`.
- Production remains `NO-GO`.

## PR15.4 runtime baseline

- Local inventory contains 5 orders, all `LEGACY_UNRESOLVED`, with no email auto-linking.
- Local legacy sources contain 2 demo customer profiles, 1 mock eSIM and 2 mock manual QR records.
- Local persisted fulfillment, inventory and inventory-movement datasets are absent; production-like customer asset count is therefore 0.
- Local legacy order status counts are 4 `PROVISIONED` and 1 `CANCELLED`. Currency is absent from all five rows, so the safe distribution is `UNKNOWN: 5`.
- QA-only synthetic data verified two owned VND eSIM orders, one visible to each isolated customer. QA data and volume were removed after testing.
- Current source of truth is the owned PostgreSQL order snapshot joined to fulfillment records. No asset table or loyalty ledger exists yet.

## Fulfillment milestones for earn

PR15.5 must use canonical fulfillment/item milestones, not a client callback or dashboard load:

- eSIM and top-up: earn when the item reaches `PROVISIONED`.
- Physical SIM and device: earn when the item reaches `SHIPPED`.
- Cancellation/refund reversal: append a compensating `REVERSE` entry only after a valid canonical event is available.
- `PENDING_CALLBACK`, `PENDING_QR_ASSIGN` and `PENDING_SHIP` do not earn points.
- The source event must include order ID, stable order item ID, canonical item snapshot and the fulfillment milestone. Provider retries must reuse the same idempotency key.

## Existing promo and wallet behavior

- The current storefront validates legacy promo codes through `/api/promos/validate/:code`.
- Admin promo records are stored in the legacy `promos.json` map and managed through Admin promo routes.
- No customer wallet, points balance, reservation, redemption or membership tier exists today.
- The disconnected legacy dashboard includes demo/promo UI. It is not a loyalty source and must not be imported into the ledger.

## Required PR15.5 design

Implement an append-only ledger with a unique idempotency key per order item and earning milestone. Do not use a mutable balance as the source of truth.

- Earn rule: `floor(eligible fulfilled item subtotal / 10,000)` points for positive VND canonical items.
- Eligibility: canonical item, positive price, VND currency, not excluded and not already reversed.
- No cap and no expiry until the owner approves a legal retention/expiry policy.
- Earn-only in the first slice; no membership tier.
- Reversal is an append-only `REVERSE` entry linked to the original earn entry and canonical refund/cancellation event.
- Keep currency separation explicit. Do not convert non-VND values using an invented exchange rate.
- Referral is out of scope for PR15.5 except a minimal schema/event hook if the owner keeps the PR15.0 business decision.

## Redemption and Admin scope

The ledger PR must define reservation state transitions `RESERVE`, `COMMIT`, `RELEASE` with transaction-safe concurrency and idempotency. A failed or expired reservation must not consume points permanently.

Admin adjustment requires explicit permission, actor identity, reason, request ID and audit metadata. Customer points APIs and pages must be owner-scoped and must not expose ledger internals that are not needed by the customer.

## Open decisions before implementation

- Confirm whether partial fulfillment earns per eligible item or only after the entire order is fulfilled. The PR15.4 projection supports per-item milestones, but owner confirmation is required.
- Confirm the canonical refund/cancellation event and whether reversal amount is item-level or order-level.
- Confirm legal retention, export and anonymization policy before adding expiry or deletion behavior.
- Confirm whether non-VND orders remain ineligible or require a separately approved currency ledger.
- Confirm Admin adjustment permission name and maximum operational review requirements.

## Regression and QA baseline

- `npm run lint`: pass.
- `npm run build`: pass.
- `npm run prerender`: pass, 88 public routes.
- Backend baseline after PR15.4: 158/158 tests.
- `npm run customer:inventory`: pass, aggregate-only and no raw PII/secrets.
- `npm run customer-assets:validate`: pass.
- Local order validation requires `DATABASE_URL`; Docker QA supplied the shared PostgreSQL dependency and passed the ownership checks.
- Frontend audit retains the two previously accepted `react-router` advisories; backend audit is 0 vulnerabilities and the repository security gate passes.
- Docker A/B QA passed migration 008, owner isolation, IDOR 404, no-store, re-auth, cross-instance session and database outage/recovery. QA stack was removed with its volume.
- Browser baseline passed 9 desktop/mobile checks with no page errors. New loyalty UI must add customer points routes without prerendering private data.

## Guardrails

- Do not enable production writes or change the production `NO-GO` state in PR15.5.
- Do not import the five unresolved orders, mock eSIM, mock QR records, promo UI, or legacy wallet-like demo state.
- Do not change the six frozen order statuses.
- Keep Docker off outside QA and do not touch `cuongdesign-*` containers.
