# Production Hypercare Runbook

Hypercare is an operational window agreed before launch, normally 24-72 hours;
the duration is recorded in the launch report and is not hard-coded in code.

## Staffing

| Role | Owner | Backup | Escalation |
| --- | --- | --- | --- |
| Primary on-call | - | - | - |
| Technical owner | - | - | - |
| Operations owner | - | - | - |
| Business owner | - | - | - |
| Incident commander | - | - | - |

## Dashboard

Track release/image, readiness, traffic, 5xx, latency, login/session,
catalog writes/conflicts, checkout orders, fulfillment pending, provider and
webhook errors, QR/stock warnings, backup status and open alerts. Do not expose
PII, raw QR/LPA data, tokens or credentials.

## Cadence and exit

Record a start snapshot, every alert/incident, periodic metric snapshots and the
exit decision. Exit only when open critical incidents are zero, backup and
alert delivery are healthy, integrity checks pass, and Operations plus Business
owners approve the transition to normal support.
