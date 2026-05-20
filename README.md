# @kwiket/jets-seatmap-angular-lib

Angular seatmap component library.

This repo hosts:

- **`projects/seatmap-lib/`** — the publishable Angular library (`@kwiket/jets-seatmap-angular-lib`).
- **`projects/seatmap-demo/`** — a minimal demo app used during library development. Not published.

## Install

```bash
npm install
```

## Build the library

```bash
npm run build:lib
```

Artifacts go to `dist/seatmap-lib/`.

## Run the dev demo

Create a gitignored `.env.local` at the repo root with your sandbox credentials:

```bash
cat > .env.local <<EOF
API_URL=https://sandbox.quicket.io/api/v1
API_APP_ID=your-app-id
API_KEY=your-api-key
FLIGHTS_API_URL=
EOF

npm start
```

`prestart` runs `generate:env`, which loads `.env.local` via Node's built-in `--env-file-if-exists` and writes the values into `projects/seatmap-demo/public/env-config.js`. The demo reads them at runtime from `window.__env`. Both `.env.local` and `env-config.js` are gitignored.

## Tests

```bash
npm test
```

## Publishing to NPM (handled by CI/CD later)

```bash
npm run build:lib
cd dist/seatmap-lib
npm publish --access public
```
