import { test } from '@playwright/test';
import {
  applyConfigAndReady,
  clickFirstAvailableSeat,
  screenshotSeatMap,
} from '../helpers/demo';

/**
 * `colorTheme` is a large object covering 30+ knobs (seat colors, tooltip
 * theming, deck background, exits, bulks, passenger badge, fonts, …). The
 * React Playwright suite splits each into its own sub-folder. Here we
 * consolidate the most visually distinctive variants into a single suite —
 * each test exercises the same lifecycle but flips a different family of
 * theme keys. To match React's split exactly, additional sub-describes can
 * be added without touching helpers.
 */

interface ThemeVariant {
  name: string;
  theme: Record<string, unknown>;
  // If set, click this seat (or first available) and screenshot tooltip too.
  clickSeat?: boolean;
}

const VARIANTS: ThemeVariant[] = [
  {
    name: 'default',
    theme: {},
  },
  {
    name: 'dark',
    theme: {
      seatMapBackgroundColor: '#1e1e1e',
      floorColor: '#2a2a2a',
      fuselageColor: '#444',
      seatLabelColor: '#fff',
      cabinTitlesLabelColor: '#fff',
      seatAvailableColor: '#4caf50',
      seatUnavailableColor: '#555',
      seatSelectedColor: '#ffeb3b',
      tooltipBackgroundColor: '#222',
      tooltipColor: '#fff',
    },
  },
  {
    name: 'bright',
    theme: {
      seatMapBackgroundColor: '#fffaf0',
      floorColor: '#ffe0b2',
      fuselageColor: '#ffcc80',
      seatLabelColor: '#222',
      cabinTitlesLabelColor: '#222',
      seatAvailableColor: '#ff7043',
      seatSelectedColor: '#ab47bc',
      tooltipBackgroundColor: '#fff8e1',
      tooltipColor: '#333',
    },
  },
  {
    name: 'monochrome',
    theme: {
      seatMapBackgroundColor: '#fff',
      floorColor: '#eaeaea',
      fuselageColor: '#bbb',
      seatAvailableColor: '#888',
      seatUnavailableColor: '#ccc',
      seatSelectedColor: '#000',
      seatLabelColor: '#000',
    },
  },
];

test.describe('colorTheme', () => {
  for (const v of VARIANTS) {
    test(v.name, async ({ page }) => {
      await page.goto('/');
      await applyConfigAndReady(page, { colorTheme: v.theme });
      if (v.clickSeat) {
        await clickFirstAvailableSeat(page);
      }
      await screenshotSeatMap(page, __dirname, `colorTheme-${v.name}`);
    });
  }

  // Tooltip-specific theme — click a seat after applying to capture the
  // tooltip's colors.
  test('tooltip-dark', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, {
      colorTheme: {
        tooltipBackgroundColor: '#111',
        tooltipColor: '#f1f1f1',
        tooltipFontSize: '14px',
        tooltipBorderColor: '#666',
      },
    });
    await clickFirstAvailableSeat(page);
    await screenshotSeatMap(page, __dirname, 'colorTheme-tooltip-dark');
  });
});
