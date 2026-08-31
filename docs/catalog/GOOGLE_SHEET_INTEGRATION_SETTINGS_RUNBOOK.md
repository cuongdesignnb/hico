# Google Sheet Integration Settings Runbook

## Scope

This runbook covers the read-only Google Sheet catalog reference integration. The integration is not a catalog write source. Preview and apply remain separate Admin actions, and apply requires the existing catalog approval flow.

## Configuration order

The effective configuration is selected in this order:

1. Admin Settings, when a stored integration credential exists.
2. Environment fallback, when `CATALOG_SHEET_ID`, `CATALOG_SHEET_TAB`, `CATALOG_SHEET_RANGE`, and `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON` are complete.
3. No configuration.

Admin Settings values are stored in PostgreSQL. Service account JSON is encrypted with AES-256-GCM using `INTEGRATION_SETTINGS_ENCRYPTION_KEY`. The key is supplied to the backend only through the runtime environment and is never stored in PostgreSQL.

## First setup

1. Confirm migration `014_catalog_sheet_integration_settings.sql` has been applied.
2. Open Admin Settings and select Google Sheet Catalog.
3. Enter the Spreadsheet ID, tab name, range, and header row. Keep reference-only and approval-required enabled.
4. Upload a service account JSON document with only the Google Sheets read-only scope.
5. Re-enter the current Admin password when prompted. The server tests access before storing the encrypted credential.
6. Select Test connection and verify the masked status and sampled row metadata.
7. Enable the integration only after the test succeeds.
8. Use Preview from the Sheet Sync screen. Review and approve separately before Apply.

## Operational guardrails

- No write scope, Drive scope, OAuth token, private key, or full credential is accepted by the UI response.
- The browser does not persist credential text in localStorage, sessionStorage, IndexedDB, or URL state.
- GET responses contain masked metadata only.
- QR, LPA, PIN, PUK, redemption code, and fulfillment data are not part of the Sheet preview contract.
- Scheduled sync is disabled in this release.
- A failed connection test does not replace or delete the existing credential.

## Troubleshooting

`GOOGLE_SHEET_NOT_CONFIGURED` means the integration is disabled or no complete source is available. `GOOGLE_SHEET_SETTINGS_REQUIRED` means the Spreadsheet ID, tab, or range must be saved before credential setup. Google permission, not-found, and rate-limit failures are returned as safe error codes without provider response bodies.

If the encryption key is missing or weak, the settings API must remain unavailable. Do not generate a replacement key on a running production instance without following the rotation and rollback runbooks.

## Verification

Run the backend integration tests, `npm run security:gate`, `npm run integrity:check`, and the normal frontend gates. Live Google access requires an owner-approved read-only credential and is not represented by automated tests.
