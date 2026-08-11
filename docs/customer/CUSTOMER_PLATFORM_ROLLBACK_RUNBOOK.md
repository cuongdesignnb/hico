# Customer Platform Rollback Runbook

## Purpose

Rollback is a controlled recovery action for a failed PR15.8 cutover. It
protects customer ownership and private fulfillment data while returning the
service to a known reviewed database state. It never restores demo mode as a
customer experience.

## Triggers

Start rollback when any of the following is confirmed during the change window:

- customer platform health or migration validation remains unhealthy;
- an ownership, IDOR, claim replay, or private asset reveal regression appears;
- source/target aggregate counts or public order IDs cannot be reconciled;
- backup verification or restore evidence is invalid;
- readiness fails because required production evidence is missing;
- logs show PII, secret, QR, LPA, PIN, PUK, or token exposure.

## Actions

1. Declare the incident and freeze customer writes and private-module changes.
2. Keep `CUSTOMER_ACCOUNT_MODE=real`,
   `CUSTOMER_DEMO_FALLBACK_ENABLED=false`, and
   `LEGACY_CUSTOMER_API_ENABLED=false`.
3. Keep `LOYALTY_ENABLED=false` and `REFERRAL_ENABLED=false`.
4. Preserve the current database and quarantine table before any restore.
5. Restore only the approved encrypted backup to the approved target, using the
   reviewed restore script and session revocation policy.
6. Validate migration head `012_customer_platform_cutover.sql`, ownership
   constraints, quarantine rows, and aggregate order/item parity.
7. Run `npm run customer-platform:validate` and the customer health endpoints.
8. Revoke affected customer sessions when compromise or cross-instance
   inconsistency is possible.
9. Keep `/api/user/*` disabled. Do not redirect writes to a legacy handler.
10. Record the incident, evidence paths, timestamps, approvers, and next action.

The repository helper is dry-run by default:

```text
npm run customer-platform:rollback
npm run customer-platform:rollback -- --execute
```

Execution requires an explicit rollback approval flag. The helper does not
change account mode, delete customer/order/asset/loyalty/referral/notification
data, or remove quarantine evidence. Database restore remains an operator
action against an approved backup and target.

## Verification after rollback

- Customer platform health is either healthy or intentionally fail-closed.
- No demo profile, mock asset, fake fulfillment, or email auto-link is visible.
- Five unresolved legacy orders remain unresolved unless an independently
  approved ownership event exists.
- Public order IDs and the six frozen statuses are unchanged.
- Non-owner access remains `404 ORDER_NOT_FOUND`.
- Sensitive asset responses remain owner-scoped, no-store, audited, and
  re-authenticated where required.
- Backup restore and session revocation evidence is attached to the incident.

Do not resume writes until the release owner, security owner, and operations
owner approve a new cutover window. Production remains `NO-GO` while PR14
Critical evidence is missing.
