# Development workflow

- Work on `main`; validate, commit and push directly to the existing repository and Vercel Production project.
- Reuse the existing Grand Harmony Neon project and production database. Do not create branches, databases, Vercel projects or routine pull requests.
- Compatible additive migrations are authorised within the requested work after read-only schema/journal verification and confirmation of a recovery point. Never reset the database, overwrite unrelated data, or use destructive schema push.
- Preserve existing corporate/Portal functionality and Git history. Run lint, typecheck, tests and production build before pushing.
- Keep inventory editing separate from approval/publication. Confidential prices and CRM never enter public snapshots. Do not publish fictional inventory or enable buyer enquiries without approved content/privacy and verified persistence.
- Keep credentials out of Git, reports and logs. No DNS changes or paid services without an explicit request.

This direct-to-main workflow supersedes older feature-branch/staging/PR release instructions in historical project documentation.
