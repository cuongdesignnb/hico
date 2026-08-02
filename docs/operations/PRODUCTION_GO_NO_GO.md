# Production Go/No-Go

## Decision

**Current decision: NO-GO**

This decision reflects the repository state on 2026-08-02: production-like QA
passed, but real production domain/TLS, secret rotation/revocation, external
alert acknowledgement, off-site backup, canary, rollback and approver evidence
are absent. PR15.1 Customer auth has isolated Docker QA evidence but no real
production evidence. Customer launch remains blocked until PR15.2/PR15.3 prove
order ownership and PR15.3 replaces the mock dashboard. This is intentional
fail-closed behavior.

## Required sign-off

| Role | Name | Decision | Evidence reference | Timestamp |
| --- | --- | --- | --- | --- |
| Technical owner | - | - | - | - |
| Operations owner | - | - | - | - |
| Security owner | - | - | - | - |
| Business owner | - | - | - | - |
| Primary on-call | - | - | - | - |

Allowed decisions: `GO`, `NO-GO`, `GO WITH TIME-BOUND RISK ACCEPTANCE`.
Risk acceptance cannot cover auth, TLS, backup, secret rotation, data
integrity, session store, or webhook signature controls.

## Go criteria

1. `server/scripts/validateProductionLaunch.js` returns `ready`.
2. All Critical rows in `PRODUCTION_LAUNCH_CHECKLIST.md` are `PASS`.
3. Canary and rollback evidence identify the immutable release artifact.
4. Write-gate approval records the readiness snapshot, approvers, release,
   catalog and migration versions.

No person should enable writes by editing an environment variable or container
file. The runtime guard remains the final enforcement point.
