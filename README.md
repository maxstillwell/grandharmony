# Grand Harmony

Phase 1 frontend foundation for Grand Harmony's corporate website and future internal portal.

## Run locally

```bash
npm install --cache /tmp/grandharmony-npm-cache
npm run dev
```

Open `http://localhost:3000`. The internal portal at `/portal` is intentionally a non-authenticated holding page. The clearly labelled, non-confidential interface demonstration is at `/demo/portal`.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Production notes

The corporate imagery currently uses Unsplash placeholder imagery and must be replaced with appropriately licensed final assets before production. Contact information remains intentionally unconfirmed and inactive.
