# SeatmapLib

Angular seatmap component library.

## Building

```bash
ng build seatmap-lib
```

Build artifacts are placed in the `dist/` directory.

### Publishing

```bash
cd dist/seatmap-lib
npm publish
```

## Demo App

### Setup

The demo app requires API credentials to fetch seatmap data. Credentials are **not** included in the repository.

1. Copy the environment template and fill in your credentials:

   ```bash
   cp projects/seatmap-demo/src/environments/environment.ts \
      projects/seatmap-demo/src/environments/environment.local.ts
   ```

2. Edit `environment.local.ts` with your real API keys:

   ```typescript
   export const environment = {
     apiUrl: 'https://sandbox.quicket.io/api/v1',
     apiAppId: 'YOUR_REAL_APP_ID',
     apiKey: 'YOUR_REAL_API_KEY',
   };
   ```

3. Run the demo:

   ```bash
   ng serve seatmap-demo
   ```

   The development server uses `fileReplacements` in `angular.json` to automatically swap `environment.ts` with `environment.local.ts`.

> **Note:** `environment.local.ts` is listed in `.gitignore` and will never be committed.

## Running unit tests

```bash
ng test
```
