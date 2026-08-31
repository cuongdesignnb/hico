# Catalog Sheet Sync Runbook

## Scope

Google Sheets is a read-only reference. Only an authenticated Admin with
`catalog.sheet_sync` may preview, approve, or apply the five mutable field
groups: price, provider linkage, APN hint, network label, and public note.

The canonical catalog remains the source of truth. The connector never writes
cells, comments, formulas, colors, tabs, prices, product IDs, or publish state
back to Google Sheets.

## Configuration

Configure these values through the process environment or a secret manager:

- `CATALOG_SHEET_ID`
- `CATALOG_SHEET_TAB`
- `CATALOG_SHEET_RANGE`
- `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON`

The service account must have `spreadsheets.readonly`. `drive.readonly` is not
needed by the current values-only client. Credentials and access tokens must
never be placed in source, database rows, logs, reports, or `.env` commits.

Missing or invalid configuration returns `SHEET_SYNC_NOT_CONFIGURED` or
`SHEET_SERVICE_ACCOUNT_INVALID` and does not create an empty batch.

## Preview and apply

1. Open Admin, then `Đồng bộ Sheet`.
2. Select `Đọc Sheet` to fetch a new source hash.
3. Review matched variant IDs, row status, and every field-level diff.
4. Select the rows and fields to approve.
5. Confirm `Áp dụng các trường đã chọn`.
6. Re-read the canonical version and public Product Detail.

Rows match only by exact `variant_id`, or exact `product_slug + sku`. Name,
price, duration, data label, row number, and WMID are never fallback match keys.
Blank cells mean no change. `__CLEAR__` is allowed only for APN, network label,
and public note. Formula errors, duplicate targets, ambiguous variants,
provider conflicts, invalid prices, and currency mismatches block the row.

## Troubleshooting

- `UNMATCHED_VARIANT` or `AMBIGUOUS_VARIANT`: correct the immutable identity in
  the Sheet and create a new preview.
- `PROVIDER_NOT_FOUND` or `PROVIDER_OFFER_INCOMPATIBLE`: resolve the provider
  offer in Admin before retrying.
- `PROVIDER_METADATA_CONFLICT`: make APN/network values consistent for the
  shared provider offer, then preview again.
- `SHEET_SYNC_CONCURRENCY_CONFLICT`: create a fresh preview after another
  catalog write changed the canonical version.
- Google API outage: do not retry indefinitely; preserve the last canonical
  version and retry after dependency health recovers.

## Rollback and retention

Apply creates a new canonical version and a catalog audit event. Rollback is
performed through the existing Admin catalog version rollback flow after an
incident review; the Sheet is never used as a rollback writer.

Raw Sheet rows are stored only in the private staging repository needed for
review. Retention duration is intentionally not invented here: the production
owner must set and document `CATALOG_SHEET_SYNC_RAW_RETENTION_DAYS` before
production enablement. Apply audit records follow the existing legal/audit
retention policy. Credentials are never retained.

## Evidence

Keep only redacted evidence: batch ID, Sheet tab/range, row hashes, matched
variant IDs, status counts, approved fields, canonical version ID, and public
payload assertions. Never store raw credentials, access tokens, full Sheet
content, customer data, or fulfillment secrets.
