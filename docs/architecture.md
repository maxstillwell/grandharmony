# Architecture

The application is a Next.js App Router project using TypeScript strict mode, Tailwind CSS and reusable React components. Public project records are isolated in `lib/data/projects.ts`; they represent approved public content and are intentionally separate from any future internal project system.

The routes are:

- `/` — corporate website
- `/projects/[slug]` — reusable public project detail page
- `/portal` — generic portal holding page, without authentication claims
- `/demo/portal` — clearly labelled, non-confidential frontend demo

No database, authentication provider, API, client-side credential, real financial model, or CRM implementation is present. Neon PostgreSQL and Auth.js remain future concerns. Future authorisation must be server-side and must not rely on hiding navigation.
