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
  // Optional API-response mutator, installed via `page.route` BEFORE the
  // seatmap fetch fires. Use when the override under test paints into a
  // bulk/sticker template that none of the demo flights' live-API
  // responses happen to carry (e.g. `bulkFloorIconColor` needs a bulk of
  // type 26/27/28). The callback receives the parsed API JSON and may
  // mutate it in-place; the framework re-serialises and fulfils the route.
  mockApi?: (json: unknown) => void;
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
// base/cut, so bulkIconColor (the sticker tint) appears "broken" when in
// fact the selector misses its visual target.
const BULK_CLOSEUP: CloseUp = {
  kind: 'element',
  selector: '.jets-bulk:has(.jets-bulk__sticker-wrap)',
  padding: 30,
};

// `bulkFloorIconColor` paints `$stickerColor` only inside bulk templates
// 26/27/28 (food/toilet/floor-icon pictograms — see `bulk-template.service.ts`
// lines 147,151,155 where `path.icon.bulk` carries the substituted fill).
// Templates 26-28 do NOT appear in any of the demo flights' live-API
// responses, so the sticker-overlay close-up above (which works for
// bulkBaseColor/bulkCutColor/bulkIconColor) would silently pass without ever
// painting a `bulkFloorIconColor` pixel. The test mocks the API response to
// inject a type-26 bulk and crops to that specific element.
const FLOOR_ICON_BULK_CLOSEUP: CloseUp = {
  kind: 'element',
  selector: '.jets-bulk:has(svg#bulk-26)',
  padding: 30,
};

