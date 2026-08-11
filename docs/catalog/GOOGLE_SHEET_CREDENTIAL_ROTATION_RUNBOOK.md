# Google Sheet Credential Rotation Runbook

## Preconditions

- The replacement service account is read-only and limited to the required spreadsheet.
- The Admin operator has the required settings and credential permissions.
- The current integration status and version have been recorded from the masked GET response.
- No credential JSON, private key, or access token is copied into a ticket, shell history, log, or document.

## Rotation procedure

1. Open Admin Settings > Google Sheet Catalog.
2. Confirm the Spreadsheet ID, tab, range, and enabled state.
3. Upload the replacement service account JSON.
4. Complete current-password re-authentication.
5. Wait for the server-side connection test to succeed.
6. Confirm the masked email and fingerprint changed as expected.
7. Run a read-only Sheet preview and verify the expected header and row count.
8. Revoke the old Google service account in Google Cloud only after the new credential is verified.

The server tests the candidate before the database update. The encrypted credential update is version-checked, and the old value remains in place if the candidate test fails. Audit records contain event type, actor, request ID, status, version, and masked fingerprint metadata only.

## Failure handling

If the replacement test fails, do not retry with a credential pasted into a chat or log. Check spreadsheet sharing and the read-only scope, then retry from the Admin form. If the old credential is still valid, the integration remains on the old credential.

If the database write succeeds but a subsequent preview fails, keep the new credential in place, inspect the safe error code, and use the rollback runbook only after confirming the failure is credential-related.

## Post-rotation checks

- GET settings shows masked metadata only.
- Test connection succeeds.
- Preview does not expose private fields.
- Audit events contain no private key, token, or raw request body.
- No browser storage entry contains the credential.
