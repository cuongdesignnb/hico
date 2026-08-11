# Google Sheet Settings Rollback Runbook

## Rollback boundary

Rollback applies to integration settings and credential state only. It must not revert catalog rows, canonical product data, fulfillment data, or unrelated Admin settings. A Sheet preview or Apply is not automatically undone by this runbook.

## Preferred rollback

1. Disable the integration in Admin Settings.
2. If the issue is a new credential, use Revoke and then rotate to a known-good read-only credential.
3. Re-run Test connection.
4. Confirm the Sheet Sync screen reports the expected safe status.
5. Record the masked version, timestamps, event type, and safe error code in the change record.

The environment fallback is not an automatic credential migration. It is available only when its complete configuration is present and Admin Settings has no stored credential. Do not copy environment secrets into the Admin form or database by hand.

## Database recovery

Database restore is an incident-level operation. Before restoring, verify the backup timestamp, the matching `INTEGRATION_SETTINGS_ENCRYPTION_KEY` version, and the owner approval. Restore only the integration settings rows and audit history needed for the incident. Never print or export `encrypted_credential`, decrypted JSON, private keys, or provider tokens.

After restore, verify:

- the migration head includes `014_catalog_sheet_integration_settings.sql`;
- the integration is disabled until a connection test succeeds;
- the masked status matches the approved state;
- the version and audit event history are consistent;
- Sheet Sync preview remains read-only and approval-gated.

## Production guardrail

Production remains NO-GO until live read-only credential QA, owner approval, security evidence, and the broader PR15 launch blockers are complete. Docker QA must use the HICO project name and must not stop, remove, or modify any `cuongdesign-*` container.
