# Production Launch Risk Register

| Risk | Severity | Owner | Mitigation | Expiry | Status |
| --- | --- | --- | --- | --- | --- |
| Real production domain/TLS evidence not supplied | Critical | Platform owner | Verify DNS, certificate, redirect, HSTS, routes and canonical origin | Before launch | Open |
| Secret-manager rotation/revocation evidence not supplied | Critical | Security owner | Deploy new versions, smoke test, revoke old versions and record metadata | Before launch | Open |
| External alert delivery/on-call acknowledgement not supplied | Critical | Operations owner | Test every critical event through the real channel and record acknowledgement | Before launch | Open |
| Off-site backup policy and restore evidence not supplied | Critical | Operations owner | Verify off-site encrypted backup and isolated restore with measured RPO/RTO | Before launch | Open |
| Canary and rollback approval not supplied | Critical | Release owner | Run approved phases on immutable artifacts and record abort/rollback results | Before launch | Open |
| Customer authentication still lacks real production evidence | Critical | Customer Platform owner | PR15.1 isolated session/CSRF, verification, and two-instance QA are complete; deploy real mode with production delivery/readiness evidence | Before customer launch | Partially mitigated |
| Legacy orders and APIs do not prove customer ownership | Critical | Customer Platform owner | Deliver PR15.2 canonical order/claim model and PR15.3 IDOR regression evidence; keep five legacy orders unresolved | Before customer launch | Open |
| Account dashboard is mock-driven and reads unscoped data | Critical | Customer Platform owner | Deliver PR15.3 persisted owner-scoped dashboard with sensitive-data exclusions | Before customer launch | Open |
| Customer profile/support features lack production runtime evidence and legal retention decision | Critical | Customer Platform owner | Complete PR15.7/PR15.8 health, migration, support IDOR, attachment, anonymization and retention evidence without enabling production writes | Before customer launch | Open |
| Customer cutover has only isolated QA evidence and quarantine contains unresolved legacy/demo findings | Critical | Customer Platform owner | Keep five legacy orders unresolved, quarantine mock/demo inputs, complete production migration/backup/health/ownership evidence, and obtain PR14 approval | Before customer launch | Open |
| Admin public image input is not fully proven through Media Library | Critical | Catalog/Platform owner | Complete PR15.8.2.3 scanner, reference validator, Media Library QA and owner review of legacy/orphan references; keep production NO-GO | Before launch | Open |
| React Router advisory risk acceptance expires 2026-08-31 | High | HICO Platform Security | Re-review advisory/registry before expiry; do not silently retain assessment | 2026-08-31 | Accepted with expiry |

No risk acceptance may open writes when a Critical control is missing.
