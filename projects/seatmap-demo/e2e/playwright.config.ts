import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env['CI'];

// Allow targeting an already-running dev server (e.g. the dev worktree on
// :4201) without editing this file. Defaults to the canonical :4200 server
// that `webServer` boots. When overridden, `reuseExistingServer` lets the
// suite attach to that server instead of spawning a duplicate.
const baseURL = process.env['PW_BASE_URL'] ?? 'http://localhost:4200';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  // Dev server is single-process; capping workers prevents click races
  // and ngOnChanges flapping under load.
  fullyParallel: true,
  forbidOnly: isCI,
  // Load on the sandbox API (rate-limited) is tuned with env vars, so CI can be
  // adjusted from repository variables without a code change. Per-test pause:
  // E2E_TEST_DELAY_MS in ./fixtures.ts.
  retries: Number(process.env['E2E_RETRIES'] || (isCI ? 1 : 0)),
  workers: Number(process.env['E2E_WORKERS'] || (isCI ? 1 : 2)),
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
  },
  expect: { timeout: 5_000 },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm start --prefix ../../..',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
