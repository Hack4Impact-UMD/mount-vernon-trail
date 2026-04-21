# Backend

Node + TypeScript service that will proxy Google Photos uploads into the MVT-owned album using a refresh token for `hello@mountvernontrail.org`. Target deployment: Render.

**Status:** scaffold only. No server code yet — functionality will be added in a follow-up.

## Planned responsibilities
- Hold the MVT Google OAuth refresh token server-side (env var, never shipped to clients).
- Expose endpoints for the Expo app to upload photos and batch-create media items into an MVT album.
- Verify Firebase ID tokens on incoming requests so only authenticated volunteers can upload.

## Local dev (once implemented)
```
cp .env.example .env   # fill in values
npm install
npm run dev            # tsc --watch
npm start              # runs dist/index.js
```
