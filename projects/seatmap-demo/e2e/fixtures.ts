import { test as base } from '@playwright/test';

export * from '@playwright/test';

/**
 * Pause before every test so the suite stays under the sandbox API rate limit
 * (each test loads the seat map 2–3 times). `E2E_TEST_DELAY_MS` overrides the
 * default: 1000 ms on CI, none locally.
 */
const TEST_DELAY_MS = Number(process.env['E2E_TEST_DELAY_MS'] || (process.env['CI'] ? 1000 : 0));

export const test = base.extend<{ apiPacing: void }>({
  apiPacing: [
    async ({}, use) => {
      if (TEST_DELAY_MS > 0) await new Promise(resolve => setTimeout(resolve, TEST_DELAY_MS));
      await use();
    },
    { auto: true },
  ],
});
