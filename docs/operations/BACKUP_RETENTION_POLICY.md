# Backup Retention Policy

The values below are proposed defaults and require owner approval before a
production launch. Do not invent a production RPO or RTO without a measured
restore drill.

| Item | Proposed policy | Owner |
| --- | --- | --- |
| Frequency | Daily encrypted application/auth backup; pre-migration backup | Operations owner |
| Retention | Approve a documented business retention schedule before launch | Data owner |
| Location | Separate restricted backup storage account | Platform owner |
| Encryption | AES-256-GCM archive key separate from storage credentials | Security owner |
| Session restore | Revoke all sessions after restore unless timeline consistency is proven | Security owner |
| Restore test | Scheduled isolated restore drill | Operations owner |

`BACKUP_ENCRYPTION_KEY` is injected at runtime and never stored in a backup,
manifest, image, source file, or log. A failed backup or verification must
create an operational alert and keeps the production readiness gate closed once
the verification age exceeds policy.