const FIELD_CASES: FieldCase[] = [
  // ─── Background / floor / fonts ────────────────────────────────────────
  { field: 'seatMapBackgroundColor', value: '#ffcdd2' },
  { field: 'floorColor', value: '#8e24aa' },
  // Font change is most visible in tooltip text; open the tooltip and crop to it.
  // The seatmap-host inline font-family alone wasn't reaching the tooltip's
  // headings/amenity/dimension text (proportional sans-serif kept showing
  // through in screenshots), so the tooltip now binds font-family on its own
  // root. Verify the binding at the DOM level so a silent regression cannot
  // slip through.
  {
    // Use the `serif` generic family with `Times New Roman` as the
    // first-choice font: the previous override `'Courier New, monospace'`
    // never rasterised in the Playwright Chromium image (Courier New isn't
    // installed and the stack fell through to a sans-serif fallback), so
    // the visual audit kept reading the tooltip text as proportional even
    // though the DOM-verify's family-string match passed. `Times New Roman`
    // ships with most Chromium font sets, and the trailing `serif` generic
    // guarantees a visually-distinct serif rendering on any platform.
    field: 'fontFamily',
    value: 'Times New Roman, serif',
    pre: 'tooltip',
    closeUp: TOOLTIP_CLOSEUP,
    verify: async page => {
      // Verify the override reaches every text-bearing descendant, not just
      // the tooltip root. An earlier iteration bound font-family only on the
      // root and the headings/amenity/dimension text still rendered in the
      // browser default sans-serif, so we assert computed font-family on a
      // representative set of children (header title, amenity text,
      // dimension label/value, action buttons).
      const targets = [
        '.jets-tooltip',
        '.jets-tooltip--header-title',
        '.jets-tooltip--amenity-text',
        '.jets-tooltip--dim-label',
        '.jets-tooltip--dim-value',
        '.jets-btn',
      ];
      for (const sel of targets) {
        const family = await page
          .locator(sel)
          .first()
          .evaluate(el => getComputedStyle(el).fontFamily);
        expect(family, sel).toContain('Times New Roman');
      }
    },
  },

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
      // BASELINE_THEME doesn't set `seatUnavailableCrossColor`, so the seat
      // template applies `seatStrokeColor` to every non-selected seat's `path.bd`
      // regardless of availability status. Reading any seat with a number is
      // robust against the availability race (demo's DEFAULT_AVAILABILITY
      // labels don't always match QT888 seats post-merge).
      const stroke = await page
        .locator('.jets-seat[data-seat-number] .jets-seat__svg path.bd')
        .first()
        .getAttribute('stroke');
      expect(stroke).toBe('#000000');
    },
  },
  {
    field: 'seatStrokeWidth',
    value: 4,
    closeUp: FEW_ROWS_FROM_TOP,
    verify: async page => {
      const width = await page
        .locator('.jets-seat[data-seat-number] .jets-seat__svg path.bd')
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
      // Same any-seat strategy as seatStrokeColor (see comment above).
      const fill = await page
        .locator('.jets-seat[data-seat-number] .jets-seat__svg path.bc')
        .first()
        .getAttribute('fill');
      expect(fill).toBe('#ff5722');
    },
  },
  { field: 'notAvailableSeatsColor', value: '#9c27b0' },

  // ─── Bulk (cabin partitions) ──────────────────────────────────────────
  // Bulk icons are tiny — crop to the first bulk element.
  // `bulkBaseColor` paints `path.bulk-base` inside the primary bulk SVG.
  // The sticker-overlay close-up partly hides that path; use a plain
  // (non-sticker) bulk where the base shape is fully visible.
  {
    field: 'bulkBaseColor',
    value: '#ff9800',
    closeUp: { kind: 'element', selector: '.jets-bulk:not(:has(.jets-bulk__sticker-wrap))', padding: 20 },
    verify: async page => {
      const fill = await page.locator('.jets-bulk path.bulk-base').first().getAttribute('fill');
      expect(fill).toBe('#ff9800');
    },
  },
  { field: 'bulkCutColor', value: '#00bcd4', closeUp: BULK_CLOSEUP },
  { field: 'bulkIconColor', value: '#e91e63', closeUp: BULK_CLOSEUP },
  {
    // `bulkFloorIconColor` substitutes `$stickerColor` in bulk SVG templates
    // 26/27/28 only (see `projects/seatmap-lib/src/lib/services/bulk-template.service.ts`).
    // None of the demo flights' live-API responses include a bulk of type
    // 26-28, so this test mocks the seatmap API to inject one. The close-up
    // crops to the injected bulk and the verify callback pins the `fill`
    // attribute on its `path.icon.bulk` (the only DOM node the
    // `bulkFloorIconColor` token paints).
    field: 'bulkFloorIconColor',
    value: '#ffeb3b',
    closeUp: FLOOR_ICON_BULK_CLOSEUP,
    mockApi: json => {
      const arr = Array.isArray(json) ? json : [json];
      for (const item of arr as Array<Record<string, any>>) {
        const decks = item?.['seatDetails']?.['decks'] ?? item?.['decks'];
        if (!Array.isArray(decks) || decks.length === 0) continue;
        const deck = decks[0];
        deck.bulks = deck.bulks ?? [];
        // bulk.id "26" → bulk-26 SVG template (floor-icon pictogram).
        // Width/height chosen large enough for the close-up to land a few
        // pixels of the substituted fill, position chosen to sit clear of
        // the cabin so it doesn't overlap real seats in the screenshot.
        deck.bulks.push({
          id: '26',
          type: 'left',
          width: 200,
          height: 200,
          xOffset: 50,
          topOffset: 50,
          align: 'left',
        });
        break;
      }
    },
    verify: async page => {
      // The `bulkFloorIconColor` token threads through to the `fill`
      // attribute of every `path.icon.bulk` inside the bulk-26 SVG.
      // Reading the first match is sufficient — all four paths in
      // bulk-26's template carry the same `$stickerColor` substitution.
      const fill = await page
        .locator('.jets-bulk:has(svg#bulk-26) .jets-bulk__icon svg path.icon.bulk')
        .first()
        .getAttribute('fill');
      expect(fill).toBe('#ffeb3b');
    },
  },

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
  // deckHeightSpacing pads the top/bottom of `.jets-deck` (native px scaled by
  // deck scale). BASELINE_THEME already sets 100; this case bumps it to 200,
  // so paddingTop ≈ 200*scale (~49 at the demo's ~0.247 scale) — comfortably
  // above the 4px CSS default and the ~25 px baseline shoulder. The screenshot
  // picks up the shift; the verify pins the binding at the DOM level so a
  // silent regression can't slip through.
  {
    field: 'deckHeightSpacing',
    value: 200,
    verify: async page => {
      const paddingTop = await page
        .locator('.jets-deck')
        .first()
        .evaluate(el => parseFloat(getComputedStyle(el).paddingTop));
      expect(paddingTop).toBeGreaterThanOrEqual(40);
    },
  },
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
  // Wings collapse to ~12 px at the full-deck downscale (baseline 50 × the
  // demo's ~0.247 scale). Crop to one wing element so the visual diff and
  // any future regression are obvious; DOM-verify pins the rendered SVG
  // `width` attribute since the override scales with deck scale.
  {
    field: 'wingsWidth',
    value: 150,
    closeUp: { kind: 'element', selector: '.jets-wing--left', padding: 12 },
    verify: async page => {
      const width = await page
        .locator('.jets-wing--left')
        .first()
        .evaluate(el => Number(el.getAttribute('width') ?? '0'));
      // 150 native × ~0.247 deck scale ≈ 37 px; baseline 50 × 0.247 ≈ 12 px.
      expect(width).toBeGreaterThanOrEqual(30);
    },
  },

  // ─── Fuselage ─────────────────────────────────────────────────────────
  // fuselageStrokeWidth renders as the CSS `border-left/right-width` of
  // `.jets-plane-body__fuselage`. The visual delta (16→18) is sub-pixel at
  // the per-field zoom; pin the binding at the DOM level.
  {
    field: 'fuselageStrokeWidth',
    value: 18,
    verify: async page => {
      const width = await page
        .locator('.jets-plane-body__fuselage')
        .first()
        .evaluate(el => parseFloat(getComputedStyle(el).borderLeftWidth));
      // Override 18 must visibly exceed baseline 12 — both go through the
      // same displayScale (~0.25-0.3 with the production
      // `_computeNativeDeckWidth` that counts aisles), so the rendered
      // baseline ends up ~3-4 px and the override ~5-6 px. Lower bound 4
      // sits between them and survives small flight/aircraft variance.
      expect(width).toBeGreaterThan(4);
    },
  },
  {
    // `fuselageFillColor` is intentionally scoped to a thin (~16 px) hull
    // lining band along the sides of `.jets-plane-body__fuselage` — the
    // outer `.deck-floor` covers the rest of the interior with
    // `colorTheme.floorColor` (see commit ea1f31d "expose
    // colorTheme.fuselageFillColor as a visible hull lining"). At the
    // full-deck downscale used for the per-field screenshot that 16 px
    // band is only ~1-2 px wide and easy to miss visually, so pin the
    // binding at the DOM level: the override must reach the fuselage
    // element's `background-color`.
    field: 'fuselageFillColor',
    value: '#e1bee7',
    closeUp: { kind: 'element', selector: '.jets-plane-body__fuselage', padding: 0 },
    verify: async page => {
      const bg = await page
        .locator('.jets-plane-body__fuselage')
        .first()
        .evaluate(el => (el as HTMLElement).style.backgroundColor);
      expect(bg).toBe('rgb(225, 190, 231)');
    },
  },
  { field: 'fuselageStrokeColor', value: '#ff1744' },
  { field: 'fuselageWindowsColor', value: '#00e5ff' },
  { field: 'fuselageWingsColor', value: 'rgba(255, 0, 0, 0.8)' },
  // NOTE: fuselageNoseType is documented as accepting an aircraft key (e.g.
  // 'A320', 'B747', 'TU204') or the special 'default' / 'by-type'. In the
  // current lib, `nose-template.service.ts:getNoseImage` looks up the
  // noseType verbatim in `noseMap` and falls back to `noseMap.default` for
  // any miss — and `'by-type'` is not a key in noseMap, so both the
  // baseline 'by-type' AND the override 'default' resolve to the same
  // generic SVG. The screenshot here therefore documents that the override
  // resolves at all (close-up renders the default nose silhouette); the
  // verify pins the rendered viewBox to the default template's 214 height,
  // which doubles as a regression guard if the lookup gains a 'by-type' →
  // aircraft mapping later.
  {
    field: 'fuselageNoseType',
    value: 'default',
    closeUp: { kind: 'element', selector: '.jets-nose', padding: 8 },
    verify: async page => {
      const viewBox = await page.locator('.jets-nose svg').first().getAttribute('viewBox');
      expect(viewBox).toBe('0 0 200 214');
    },
  },

  // ─── Exit icons ───────────────────────────────────────────────────────
  // Exit icons render as <img src=...> inside `.jets-exit--left/--right`.
  // The full-deck downscale renders each icon at ~10×10 px; crop to a
  // single exit and pin the `<img src>` so a silent override drop fails.
  {
    field: 'exitIconUrlLeft',
    value: 'https://panorama.quicket.io/icons/exit_icon_red.svg',
    closeUp: { kind: 'element', selector: '.jets-exit--left', padding: 12 },
    verify: async page => {
      const src = await page.locator('.jets-exit--left .jets-exit__icon').first().getAttribute('src');
      expect(src).toBe('https://panorama.quicket.io/icons/exit_icon_red.svg');
    },
  },
  {
    field: 'exitIconUrlRight',
    value: 'https://panorama.quicket.io/icons/exit_icon_red.svg',
    closeUp: { kind: 'element', selector: '.jets-exit--right', padding: 12 },
    verify: async page => {
      const src = await page.locator('.jets-exit--right .jets-exit__icon').first().getAttribute('src');
      expect(src).toBe('https://panorama.quicket.io/icons/exit_icon_red.svg');
    },
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
    // In the `pre: 'tooltip'` path no passengers are seated, so the Select
    // button mounts in the `[disabled]="isSelectDisabled()"` branch.
    // Chromium's UA stylesheet on disabled form controls applies an internal
    // `-internal-disabled-color` that shadows an authored inline `color`,
    // making the override visually disappear even though the binding lands.
    // Pin the resolved colour at the DOM level so the regression cannot
    // sneak back in.
    field: 'tooltipSelectButtonTextColor',
    value: '#000000',
    pre: 'tooltip',
    closeUp: TOOLTIP_CLOSEUP,
    verify: async page => {
      // Check both `color` AND `-webkit-text-fill-color`: Chromium's UA
      // stylesheet paints disabled <button> text with an internal
      // `-internal-disabled-color` that shadows the authored `color` at
      // paint time. `-webkit-text-fill-color` is what the engine actually
      // rasterises and is the only computed property that reflects the
      // override surviving the disabled-state shadow. Reading just
      // `color` would have passed even when the rendered pixels were
      // white-on-blue.
      await expect
        .poll(
          () =>
            page
              .locator('.jets-tooltip .jets-select-btn')
              .first()
              .evaluate(el => {
                const cs = getComputedStyle(el);
                return { color: cs.color, fill: cs.webkitTextFillColor };
              }),
          { timeout: 5_000 }
        )
        .toEqual({ color: 'rgb(0, 0, 0)', fill: 'rgb(0, 0, 0)' });
    },
  },
  {
    field: 'tooltipSelectButtonBackgroundColor',
    value: '#ffeb3b',
    pre: 'tooltip',
    closeUp: TOOLTIP_CLOSEUP,
  },
  {
    // Same low-contrast intent as field-tooltipSelectButtonTextColor: black
    // text on the baseline dark-grey Cancel button. Visual LLMs repeatedly
    // misread the near-invisible glyphs as white; DOM-verify pins the
    // computed colour as ground truth.
    field: 'tooltipCancelButtonTextColor',
    value: '#000000',
    pre: 'tooltip',
    closeUp: TOOLTIP_CLOSEUP,
    verify: async page => {
      const computed = await page
        .locator('.jets-cancel-btn')
        .first()
        .evaluate(el => getComputedStyle(el).color);
      expect(computed).toBe('rgb(0, 0, 0)');
    },
  },
  {
    field: 'tooltipCancelButtonBackgroundColor',
    value: '#ffeb3b',
    pre: 'tooltip',
    closeUp: TOOLTIP_CLOSEUP,
  },

  // ─── Score-based custom seat colors ──────────────────────────────────
  // NOTE: customSeatColorRanges is score-gated — it only paints seats whose
  // API data carries a `score` field in the 1-10 range (see
  // _calculateSeatColorByScore in jets-seat-map-preparer.service.ts). The
  // demo's flights are loaded from a live API that doesn't return scores, so
  // the per-field screenshot here will visually match its baseline — the
  // ranges are configured but the gate never opens. Unit coverage for the
  // score-tier palette lives in
  // projects/seatmap-lib/src/lib/services/jets-seat-map-preparer.service.spec.ts
  // ("seat colour: customSeatColorRanges vs API color"); the screenshot
  // stays as documentation of the public-API surface, with a verify
  // callback that asserts the seat fill falls back to its API colour rather
  // than any of the prescribed ranges — proving the gate behaves as
  // documented even when the demo can't show the painted state.
  {
    field: 'customSeatColorRanges',
    value: [
      { color: '#ff1744', range: [1, 3.99] },
      { color: '#ffea00', range: [4, 7.99] },
      { color: '#00e676', range: [8, 10] },
    ],
    omitFromBaseline: ['seatAvailableColor'],
    closeUp: FEW_ROWS_FROM_TOP,
    verify: async page => {
      // Collect every available seat's primary path.bd fill — the score-tier
      // path would have stamped one of the configured range colours onto at
      // least one seat. Use poll so DOM hydration after applyConfigAndReady
      // doesn't race the read (same flaky-locator class as the other seat-SVG
      // verify callbacks in this spec).
      const rangeColours = new Set(['#ff1744', '#ffea00', '#00e676']);
      await expect
        .poll(
          async () => {
            const fills = await page
              .locator('.jets-seat__svg path.bd')
              .evaluateAll(els => els.map(el => el.getAttribute('fill')?.toLowerCase() ?? null));
            return fills.some(f => f && rangeColours.has(f));
          },
          { timeout: 10_000 }
        )
        .toBe(false);
    },
  },
];

test.describe('colorTheme · per-field matrix', () => {
  for (const c of FIELD_CASES) {
    test(`field-${c.field}`, async ({ page }) => {
      // Install the API-response mutator BEFORE navigation so the first
      // seatmap fetch picks it up. The route is scoped to this page only,
      // so it does not bleed into adjacent tests.
      if (c.mockApi) {
        const mutate = c.mockApi;
        await page.route('**/flight/features/plane/seatmap', async route => {
          const response = await route.fetch();
          const json = await response.json();
          mutate(json);
          await route.fulfill({
            response,
            body: JSON.stringify(json),
          });
        });
      }
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
