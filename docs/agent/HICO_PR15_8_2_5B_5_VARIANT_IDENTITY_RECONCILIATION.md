# HICO PR15.8.2.5B.5 Variant Identity Reconciliation

## Scope and guardrails

This increment adds a read-only reconciliation report and an explicit admin confirmation flow for the bounded `Sim HICO` preview. It does not edit the Google Sheet, rename canonical SKUs, create variants, write back to the provider, or use `wmproductId` as a runtime variant key. Automatic apply remains disabled.

The bounded source is spreadsheet `SDL DL.HICO.VN`, tab `Sim HICO`, range `A1:AP20`. The report is admin-only and returns the row number, medium, Sheet SKU, normalized SKU, provider identifier, price, duration, data type, APN, network label, candidate variants, evidence, conflicts, and unmatched reason. It does not return raw rows or credentials.

## Identity resolution contract

1. Direct canonical SKU plus medium is attempted first.
2. An ACTIVE external alias for the exact normalized Sheet SKU plus medium is attempted next.
3. Otherwise the candidate is unmatched.

If a direct canonical target and an alias point to different variants, resolution fails with `IDENTITY_CONFLICT`. Revoked aliases are ignored. WMID is used only to produce an admin suggestion through provider-offer links; zero, one, or multiple provider candidates are reported as `NO_PROVIDER_CANDIDATE`, `SUGGESTED`, or `AMBIGUOUS_PROVIDER_CANDIDATE`. There is no fuzzy or row-number matching.

## Repository audit

The audit searched for `legacySku`, `sourceSku`, `externalSku`, `externalId`, `legacyVariationId`, `providerOfferId`, `wmproductId`, `aliases`, `importMetadata`, and `sourceMetadata`.

- Reusable external-alias repository: **NO**.
- Reusable canonical PostgreSQL variant table for a foreign key: **NO**. Canonical products and variants are versioned JSON under the canonical catalog repository.
- Reusable provider-offer link: **YES**, via canonical `providerOfferId` and provider-offer `wmproductId`; it is suggestion evidence only.
- Migration required: **YES**, `015_catalog_variant_external_aliases.sql`.

Because canonical variants are JSON today, `variant_id` is validated against the active canonical snapshot in the service. The migration deliberately does not create a misleading foreign key to a table that does not exist. The alias table has a unique key on namespace, normalized external key, and medium; REVOKED rows preserve history in the same versioned row plus an event table. Exact retries for the same active target return the existing alias; a different target is rejected. Version checks protect remap and revoke operations.

## Admin API and UI

- `GET /api/admin/catalog/sheet-reconciliation/unmatched`
- `GET /api/admin/catalog/sheet-reconciliation/:candidateId/candidates`
- `POST /api/admin/catalog/variant-aliases`
- `PATCH /api/admin/catalog/variant-aliases/:id`
- `POST /api/admin/catalog/variant-aliases/:id/revoke`

All routes rely on the existing admin session, CSRF, rate limit, production guard, audit middleware, and the new `catalog.sheet.reconcile.read/write` permissions. The UI is a separate `SheetVariantReconciliation` component. A mapping is persisted only after the operator selects a canonical candidate and confirms it.

## QA status

- Docker: not started for this docs/code increment; keep Docker OFF until live QA is explicitly needed.
- Live Sheet reconciliation: pending a new bounded preview after the alias migration and an authorized admin QA session.
- Worldmove: no new provider call was made.
- Production: **NO-GO** until bounded mapping, repeat/idempotency, multi-instance, rollback, public leak, cart, and Product Detail checks are completed.
