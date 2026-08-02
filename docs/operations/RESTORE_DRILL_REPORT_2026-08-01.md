# Restore Drill Report: 2026-08-01

Owner: HICO Operations. Environment: isolated Docker/PostgreSQL QA database.

| Item | Result |
| --- | --- |
| Encrypted backup | Created with AES-256-GCM |
| Backup verification | Passed checksum and authenticated decryption |
| Restore target | Isolated filesystem plus `hico_restore` PostgreSQL database |
| Restored application files | 46 JSON files |
| Auth session policy | All restored sessions revoked |
| Restored backend | Started successfully |
| Admin login | Passed with restored identity data |
| Catalog read-only smoke | Passed |
| Measured duration | 3.21 seconds for backup, verify, and restore; backend smoke completed afterward |

This is a production-like QA drill, not a production RPO/RTO commitment. No
provider request was sent. Follow-up: assign approved production retention,
storage location, and restore-test cadence before launch.
