# Routing and SEO Rollback

1. Keep the last known-good frontend artifact and canonical catalog manifest.
2. If the routing release must be reverted, deploy the previous frontend and
   Nginx configuration together. Do not delete slug history.
3. If catalog data also needs rollback, follow
   `docs/CANONICAL_ROLLBACK_RUNBOOK.md`, then rebuild prerendered pages against
   the restored manifest.
4. Validate `/sitemap.xml`, `/robots.txt`, a public product direct load, and
   the account/admin noindex pages before reopening traffic.

The current implementation keeps legacy hash bootstrap redirects during a
rollback window. Removing them is a separate release after traffic and search
console data confirm the migration is stable.
