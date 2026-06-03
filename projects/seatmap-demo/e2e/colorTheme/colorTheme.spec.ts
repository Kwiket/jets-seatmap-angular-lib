import { expect, test, type Page } from '@playwright/test';
import {
  applyConfigAndReady,
  clickFirstAvailableSeat,
  screenshotElement,
  screenshotRows,
  screenshotSeatMap,
  setPassengers,
} from '../helpers/demo';

/**
 * `colorTheme` is a large object covering 30+ knobs (seat colors, tooltip
 * theming, deck background, exits, bulks, passenger badge, fonts, …).
 *
 * Two layers of coverage live here:
 *
 *  1. THEMED VARIANTS — the original suite. Each variant flips a whole
 *     family of theme keys (dark/bright/monochrome/tooltip-dark) so the
 *     visual diff between baselines is obvious at a glance.
 *
 *  2. PER-FIELD MATRIX — one test per `IColorTheme` field listed in the
 *     library's public contract. Each test starts from a realistic
 *     baseline (mirrors the demo's CABIN_THEME) and overrides exactly one
 *     field with a vivid, easily-distinguishable value. The resulting
 *     screenshot under `colorTheme/screenshots/colorTheme-field-<name>.png`
 *     is the per-field visual artefact.
 *
 * `helpers/demo.setConfig` merges overrides at the TOP level only — i.e.
 * `colorTheme` is replaced wholesale, not deep-merged. To preserve the
 * baseline look while changing a single key we pass the full baseline +
 * override on every call.
 */

