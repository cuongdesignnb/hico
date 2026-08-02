# Canonical Checkout Rollback Runbook

1. Announce the rollback and record the owner, time, reason, and current health response.
2. Set `CHECKOUT_ENGINE=legacy` and restart the backend. Confirm new canonical order creation is disabled.
3. Keep `WORLDMOVE_WEBHOOK_SECRET`, callback route, replay protection, and rate limits active.
4. Verify `GET /api/checkout/orders/:orderId` and retry for existing canonical orders still work from their stored snapshot.
5. List canonical orders in `PENDING_CALLBACK`, `PENDING_QR_ASSIGN`, and `PENDING_SHIP`. Reconcile provider references and idempotency keys before any retry.
6. Do not delete orders, fulfillments, webhook events, replay records, QR assignments, or inventory movements. Do not manually edit a snapshot to change its fulfillment method.
7. Confirm legacy checkout, dashboard reads, callback processing, and alerting. Capture the evidence in the incident record.
8. After recovery, run `npm run checkout:cutover:validate` and schedule a new canary only after every blocker is cleared.
