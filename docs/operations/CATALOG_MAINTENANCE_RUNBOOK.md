# Catalog Maintenance Mode Runbook

## Purpose

Catalog Maintenance Mode is a narrow, temporary write exception for recovery
when the global production readiness state is still `not_ready`. It is not a
production certification and does not change the global readiness gate.

The only writes in this mode are:

- `POST /api/admin/catalog/reset`
- `POST /api/admin/catalog-sheet-sync/:batchId/full-apply`

Quick Apply, Product CRUD, category and variant writes, publish, bulk actions,
rollback, fulfillment, provider, checkout, customer, payment, and unrelated
Admin settings remain protected by the normal production readiness gate.

## Preconditions

1. Confirm the approved branch and maintenance window with the release owner.
2. Confirm the authenticated operator is an explicit `super_admin`.
3. Confirm canonical catalog health is `healthy` and the source is canonical,
   not the legacy reader.
4. Run the read-only reset preview or Full HICO GỐC preview.
5. For Full Sync, keep the preview batch, source hash, header hash, catalog
   version, and provider snapshot hash unchanged until apply.
6. Keep a verified backup and rollback owner available. Do not fabricate a
   pointer, runtime dump, provider snapshot, or fixture to satisfy readiness.

## Enable temporarily

Set this process environment variable on the backend only:

```text
CATALOG_MAINTENANCE_WRITES_ENABLED=true
```

The value is case-sensitive after trimming. `false`, `1`, `TRUE`, an empty
value, or an absent value keep the gate disabled. The UI status endpoint only
reports the masked state; it cannot enable the mode.

After the operation, set the value back to `false` and restart the backend.
Do not commit `.env`, credentials, runtime catalog files, or production data.

## Operator flow

1. Open Catalog Admin and confirm `Catalog Maintenance: Đã bật`.
2. Run a fresh read-only preview.
3. Review the preview and resolve all blocking rows before apply.
4. Enter the current Admin password when the action is confirmed.
5. Apply exactly one approved reset or Full Sync operation.
6. Verify the resulting canonical version, health, audit event, public catalog,
   Product Detail, and preserved media/content references.
7. Confirm global production readiness is still reported independently.
8. Disable the environment flag and restart the backend.

If the flag is disabled, write calls return the dedicated
`CATALOG_MAINTENANCE_DISABLED` response and the UI shows:
`Chế độ bảo trì Catalog chưa được bật trên server.`

## Safety guarantees

- Normal Admin authentication, CSRF, permission checks, rate limits, audit,
  and route re-authentication remain active.
- Reset creates a new versioned empty catalog and preserves media, orders,
  customer data, provider offers, manual QR records, and old versions.
- Full Sync uses the existing atomic/versioned flow and does not write back to
  the Sheet. Stable IDs and existing media, description, and installation
  guide enrichment follow the existing service contract.
- Every accepted maintenance write is auditable with
  `maintenanceMode: true` and the evaluated global readiness state when the
  request reaches the audit middleware.

## Evidence and rollback

Record only redacted evidence: operator, timestamp, route, preview/batch ID,
source and canonical hashes, result version, health result, audit event, and
the final disabled state. Never record passwords, service-account JSON,
tokens, raw Sheet rows, customer data, or runtime dumps.

If verification fails, stop further writes, disable maintenance mode, preserve
the generated version and audit evidence, and use the existing reviewed
catalog rollback runbook. Do not use this gate to bypass a production blocker
or to perform a live provider/checkout test.
