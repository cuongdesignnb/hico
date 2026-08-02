# SEO Prerender Runbook

1. Set `VITE_PUBLIC_SITE_URL` and `PUBLIC_SITE_URL` to the production HTTPS
   origin without a trailing slash. Set `SEO_ENV=production` on the backend.
2. Publish catalog changes only after the normal catalog readiness checks pass.
3. Run `npm run build`. This executes TypeScript checks, Vite build, and
   `scripts/prerender-public-routes.mjs`.
4. Check `dist/prerender-manifest.json`; its `catalogVersionId` must match the
   intended current catalog version. The output contains only public product,
   coverage, and article routes.
5. Deploy the frontend and backend together. Verify `/sitemap.xml`,
   `/robots.txt`, a product direct load, and a historical slug redirect.

Prerendering creates static HTML snapshots; it is not SSR. Regenerate the
frontend build after every catalog or published-article change and deploy that
build with the corresponding backend data.
