# Customer Platform Cutover Runbook

## Scope

This runbook covers the PR15.8 transition from the legacy/demo-compatible
customer surface to the real customer platform. It is for an isolated staging
or approved production change window. It does not authorize production writes.

The cutover is valid only when PR15.1 through PR15.7 evidence is complete,
the PR14 launch checklist has an approved Go/No-Go decision, and the operator
has a fresh aggregate-only inventory report.

## Preconditions

1. Confirm a clean reviewed release artifact and record its commit SHA.
2. Run `npm run customer:inventory` and store the report outside source control.
3. Run the migration validator in dry-run mode. Confirm migration head
   `012_customer_platform_cutover.sql` and no unsafe quarantine metadata.
4. Create an encrypted production-like backup and verify it before any write.
5. Complete an isolated restore drill against a disposable database.
6. Obtain two-person approval for `CUSTOMER_MIGRATION_APPROVED=true` and
   `CUSTOMER_MIGRATION_BACKUP_VERIFIED=true`.
7. Confirm the current inventory still contains five
   `LEGACY_UNRESOLVED` orders. Email matching must produce zero ownership links.

Do not import demo customer profiles, mock eSIMs, manual QR fixtures, or fake
fulfillment records. They are quarantine inputs, not customer data.

## Environment guardrails

The real cutover requires the following values in the deployment secret/config
store. Values shown here are booleans only; never place real secrets in this
document.

```text
CUSTOMER_ACCOUNT_MODE=real
CUSTOMER_DEMO_FALLBACK_ENABLED=false
LEGACY_CUSTOMER_API_ENABLED=false
CUSTOMER_MIGRATION_APPROVED=true
CUSTOMER_MIGRATION_BACKUP_VERIFIED=true
LOYALTY_ENABLED=false
REFERRAL_ENABLED=false
```

Customer auth, profile, support, asset, and notification flags may be enabled
only when their PR15.7 runtime evidence is present. Loyalty and referral remain
disabled in PR15.8 even when their tables are healthy.

## Execution sequence

Run the following sequence against the target environment. The scripts emit
counts, hashes, statuses, and blocker codes; they do not emit customer email,
phone, address, QR, LPA, PIN, PUK, ICCID, or token values.

```text
npm run customer:inventory
npm run customer-platform:migrate
npm run customer-platform:migration:validate
npm run customer-platform:real:verify
```

The migration command is dry-run by default. Execute the quarantine-only
cutover only after approval:

```text
npm run customer-platform:migrate -- --execute
npm run customer-platform:validate
```

Restart the backend and frontend using the reviewed image. Do not run a
second migration manually inside an application container.

## Health and smoke checks

The release is healthy only when all of these checks agree:

- `GET /api/health/customer-platform` returns HTTP 200 and `status=healthy`.
- `GET /api/health/customer-assets` returns healthy without mock assets.
- `GET /api/health/customer-profile` returns healthy with PostgreSQL persistence.
- `GET /api/health/support` returns healthy with private attachment storage.
- Readiness reports current migrations and no demo fallback or legacy API.
- `GET /api/user/orders` returns HTTP 410 with
  `LEGACY_CUSTOMER_API_DISABLED` and deprecation headers.
- Public pages remain available; protected account pages require customer
  authentication and do not render demo data.
- Loyalty and referral endpoints remain explicitly disabled.

Repeat the checks on the secondary backend instance. Test database outage and
recovery in the isolated environment: health must fail closed during outage
and return healthy only after the dependency is recovered.

## Quarantine and ownership policy

The `customer_data_quarantine` table is append-only for the cutover decision.
Each source item is keyed by type and safe source reference. The expected QA
snapshot is ten quarantine rows: two demo profiles, one mock eSIM, two manual
QR records, and five unresolved legacy orders. The exact count must come from
the current report, not this example.

No row may be resolved by matching email, phone, address, ICCID, QR content, or
provider callback. A later owner-approved process must create an explicit
resolution event and preserve the original quarantine row.

## Abort and rollback

Abort before writes when any validator reports a blocker, a count mismatch, an
unexpected import, a missing backup verification, or a production evidence gap.
After cutover, use
`docs/customer/CUSTOMER_PLATFORM_ROLLBACK_RUNBOOK.md`. Rollback preserves real
mode, does not re-enable demo fallback, and never silently relinks an order.

## Exit criteria

The change window closes only after health is green on both instances, backup
and restore evidence is recorded, quarantine counts are reviewed, logs contain
no secret or PII leakage, browser smoke passes at desktop and 390px mobile,
and the incident/on-call owner signs the evidence. Production remains `NO-GO`
until all PR14 Critical launch rows have real evidence and approval.
