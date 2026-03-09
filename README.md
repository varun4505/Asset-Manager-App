# SafeRoute AI

Fatigue-aware route planning app built with Expo React Native and an Express backend.

## MongoDB setup

The server now supports MongoDB-backed storage for:
- users
- riders
- zones
- orders
- app config

Create a `.env` file from `.env.example` and set:

```env
MONGODB_URI=your-mongodb-connection-string
MONGODB_DB_NAME=saferoute_ai
EXPO_PUBLIC_DOMAIN=your-api-domain:5000
```

If `MONGODB_URI` is missing, the server falls back to in-memory storage and logs a warning.

## Run

```bash
npm install
npm run server:dev
```

For mobile/web development, also run:

```bash
npm run start
```

## Vercel deployment

Deploy from the project root with these settings:

- Root directory: project root
- Framework preset: Express
- Install command: `npm install`
- Build command: leave empty
- Output directory: leave empty
- Environment variables:
  - `MONGODB_URI`
  - `MONGODB_DB_NAME`

The Vercel backend entrypoint is `server.ts` at the repo root.
