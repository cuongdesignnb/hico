# Incident: Catalog Corruption

Severity: High. Owner: Catalog owner.

Detect checksum, manifest, or catalog-health failures. Freeze catalog writes,
preserve the current pointer and audit evidence, validate the last known-good
canonical version, and use the canonical rollback runbook. Verify public reads,
checkout scope, and references before communication and postmortem.
