# HICO Customer Migration Plan

## Guardrails

PR15.0 is docs and discovery only. It does not start Docker, create customer
tables, change checkout behavior, expose customer endpoints, or migrate JSON
data. Production remains `NO-GO` until ownership and dashboard proofs exist.

Later migration commands must be idempotent, dry-run capable, auditable, and
reversible through an approved JSON adapter or database backup. Reports contain
counts and hashes, never raw customer or fulfillment secrets.

## Delivery order

| PR | Deliverable | Required gate |
| --- | --- | --- |
| PR15.0 | Discovery, contract freeze, data model, inventory, launch blockers | No runtime behavior change. |
| PR15.1 | Customer identity, verified email auth, separate sessions/CSRF | Prove identity-domain separation. |
| PR15.2 | PostgreSQL canonical orders, items, claims, ownership events | Preserve public IDs and six statuses; import/reconcile proof. |
| PR15.3 | Owner-scoped dashboard and secure `/api/user/*` compatibility adapter | IDOR suite and no-mock dashboard proof. |
| PR15.4 | Customer assets/reveal and fulfillment asset projection | Reveal audit, no-store, re-auth tests. |
| PR15.5 | Loyalty ledger, earn/reverse, rules and admin adjustment foundation | Migration 009, idempotency, ownership and reconciliation tests. |
| PR15.6 | Referral rewards, loyalty notifications and anti-abuse | Reward idempotency/reversal and unread notification tests. |
| PR15.7 | Retention/anonymization launch policy | Legal retention decision recorded and verified. |
| PR15.8 | Production readiness and controlled rollout | Staging, security, observability, rollback, approval evidence. |

## PR15.2 staged order import

1. Take immutable backups of source JSON files and record file hashes.
2. Dry-run parse public IDs, allowed statuses, amounts, currency, and counts.
3. Import orders/items into staging tables in a repeatable transaction.
4. Create an ownership event marking all five current legacy orders
   `LEGACY_UNRESOLVED`; do not create a `customer_id` from email matching.
5. Reconcile source/target count, public ID, six-status, item, total, and
   currency parity using aggregate-only evidence.
6. Promote after reviewer approval of reconciliation evidence.
7. Retain the JSON adapter read-only for verified rollback; do not delete source
   files without policy approval.

## Guest claim migration and runtime

Legacy guest orders remain unowned unless explicit trusted evidence exists. New
guest checkout stores immutable contact data. On request it sends a signed email
claim link. The stored token is hashed, expires, is single-use, and is consumed
with its ownership event in one transaction.

Claim requests always return generic `202`. Provider callbacks, matching email,
client-submitted contacts, ICCID, QR allocation, and retry requests cannot
assign ownership.

## Verification and rollback

| Check | Required evidence |
| --- | --- |
| Source integrity | Pre/post file hashes, record counts, parse errors. |
| Order identity | Exact public order ID parity; no duplicates. |
| Status parity | Only the six frozen statuses after import. |
| Snapshot parity | Aggregate item-count/total/currency reconciliation. |
| Ownership | Five remain `LEGACY_UNRESOLVED`; zero email auto-links. |
| Security | Non-owner gets `404 ORDER_NOT_FOUND`; replayed/expired claims fail safely. |
| Rollback | Adapter/database restore drill returns verified pre-cutover state. |

Rollback freezes new customer writes, retains source backups, restores the
approved database backup or routes reads through the read-only JSON adapter,
then reconciles again. It never infers ownership or exposes fulfillment secrets.

## Production blockers

PR15.1 through PR15.3 must prove verified customer auth, transaction-safe order
ownership/claims, and a non-mock owner-scoped dashboard. PR15.7 must record the
legal order/audit retention decision. Local Docker QA cannot waive these gates.
