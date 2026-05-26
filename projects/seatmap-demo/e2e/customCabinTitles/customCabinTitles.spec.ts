import { test } from '@playwright/test';
import { applyConfigAndReady, screenshotSeatMap, ConfigOverrides } from '../helpers/demo';

const VARIANTS: { name: string; overrides: ConfigOverrides }[] = [
  {
    name: 'default',
    overrides: { visibleCabinTitles: true, customCabinTitles: undefined },
  },
  {
    name: 'short',
    overrides: {
      visibleCabinTitles: true,
      customCabinTitles: { F: 'F', B: 'B', P: 'P', E: 'E' },
    },
  },
  {
    name: 'long',
    overrides: {
      visibleCabinTitles: true,
      customCabinTitles: { F: 'First', B: 'Business', P: 'Premium Economy', E: 'Economy' },
    },
  },
];

test.describe('customCabinTitles', () => {
  for (const v of VARIANTS) {
    test(v.name, async ({ page }) => {
      await page.goto('/');
      await applyConfigAndReady(page, v.overrides);
      await screenshotSeatMap(page, __dirname, `customCabinTitles-${v.name}`);
    });
  }
});
