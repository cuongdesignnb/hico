# Canonical Checkout Cutover Runbook

This runbook is for a controlled production cutover. It does not create fake catalog, provider, QR, or inventory data in production.

## 1. Preflight

1. Confirm `CATALOG_READ_SOURCE=canonical`, `CATALOG_CANONICAL_FALLBACK=false`, and `CHECKOUT_ENGINE=canonical`.
2. Run `npm test`, `npm run lint`, `npm run build`, `npm run checkout:parity`, and `npm run checkout:cutover:validate`.
3. Confirm `GET /api/health/catalog` and `GET /api/health/checkout` are healthy. A 503 is a hard stop.
4. Confirm all seven fulfillment strategies are registered and the report has one eligible fixture per strategy.
5. Confirm Worldmove credentials are rotated, the production webhook secret is in the secret manager, and the callback route is reachable.
6. Confirm active provider offers, physical inventory, and manual QR inventory are real and reconciled. Do not use orphan or legacy QR records as fixtures.
7. Run `npm run checkout:backup` and then `npm run checkout:backup:verify`. Retain the encrypted backup according to the production retention policy.
8. Confirm admin authentication, role checks, rate limits, body limits, alerting, dashboards, on-call owner, and rollback owner.

## 2. QA and staging

1. Use only temporary data labelled `QA-CUTOVER-*` in local, Docker, or staging environments.
2. Execute one valid checkout for each strategy, duplicate checkout replay, provider callback replay, QR reservation race, stock reservation race, timeout retry, and negative inventory check.
3. Verify the supported order statuses remain `PROVISIONED`, `SHIPPED`, `PENDING_SHIP`, `PENDING_QR_ASSIGN`, `PENDING_CALLBACK`, and `CANCELLED`.
4. Delete every QA order, fulfillment, idempotency, replay, event, QR, and inventory fixture after the run. Verify real catalog, provider, legacy, and orphan QR data were unchanged.

Staging and production canary execution is not implied by this repository. Record the environment, operator, time, and evidence when those environments are available.

## 3. Canary

1. Enable `CHECKOUT_ENGINE=canonical` for the canary scope.
2. Check the checkout health endpoint before creating an order.
3. Create one monitored order per eligible strategy and confirm the snapshot contains product, variant, SKU, price, currency, quantity, and fulfillment method.
4. Monitor fulfillment states, provider references, replay events, idempotency conflicts, duplicate QR assignment, negative stock alerts, and side-effect markers.
5. Confirm legacy orders and canonical orders remain readable from the dashboard.

## 4. Cutover decision

Proceed only when the validation report has no blockers, backup verification has passed, secrets and active offers are confirmed, and the rollback owner acknowledges the change. If any production blocker remains, keep checkout creation disabled or keep the legacy engine explicitly configured.

## 5. Rollback

Set `CHECKOUT_ENGINE=legacy` and restart only the checkout backend. Keep the webhook route and signature secret active. Existing canonical orders must continue using their stored snapshot and `fulfillmentMethod`; do not rewrite them as legacy orders and do not delete fulfillment, replay, event, or inventory records.