interface ThemeVariant {
  name: string;
  theme: Record<string, unknown>;
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
  // tooltip's colors. Uses only real `IColorTheme` keys (`tooltipFontColor`,
  // not the legacy `tooltipColor`/`tooltipFontSize` from the React demo).
  test('tooltip-dark', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, {
      colorTheme: {
        tooltipBackgroundColor: '#111',
        tooltipFontColor: '#f1f1f1',
        tooltipHeaderColor: '#f1f1f1',
        tooltipBorderColor: '#666',
        tooltipIconColor: '#f1f1f1',
      },
    });
    await clickFirstAvailableSeat(page);
    await screenshotElement(page, __dirname, 'colorTheme-tooltip-dark', '.jets-tooltip', 16);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * Per-field matrix
 *
 * Baseline mirrors the demo's CABIN_THEME so the screenshot diff is driven
 * by the single-field override, not by the absence of other fields.
 * ──────────────────────────────────────────────────────────────────────── */

const BASELINE_THEME: Record<string, unknown> = {
  seatMapBackgroundColor: 'white',
  deckLabelTitleColor: 'white',
  deckHeightSpacing: 100,
  wingsWidth: 50,
  deckSeparation: 0,
  floorColor: 'rgb(30,60,90)',
  seatLabelColor: 'white',
  seatStrokeColor: 'rgb(237, 237, 237)',
  seatStrokeWidth: 1,
  seatArmrestColor: '#cccccc',
  notAvailableSeatsColor: 'lightgray',
  bulkBaseColor: 'dimgrey',
  bulkCutColor: 'lightgrey',
  bulkIconColor: 'darkslategray',
  bulkFloorIconColor: 'lightgrey',
  defaultPassengerBadgeColor: 'darkred',
  defaultPassengerBadgeLabelColor: '#fff',
  defaultPassengerBadgeBorderColor: '#fff',
  fontFamily: 'Montserrat, sans-serif',
  tooltipBackgroundColor: 'rgb(255,255,255)',
  tooltipHeaderColor: '#4f6f8f',
  tooltipBorderColor: 'rgb(255,255,255)',
  tooltipFontColor: '#4f6f8f',
  tooltipIconColor: '#4f6f8f',
  tooltipIconBorderColor: '#4f6f8f',
  tooltipIconBackgroundColor: '#fff',
  tooltipSelectButtonTextColor: '#fff',
  tooltipSelectButtonBackgroundColor: 'rgb(42, 85, 128)',
  tooltipCancelButtonTextColor: '#fff',
  tooltipCancelButtonBackgroundColor: 'rgb(55, 55, 55)',
  deckSelectorStrokeColor: '#fff',
  deckSelectorFillColor: 'rgba(55, 55, 55, 0.5)',
  deckSelectorSize: 25,
  fuselageStrokeWidth: 16,
  fuselageFillColor: 'lightgrey',
  fuselageStrokeColor: 'darkgrey',
  fuselageWindowsColor: 'darkgrey',
  fuselageWingsColor: 'rgba(55, 55, 55, 0.5)',
  fuselageNoseType: 'by-type',
  exitIconUrlLeft: 'https://panorama.quicket.io/icons/exit-left.svg',
  exitIconUrlRight: 'https://panorama.quicket.io/icons/exit-right.svg',
  cabinTitlesWidth: 80,
  cabinTitlesHighlightColors: { F: '#BDB76B', B: '#FF8C00', P: '#8FBC8F', E: '#1E90FF' },
  cabinTitlesLabelColor: '#00BFFF',
  customSeatColorRanges: [
    { color: 'red', range: [1, 3.99] },
    { color: 'yellow', range: [4, 7.99] },
    { color: 'green', range: [8, 10] },
  ],
};

type Precondition = 'plain' | 'tooltip' | 'cabinTitles' | 'multiDeck' | 'passengerSeated';

/**
 * How to capture the screenshot for a per-field test.
 *
 * - `full` (default) — the whole `.demo-seatmap-wrapper`; right for
 *   coarse visual changes (background, floor, fuselage).
 * - `element` — crop to a CSS selector's bounding box plus padding;
 *   right for small overlays (open tooltip, deck selector, single bulk).
 * - `rows` — crop to a contiguous range of `.jets-row`; right for
 *   fine seat-level details (label, stroke, armrest) that get lost in
 *   the full-deck downscale.
 */
type CloseUp = { kind: 'element'; selector: string; padding?: number } | { kind: 'rows'; from: number; count: number };

interface FieldCase {
  field: string;
  value: unknown;
  pre?: Precondition;
  extraConfig?: Record<string, unknown>;
  // Extra theme keys to layer on top of BASELINE_THEME alongside `field`.
  // Used when one field's visual effect depends on another (e.g.
  // `cabinTitlesHighlightColors` needs `visibleCabinTitles: true`, while
  // `fuselageNoseType` is only visible when fuselage is on — which the
  // demo default already provides).
  extraTheme?: Record<string, unknown>;
  // BASELINE_THEME keys to drop for this case. Use when the explicit
  // baseline value would shadow the override under test — e.g.
  // `customSeatColorRanges` needs `seatAvailableColor` undefined so the
  // score-tiered palette gets a chance to paint.
  omitFromBaseline?: string[];
  closeUp?: CloseUp;
  // Optional DOM-level assertion that runs AFTER applyConfigAndReady
  // (and any tooltip click), BEFORE the screenshot. Use for micro-detail
  // changes the screenshot can't reliably verify (1-4 px stroke widths,
  // computed colours of tiny elements, structural dimensions).
  verify?: (page: Page) => Promise<void>;
}

/**
 * Per-field cases. Each entry overrides ONE `colorTheme` field with a
 * vivid value designed to make the change easy to spot in the screenshot
 * against the BASELINE_THEME look.
 */
/* Defaults for the most common close-up patterns. */
// 2 rows keeps each seat at ~2x its analyzer-thumbnail size — enough to
// distinguish a 4px outline from a 1px one and to read seat-label glyphs.
const FEW_ROWS_FROM_TOP: CloseUp = { kind: 'rows', from: 0, count: 2 };
const TOOLTIP_CLOSEUP: CloseUp = { kind: 'element', selector: '.jets-tooltip', padding: 16 };
const DECK_SELECTOR_CLOSEUP: CloseUp = {
  kind: 'element',
  selector: '.jets-seatmap-header',
  padding: 20,
};
// Pick a bulk that actually carries a sticker overlay — the first .jets-bulk
// match in the demo data is a plain partition (galley) that exercises only
// base/cut, so bulkIconColor (the sticker tint) and bulkFloorIconColor (the
// floor-icon sub-type) appear "broken" when in fact the selector misses
// their visual targets.
const BULK_CLOSEUP: CloseUp = {
  kind: 'element',
  selector: '.jets-bulk:has(.jets-bulk__sticker-wrap)',
  padding: 30,
};

const FIELD_CASES: FieldCase[] = [
  // ─── Background / floor / fonts ────────────────────────────────────────
  { field: 'seatMapBackgroundColor', value: '#ffcdd2' },
  { field: 'floorColor', value: '#8e24aa' },
  // Font change is most visible in tooltip text; open the tooltip and crop to it.
  { field: 'fontFamily', value: 'Courier New, monospace', pre: 'tooltip', closeUp: TOOLTIP_CLOSEUP },

  // ─── Seat ──────────────────────────────────────────────────────────────
  // Seat labels / strokes / armrests are sub-pixel at full-deck zoom — crop
  // for visual confirmation, plus assert the actual DOM value so the test
  // fails loudly if the override silently drops.
  {
    field: 'seatLabelColor',
    value: '#ff0000',
    closeUp: FEW_ROWS_FROM_TOP,
    verify: async page => {
      const color = await page
        .locator('.jets-seat--available .jets-seat__number')
        .first()
        .evaluate(el => (el as HTMLElement).style.color);
      expect(color).toBe('rgb(255, 0, 0)');
    },
  },
  {
    field: 'seatStrokeColor',
    value: '#000000',
    closeUp: FEW_ROWS_FROM_TOP,
    verify: async page => {
      // SVG paths carry `stroke="..."` attributes set from the seat template.
      const stroke = await page.locator('.jets-seat--available .jets-seat__svg path.bd').first().getAttribute('stroke');
      expect(stroke).toBe('#000000');
    },
  },
  {
    field: 'seatStrokeWidth',
    value: 4,
    closeUp: FEW_ROWS_FROM_TOP,
    verify: async page => {
      const width = await page
        .locator('.jets-seat--available .jets-seat__svg path.bd')
        .first()
        .getAttribute('stroke-width');
      expect(width).toBe('4');
    },
  },
  {
    field: 'seatArmrestColor',
    value: '#ff5722',
    closeUp: FEW_ROWS_FROM_TOP,
    verify: async page => {
      // The armrest paths use class `bc` and receive `fill="${armrestColor}"`.
      const fill = await page.locator('.jets-seat--available .jets-seat__svg path.bc').first().getAttribute('fill');
      expect(fill).toBe('#ff5722');
    },
  },
  { field: 'notAvailableSeatsColor', value: '#9c27b0' },

  // ─── Bulk (cabin partitions) ──────────────────────────────────────────
  // Bulk icons are tiny — crop to the first bulk element.
  { field: 'bulkBaseColor', value: '#ff9800', closeUp: BULK_CLOSEUP },
  { field: 'bulkCutColor', value: '#00bcd4', closeUp: BULK_CLOSEUP },
  { field: 'bulkIconColor', value: '#e91e63', closeUp: BULK_CLOSEUP },
  { field: 'bulkFloorIconColor', value: '#ffeb3b', closeUp: BULK_CLOSEUP },

  // ─── Passenger badge ──────────────────────────────────────────────────
  // Badge only renders on seats that have an assigned passenger. The
  // pre:'passengerSeated' preset clicks a seat after applyConfigAndReady so
  // the next-in-queue demo passenger gets assigned to it; closing up on
  // .jets-seat--selected shows the small circular badge with the
  // passenger's abbr inside.
  {
    field: 'defaultPassengerBadgeColor',
    value: '#00e676',
    pre: 'passengerSeated',
    closeUp: { kind: 'element', selector: '.jets-seat--selected', padding: 20 },
    verify: async page => {
      const bg = await page
        .locator('.jets-seat--selected .jets-seat__passenger')
        .first()
        .evaluate(el => (el as HTMLElement).style.backgroundColor);
      expect(bg).toBe('rgb(0, 230, 118)');
    },
  },
  {
    field: 'defaultPassengerBadgeLabelColor',
    value: '#000000',
    pre: 'passengerSeated',
    closeUp: { kind: 'element', selector: '.jets-seat--selected', padding: 20 },
    verify: async page => {
      // The seat status (and therefore the badge) may take a render tick
      // to settle when this case runs as part of a longer suite — poll the
      // computed style instead of reading once.
      await expect
        .poll(
          () =>
            page
              .locator('.jets-seat--selected .jets-seat__passenger')
              .first()
              .evaluate(el => getComputedStyle(el).color),
          { timeout: 5_000 }
        )
        .toBe('rgb(0, 0, 0)');
    },
  },
  {
    field: 'defaultPassengerBadgeBorderColor',
    value: '#ff1744',
    pre: 'passengerSeated',
    closeUp: { kind: 'element', selector: '.jets-seat--selected', padding: 20 },
    verify: async page => {
      await expect
        .poll(
          () =>
            page
              .locator('.jets-seat--selected .jets-seat__passenger')
              .first()
              .evaluate(el => getComputedStyle(el).borderColor),
          { timeout: 5_000 }
        )
        .toBe('rgb(255, 23, 68)');
    },
  },

  // ─── Deck ──────────────────────────────────────────────────────────────
  // Deck title text sits at the top of each deck.
  {
    field: 'deckLabelTitleColor',
    value: '#ff0000',
    closeUp: { kind: 'element', selector: '.jets-deck__title', padding: 30 },
  },
  // NOTE: deckHeightSpacing is declared in IColorTheme + DEFAULT_COLOR_THEME
  // but no component reads it (verified via grep). Leaving the screenshot in
  // place as documentation of the public-API surface, but a verify here
  // would always fail — covered by a separate lib-side task.
  { field: 'deckHeightSpacing', value: 200 },
  { field: 'deckSeparation', value: 80, extraConfig: { singleDeckMode: false } },

  // ─── Deck selector (renders in .jets-seatmap-header above the map) ────
  {
    field: 'deckSelectorStrokeColor',
    value: '#ff0000',
    pre: 'multiDeck',
    closeUp: DECK_SELECTOR_CLOSEUP,
  },
  {
    field: 'deckSelectorFillColor',
    value: '#ffeb3b',
    pre: 'multiDeck',
    closeUp: DECK_SELECTOR_CLOSEUP,
  },
  {
    field: 'deckSelectorSize',
    value: 50,
    pre: 'multiDeck',
    closeUp: DECK_SELECTOR_CLOSEUP,
    verify: async page => {
      // Selector inline `width` / `height` come from colorTheme.deckSelectorSize.
      const box = await page.locator('.jets-deck-selector').first().boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(48);
      expect(box!.height).toBeGreaterThanOrEqual(48);
    },
  },

  // ─── Wings ────────────────────────────────────────────────────────────
  { field: 'wingsWidth', value: 150 },

  // ─── Fuselage ─────────────────────────────────────────────────────────
  { field: 'fuselageStrokeWidth', value: 18 },
  { field: 'fuselageFillColor', value: '#e1bee7' },
  { field: 'fuselageStrokeColor', value: '#ff1744' },
  { field: 'fuselageWindowsColor', value: '#00e5ff' },
  { field: 'fuselageWingsColor', value: 'rgba(255, 0, 0, 0.8)' },
  { field: 'fuselageNoseType', value: 'default' },

  // ─── Exit icons ───────────────────────────────────────────────────────
  {
    field: 'exitIconUrlLeft',
    value: 'https://panorama.quicket.io/icons/exit_icon_red.svg',
  },
  {
    field: 'exitIconUrlRight',
    value: 'https://panorama.quicket.io/icons/exit_icon_red.svg',
  },

  // ─── Cabin titles (need visibleCabinTitles: true) ────────────────────
  // Cabin-titles strip sits along the side of the deck — full screenshot lets
  // the analyser see both sides at once; close-up would crop one out.
  { field: 'cabinTitlesWidth', value: 160, pre: 'cabinTitles' },
  {
    field: 'cabinTitlesHighlightColors',
    value: { F: '#ff0000', B: '#00ff00', P: '#0000ff', E: '#ffff00' },
    pre: 'cabinTitles',
  },
  { field: 'cabinTitlesLabelColor', value: '#ff00ff', pre: 'cabinTitles' },

  // ─── Tooltip (click a seat to open it; crop to the tooltip) ──────────
  { field: 'tooltipBackgroundColor', value: '#212121', pre: 'tooltip', closeUp: TOOLTIP_CLOSEUP },
  { field: 'tooltipHeaderColor', value: '#ff5252', pre: 'tooltip', closeUp: TOOLTIP_CLOSEUP },
  { field: 'tooltipBorderColor', value: '#ffeb3b', pre: 'tooltip', closeUp: TOOLTIP_CLOSEUP },
  { field: 'tooltipFontColor', value: '#ff5722', pre: 'tooltip', closeUp: TOOLTIP_CLOSEUP },
  { field: 'tooltipIconColor', value: '#00e676', pre: 'tooltip', closeUp: TOOLTIP_CLOSEUP },
  { field: 'tooltipIconBorderColor', value: '#ff1744', pre: 'tooltip', closeUp: TOOLTIP_CLOSEUP },
  {
    field: 'tooltipIconBackgroundColor',
    value: '#ffeb3b',
    pre: 'tooltip',
    closeUp: TOOLTIP_CLOSEUP,
  },
  {
    field: 'tooltipSelectButtonTextColor',
    value: '#000000',
    pre: 'tooltip',
    closeUp: TOOLTIP_CLOSEUP,
  },
  {
    field: 'tooltipSelectButtonBackgroundColor',
    value: '#ffeb3b',
    pre: 'tooltip',
    closeUp: TOOLTIP_CLOSEUP,
  },
  {
    field: 'tooltipCancelButtonTextColor',
    value: '#000000',
    pre: 'tooltip',
    closeUp: TOOLTIP_CLOSEUP,
  },
  {
    field: 'tooltipCancelButtonBackgroundColor',
    value: '#ffeb3b',
    pre: 'tooltip',
    closeUp: TOOLTIP_CLOSEUP,
  },

  // ─── Score-based custom seat colors ──────────────────────────────────
  {
    field: 'customSeatColorRanges',
    value: [
      { color: '#ff1744', range: [1, 3.99] },
      { color: '#ffea00', range: [4, 7.99] },
      { color: '#00e676', range: [8, 10] },
    ],
    // BASELINE_THEME ships seatAvailableColor: 'white', which (post the
    // seat-palette override-precedence fix) silently outranks the score
    // ranges. Drop the baseline key so the score palette is allowed to
    // paint.
    omitFromBaseline: ['seatAvailableColor'],
    closeUp: FEW_ROWS_FROM_TOP,
  },
];

test.describe('colorTheme · per-field matrix', () => {
  for (const c of FIELD_CASES) {
    test(`field-${c.field}`, async ({ page }) => {
      await page.goto('/');

      const baseline = { ...BASELINE_THEME };
      for (const key of c.omitFromBaseline ?? []) {
        delete baseline[key];
      }
      const theme: Record<string, unknown> = {
        ...baseline,
        ...(c.extraTheme ?? {}),
        [c.field]: c.value,
      };
      const config: Record<string, unknown> = {
        colorTheme: theme,
        ...(c.pre === 'cabinTitles' ? { visibleCabinTitles: true } : {}),
        ...(c.pre === 'multiDeck' ? { singleDeckMode: true, builtInDeckSelector: true } : {}),
        ...(c.extraConfig ?? {}),
      };
      await applyConfigAndReady(page, config);
      if (c.pre === 'tooltip') {
        await clickFirstAvailableSeat(page);
      } else if (c.pre === 'passengerSeated') {
        // Push the demo's default passenger list, click a seat (which opens
        // the built-in tooltip), then click "Select" in the tooltip to
        // assign the next-in-queue passenger to the seat. After that the
        // seat flips to .jets-seat--selected and shows .jets-seat__passenger.
        await setPassengers(page);
        await clickFirstAvailableSeat(page);
        const selectBtn = page.locator('.jets-tooltip .jets-select-btn');
        await selectBtn.waitFor({ state: 'visible', timeout: 5_000 });
        await selectBtn.click();
        await page.locator('.jets-seat--selected .jets-seat__passenger').first().waitFor({
          state: 'visible',
          timeout: 5_000,
        });
      }
      // DOM assertion runs BEFORE the screenshot so a failed verify aborts
      // with a clear stack trace, and the screenshot reflects the state
      // that was just asserted.
      if (c.verify) {
        await c.verify(page);
      }
      const name = `colorTheme-field-${c.field}`;
      if (!c.closeUp) {
        await screenshotSeatMap(page, __dirname, name);
      } else if (c.closeUp.kind === 'element') {
        await screenshotElement(page, __dirname, name, c.closeUp.selector, c.closeUp.padding);
      } else {
        await screenshotRows(page, __dirname, name, c.closeUp.from, c.closeUp.count);
      }
    });
  }
});
