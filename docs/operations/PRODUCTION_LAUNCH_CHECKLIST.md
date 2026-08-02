# HICO Production Launch Checklist

This is an evidence register, not a plan. Every row must have a real evidence
reference, owner, approver, and UTC timestamp. Local or production-like QA does
not satisfy a production row. Allowed statuses are `NOT_STARTED`, `IN_PROGRESS`,
`BLOCKED`, `PASS`, `FAIL`, and `RISK_ACCEPTED`.

| ID | Category | Check | Criticality | Status | Evidence | Owner | Approver | Timestamp | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DOM-01 | Domain/TLS | DNS, certificate chain, expiry, renewal and HTTPS redirect | Critical | BLOCKED | Required: `PRODUCTION_DOMAIN_EVIDENCE_PATH` | Platform owner | - | - | No production domain evidence in workspace |
| DOM-02 | Domain/TLS | HSTS, canonical URLs, sitemap, robots and direct routes | Critical | BLOCKED | Required: `PRODUCTION_DOMAIN_EVIDENCE_PATH` | Platform owner | - | - | Must use the real HTTPS origin |
| SEC-01 | Secrets | Secret-manager versions deployed and old credentials revoked | Critical | BLOCKED | Required: `SECRET_ROTATION_METADATA_PATH` | Security owner | - | - | Metadata must include revocation timestamps |
| SEC-02 | Secrets | No default/demo secret in runtime, source, API, logs or backup | Critical | IN_PROGRESS | `server/scripts/verifyProductionSecrets.js` | Security owner | - | - | Runtime evidence still required |
| AUTH-01 | Security | PostgreSQL shared users/sessions, RBAC, CSRF and secure cookies | Critical | PASS | PR13 tests and readiness implementation | Security owner | - | 2026-08-01 | Production endpoint evidence still required |
| CUS-01 | Customer security | Verified customer auth with independent customer session/CSRF boundary | Critical | IN_PROGRESS | PR15.1 migration 006, API/unit tests, and isolated two-instance Docker QA | Customer Platform owner | - | 2026-08-02 | QA evidence passed; real production environment, delivery, readiness endpoint, and approval evidence remain required |
| CUS-02 | Customer ownership | Canonical order ownership, transactional guest claim, and IDOR proof | Critical | BLOCKED | PR15.0 inventory; PR15.2-PR15.3 reconciliation and cross-account tests required | Customer Platform owner | - | - | Five legacy orders are `LEGACY_UNRESOLVED`; email matching is prohibited |
| CUS-03 | Customer dashboard | Persisted owner-scoped dashboard with no mock sensitive data | Critical | BLOCKED | PR15.0 inventory; PR15.3 dashboard and API proof required | Customer Platform owner | - | - | Current account dashboard is mock-driven and calls unscoped legacy APIs |
| DATA-01 | Data | Canonical catalog, orders, QR and stock integrity | Critical | PASS | `server/scripts/validateProductionDataIntegrity.js` QA result | Operations owner | - | 2026-08-01 | Production dataset evidence still required |
| BAK-01 | Backup | Encrypted off-site backup, retention, immutability and access control | Critical | BLOCKED | Required: `BACKUP_LAUNCH_EVIDENCE_PATH` | Operations owner | - | - | Local restore drill is not off-site evidence |
| BAK-02 | Backup | Isolated restore from off-site backup with RPO/RTO result | Critical | BLOCKED | Required: `BACKUP_LAUNCH_EVIDENCE_PATH` | Operations owner | - | - | Production RPO/RTO not committed |
| ALT-01 | Alerts | All critical alerts delivered externally and acknowledged by on-call | Critical | BLOCKED | Required: `ALERT_DELIVERY_EVIDENCE_PATH` | Operations owner | - | - | Function-level alert tests are insufficient |
| ALT-02 | On-call | Primary, backup, escalation and runbooks confirmed | Critical | BLOCKED | Required: alert evidence | Operations owner | - | - | No production channel/ack evidence |
| ENV-01 | Environment | Production validator and readiness endpoint pass | Critical | BLOCKED | `production:launch:validate` | Release owner | - | - | Fail-closed until all evidence exists |
| STG-01 | Staging | Same image/env shape/DB/session/proxy/backup/alert behavior as production | Critical | BLOCKED | Required: `PRODUCTION_STAGING_EVIDENCE_PATH` | Release owner | - | - | Docker QA is not staging sign-off |
| INT-01 | Internal | Internal production smoke passes on real domain and services | Critical | BLOCKED | Required: `PRODUCTION_INTERNAL_EVIDENCE_PATH` | Release owner | - | - | Not run |
| CAN-01 | Canary | Limited and expanded canary pass with approved thresholds | Critical | BLOCKED | Required: `PRODUCTION_CANARY_EVIDENCE_PATH` | Release owner | - | - | Thresholds must be approved in runbook |
| ROL-01 | Rollback | Application rollback drill passes without old secret restoration | Critical | BLOCKED | Required: `PRODUCTION_ROLLBACK_EVIDENCE_PATH` | Release owner | - | - | Not run |
| GNG-01 | Governance | Go/No-Go signed by technical, operations, security, business and on-call owners | Critical | BLOCKED | Required: `PRODUCTION_GO_NO_GO_EVIDENCE_PATH` | Business owner | - | - | Current decision is NO-GO |
| GATE-01 | Writes | Audited write-gate approval records readiness snapshot and approvers | Critical | BLOCKED | Required: `PRODUCTION_WRITE_GATE_APPROVAL_PATH` | Technical owner | - | - | Writes must remain disabled |
| SMK-01 | Smoke | Public, admin, checkout and operations smoke on production | Critical | BLOCKED | Launch report | Release owner | - | - | Not run |
| OPS-01 | Hypercare | Dashboard, staffing, incident template and 24-72h window agreed | High | BLOCKED | `PRODUCTION_HYPERCARE_RUNBOOK.md` | Operations owner | - | - | Duration must be agreed, not hard-coded |
| QLT-01 | Quality | Lint, build, prerender, backend tests, audits, security gate and Docker config | High | PASS | CI/local gate results | Release owner | - | 2026-08-01 | Docker daemon currently off by policy |

## Current decision

`NO-GO`. Production writes remain fail-closed. The launch validator and report
generator must stay red until all Critical rows have real production evidence and
the Go/No-Go decision is approved. Customer launch additionally requires PR15.1
verified auth, PR15.2/PR15.3 provable order ownership, and a non-mock
owner-scoped dashboard.

Never paste raw secrets, private keys, session tokens, customer data, or full
provider payloads into this document or the launch report.
