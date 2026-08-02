# Incident: Webhook Attack

Severity: High. Owner: Security on-call.

Detect invalid-signature or replay bursts. Preserve redacted samples and rate
metrics, tighten upstream allowlists/rate limits where available, keep signature
verification enabled, rotate the webhook secret when warranted, and verify
legitimate replay/dedup behavior after containment. Document impact and
postmortem actions.
