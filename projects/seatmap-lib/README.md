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

## Testing

The library is covered by ~226 unit tests run with **Vitest** through the official
Angular 21 builder `@angular/build:unit-test`. Vitest is API-compatible with Jest
(`vi.fn` / `vi.mock` ↔ `jest.fn` / `jest.mock`) and is the recommended runner for
Angular 21+ — `jest-preset-angular` does not yet support this Angular version.

### Commands

```bash
# Run all tests once (CI-style)
npm test

# Watch mode for development
npm test -- --watch

# Coverage report (writes to ./coverage)
npm test -- --coverage
```

### Test layout

- Component tests live next to the component file (`*.component.spec.ts`).
- Service tests live next to the service file (`*.service.spec.ts`).
- Tests use Angular `TestBed` + `HttpClientTestingModule` for the API layer.

### What's covered

- Main component `JetsSeatMapComponent`: rendering, prop variations, all 17 `@Output`s,
  `seatJumpTo` change tracking, `componentOverrides`, error paths, multi-deck behaviour.
- All sub-components (`JetsDeck`, `JetsRow`, `JetsSeat`, `JetsTooltip`, `JetsWing`,
  `JetsNose`, `JetsTail`, `JetsPlaneBody`, `JetsBulk`, `JetsDeckSelector`,
  `JetsDeckSeparator`, `JetsDeckExit`, `JetsNotInit`, `JetsNoData`) — smoke + input/output.
- `JetsSeatMapApiService`: HTTP request shape, authorization scheme, `apiMetadata`,
  401 retry, array response merging.
- `JetsSeatMapService` and `JetsSeatMapPreparerService`: data preparation and selection logic.

### Continuous integration

CI runs on every push and pull request via `.github/workflows/ci.yml`:

- **test** job — `npm ci` + `npm test`.
- **build** job — `npm run build:lib` + `ng build seatmap-demo`.
