# Google Sheet Credential Revoke Runbook

## When to revoke

Revoke immediately for suspected key exposure, service-account decommissioning, owner-requested disablement, or an integration that must be taken out of service. Revoke the Google service account in Google Cloud as part of the incident response when exposure is suspected.

## Procedure

1. Open Admin Settings > Google Sheet Catalog.
2. Confirm the masked integration identity and current version.
3. Select Revoke credential.
4. Complete current-password re-authentication.
5. Confirm the status is revoked/disabled and the credential is no longer configured.
6. Verify that Test and Preview return a safe not-configured response.
7. Disable or delete the Google service account in Google Cloud when required.

Revoke clears the encrypted credential, masked identity, fingerprint, and key version in one version-checked database update. It also disables the integration. The event audit contains only safe metadata.

## Emergency response

If re-authentication is unavailable, restrict Admin access and rotate/revoke the Google service account directly in Google Cloud. Do not bypass the Admin re-authentication requirement or edit PostgreSQL credential fields manually. Preserve only timestamps, safe error codes, request IDs, and incident references.

## Recovery

Recovery requires a new read-only service account and follows the rotation procedure. Do not restore a raw credential from a backup into application tables. Restore the encrypted settings database only with the matching encryption key version and an owner-approved change record.
