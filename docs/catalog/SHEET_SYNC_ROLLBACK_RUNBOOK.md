# Catalog Sheet Sync Rollback Runbook

## Preconditions

Keep production `NO-GO` unless the launch owner has approved the incident,
backup verification, alert delivery, and rollback evidence. Do not edit
`catalog_current.json` or provider files manually.

## Procedure

1. Identify the Sheet batch ID and its `catalogVersionId` from the Admin audit.
2. Confirm the public impact and capture redacted values only.
3. Use the existing Admin catalog version rollback API with the target parent
   version and the required catalog rollback permission.
4. Re-run catalog health, public catalog validation, checkout validation, and
   the Product Detail selected-variant check.
5. Mark the Sheet batch as incident-reviewed. Do not replay it until a fresh
   preview confirms the current canonical version.

Provider metadata written by an approved batch is restored by the canonical
rollback transaction's provider snapshot. A fulfillment APN, LPA, PIN, PUK, or
customer asset is never changed by Sheet rollback.

## Duplicate apply or concurrency incident

The batch claim and unique `apply_command_id` ensure only one apply can claim a
reviewable batch. A second request receives `SHEET_SYNC_APPLY_IN_PROGRESS`,
`SHEET_SYNC_CONCURRENCY_CONFLICT`, or an idempotent already-applied response.
Do not manually retry with a different batch until the first result is known.

## Credential revocation

Revoke the service account or remove its Sheet access in the secret manager,
then remove the process environment values and restart the backend. Check that
the Admin screen reports the configuration failure without a stack trace. No
credential is stored in the database or repository.
