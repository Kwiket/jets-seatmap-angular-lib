# Seat colour React parity + class palette — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Angular seat colouring match React — drop the `colorfulSeatsByScore` gate and the `colorfulSeatsByClass` lightness tint — and add a data-driven `customSeatColorClasses` palette that the demo apps use to build the on/off toggles.

**Architecture:** Score and class colours are resolved in the preparer into each seat's `color`/`originalColor` (`score ?? class ?? apiColor`). The seat component keeps the `seatAvailableColor`/`forceThemeSeatColors` force override and the availability handler keeps overriding with availability colours. No behavioural flags remain in the library; the demo composes config (`customSeatColorRanges` / `customSeatColorClasses` / `seatAvailableColor`) to express the toggles.

**Tech Stack:** Angular 21 standalone components, Vitest unit tests (`ng test seatmap-lib`), Playwright e2e (`projects/seatmap-demo/e2e`).

## Global Constraints

- Branch: `dev` of `jets-seatmap-angular-lib`. Commit (and push) only to `dev`; admin merges to `main`.
- No Russian in code/comments/JSON or fenced code blocks — English only.
- Full priority order (verbatim from spec): **seatAvailableColor(force) > availability colour > score (`customSeatColorRanges`) > class (`customSeatColorClasses`) > API `seat.color` > theme default**. When both ranges and classes are defined, score wins.
- Unit suite command: `npx ng test seatmap-lib --watch=false` (runs the whole vitest suite, ~3s; there is no reliable single-test filter through the ng wrapper — run the whole suite).
- e2e command (dev demo already served on :4201): `PW_BASE_URL=http://localhost:4201 npx playwright test --config projects/seatmap-demo/e2e/playwright.config.ts <path> --workers=1`. If :4201 is not running, start it first: `npx ng serve seatmap-demo --port 4201` from the repo root.
- `TCabinClass = 'E' | 'P' | 'B' | 'F' | 'A'` (`types.ts:2`).
- The husky pre-commit hook warns `prettier: command not found` — harmless, the commit still lands.

---

### Task 1: Add `customSeatColorClasses` type, class-colour resolver, and merge validation (additive)

Purely additive — the library still compiles and all tests stay green.

**Files:**
- Modify: `projects/seatmap-lib/src/lib/types.ts` (IColorTheme, ~line 131-139)
- Modify: `projects/seatmap-lib/src/lib/services/jets-seat-map-preparer.service.ts` (add `_calculateSeatColorByClass` near `_calculateSeatColorByScore:1244`; extend `mergeColorThemeWithConstraints:1264`)
- Test: `projects/seatmap-lib/src/lib/services/jets-seat-map-preparer.service.spec.ts` (new describe block near the `_calculateSeatColorByScore` describe at line 456)

**Interfaces:**
- Produces: `IColorTheme.customSeatColorClasses?: Partial<Record<TCabinClass, string>>`
- Produces: `static _calculateSeatColorByClass(classCode: string | undefined, classMap?: Partial<Record<TCabinClass, string>>): string | null`
- Produces: `mergeColorThemeWithConstraints` now drops `customSeatColorClasses` entries whose value is not a non-empty string.

- [ ] **Step 1: Write the failing tests**

Add to `jets-seat-map-preparer.service.spec.ts` (after the existing `describe('_calculateSeatColorByScore', ...)` block, ~line 503):

```typescript
describe('_calculateSeatColorByClass', () => {
  it('returns the mapped colour for the seat class (case-insensitive)', () => {
    const map = { F: '#ff0000', E: '#0000ff' };
    expect(JetsSeatMapPreparerService._calculateSeatColorByClass('F', map)).toBe('#ff0000');
    expect(JetsSeatMapPreparerService._calculateSeatColorByClass('e', map)).toBe('#0000ff');
  });

  it('returns null when the class has no mapping', () => {
    expect(JetsSeatMapPreparerService._calculateSeatColorByClass('B', { F: '#ff0000' })).toBeNull();
  });

  it('returns null for missing class code or map', () => {
    expect(JetsSeatMapPreparerService._calculateSeatColorByClass(undefined, { F: '#ff0000' })).toBeNull();
    expect(JetsSeatMapPreparerService._calculateSeatColorByClass('F', undefined)).toBeNull();
  });

  it('returns null for an empty colour string', () => {
    expect(JetsSeatMapPreparerService._calculateSeatColorByClass('F', { F: '' })).toBeNull();
  });
});
```

Add inside the existing `describe('mergeColorThemeWithConstraints', ...)` block (after line 531):

```typescript
    it('should filter invalid customSeatColorClasses entries', () => {
      const result = JetsSeatMapPreparerService.mergeColorThemeWithConstraints({
        customSeatColorClasses: { F: '#FF0000', E: '', B: 123 as unknown as string },
      });
      expect(result.customSeatColorClasses).toEqual({ F: '#FF0000' });
    });
```

- [ ] **Step 2: Run the suite to verify the new tests fail**

Run: `npx ng test seatmap-lib --watch=false`
Expected: FAIL — `_calculateSeatColorByClass is not a function` and the merge test sees `customSeatColorClasses` unchanged.

- [ ] **Step 3: Add the type**

In `types.ts`, inside `IColorTheme`, right after the `customSeatColorRanges` field (line 131), add:

```typescript
  /**
   * Per-class flat colour palette. When a colour is set for a seat's cabin
   * class, available seats of that class render in it (below score ranges,
   * above the API seat colour). Data-driven counterpart to customSeatColorRanges.
   */
  customSeatColorClasses?: Partial<Record<TCabinClass, string>>;
```

- [ ] **Step 4: Add the resolver**

In `jets-seat-map-preparer.service.ts`, immediately after `_calculateSeatColorByScore` (closing brace at line 1261), add:

```typescript
  static _calculateSeatColorByClass(
    classCode: string | undefined,
    classMap?: Partial<Record<TCabinClass, string>>
  ): string | null {
    if (!classCode || !classMap) {
      return null;
    }
    const color = classMap[classCode.toUpperCase() as TCabinClass];
    return typeof color === 'string' && color.length > 0 ? color : null;
  }
```

Ensure `TCabinClass` is imported in this file. Check the existing import block; if absent, add `TCabinClass` to the `from '../types'` import.

- [ ] **Step 5: Add merge validation**

In `mergeColorThemeWithConstraints`, after the `customSeatColorRanges` validation block (line 1284, before `return merged;`), add:

```typescript
    // Validate customSeatColorClasses — keep only non-empty string colours
    if (merged.customSeatColorClasses) {
      const cleaned: Partial<Record<TCabinClass, string>> = {};
      for (const key of Object.keys(merged.customSeatColorClasses) as TCabinClass[]) {
        const value = merged.customSeatColorClasses[key];
        if (typeof value === 'string' && value.length > 0) {
          cleaned[key] = value;
        }
      }
      merged.customSeatColorClasses = cleaned;
    }
```

- [ ] **Step 6: Run the suite to verify it passes**

Run: `npx ng test seatmap-lib --watch=false`
Expected: PASS (all tests, including the new ones).

- [ ] **Step 7: Commit**

```bash
git add projects/seatmap-lib/src/lib/types.ts projects/seatmap-lib/src/lib/services/jets-seat-map-preparer.service.ts projects/seatmap-lib/src/lib/services/jets-seat-map-preparer.service.spec.ts
git commit -m "feat(seatmap-lib): add customSeatColorClasses palette resolver and validation"
```

---

### Task 2: Remove the score gate and wire the class palette into prepared seat colour

**Files:**
- Modify: `projects/seatmap-lib/src/lib/services/jets-seat-map-preparer.service.ts` (`_calculateSeatColorByScore:1244`, `_prepareRowNew:224` signature + caller `:185`, new-format seat colour `:315-324`, legacy seat colour `:830-839`)
- Modify: `projects/seatmap-lib/src/lib/services/jets-seat-map-preparer.service.spec.ts` (replace the gate test at lines 378-404)

**Interfaces:**
- Consumes: `_calculateSeatColorByClass` (Task 1).
- Produces: prepared seat `color`/`originalColor` = `scoreRangeColour ?? classColour ?? apiColour ?? undefined`. `_calculateSeatColorByScore` no longer takes an `enabled` parameter. `_prepareRowNew` no longer takes a `colorfulSeatsByScore` parameter.

- [ ] **Step 1: Replace the gate unit test with precedence tests**

In the preparer spec, the `ranges` array is `[1,3]→#FF0000`, `[4,7]→#FFFF00`, `[8,10]→#00FF00` and `configWithRanges` uses it (lines 318-326). Delete the test at lines 378-404 (`'new format: API seat.color wins when colorfulSeatsByScore is false'`) and replace it with:

```typescript
      it('new format: class colour fills in when score has no matching range', () => {
        const response: IApiSeatmapResponse = {
          decks: [
            {
              rows: [
                {
                  classCode: 'F',
                  seats: [
                    { letter: 'A', seatNumber: '1A', type: 0, seatType: 0, score: 11, color: '#6CB64A' } as any,
                  ],
                },
              ],
            },
          ],
        };
        const seat = service.prepareContent(response, {
          ...baseConfig,
          colorTheme: { customSeatColorRanges: ranges, customSeatColorClasses: { F: '#123456' } },
        })[0].rows[0].seats[0];
        // score 11 is out of every range -> class palette (#123456) wins over API #6CB64A
        expect(seat.color).toBe('#123456');
      });

      it('new format: score range wins over class palette when both match', () => {
        const response: IApiSeatmapResponse = {
          decks: [
            {
              rows: [
                {
                  classCode: 'F',
                  seats: [
                    { letter: 'A', seatNumber: '1A', type: 0, seatType: 0, score: 2, color: '#6CB64A' } as any,
                  ],
                },
              ],
            },
          ],
        };
        const seat = service.prepareContent(response, {
          ...baseConfig,
          colorTheme: { customSeatColorRanges: ranges, customSeatColorClasses: { F: '#123456' } },
        })[0].rows[0].seats[0];
        // score 2 in [1,3] -> #FF0000 wins over class palette
        expect(seat.color).toBe('#FF0000');
      });
```

- [ ] **Step 2: Run the suite to verify the new tests fail**

Run: `npx ng test seatmap-lib --watch=false`
Expected: FAIL — class palette is not yet wired, so `seat.color` falls back to API `#6CB64A` in the first new test.

- [ ] **Step 3: Drop the `enabled` gate from `_calculateSeatColorByScore`**

Replace the signature/body (lines 1244-1261) with:

```typescript
  static _calculateSeatColorByScore(
    score: number | undefined,
    colorRanges?: Array<{ range: [number, number]; color: string }>
  ): string | null {
    if (
      typeof score !== 'number' ||
      score < 1 ||
      score > 10 ||
      !Array.isArray(colorRanges) ||
      !colorRanges.length
    ) {
      return null;
    }
    const found = colorRanges.find(r => score >= r.range[0] && score <= r.range[1]);
    return found?.color ?? null;
  }
```

- [ ] **Step 4: Remove the gate param from `_prepareRowNew` and its caller**

At line 234 remove the parameter `colorfulSeatsByScore = true` (delete the line and the trailing comma on the previous `units?: string,` line stays as the last param). At the caller (lines 175-186) delete the argument `config.colorfulSeatsByScore ?? true` (and the comma on the previous line `config.units,`).

- [ ] **Step 5: Wire score + class into the new-format seat colour**

In `_prepareRowNew`, move the `classCode` computation above `seatColor` and rewrite the colour (lines 315-324) to:

```typescript
      const classCode = (row.classCode ?? row.cabinClass ?? s.classType ?? 'E').toUpperCase();
      const seatColor =
        JetsSeatMapPreparerService._calculateSeatColorByScore(s.score, colorTheme?.customSeatColorRanges) ??
        JetsSeatMapPreparerService._calculateSeatColorByClass(classCode, colorTheme?.customSeatColorClasses) ??
        s.color ??
        undefined;
```

(Delete the now-duplicate `const classCode = ...` that previously sat at line 324.)

- [ ] **Step 6: Wire score + class into the legacy-format seat colour**

In the legacy path, move `classCode` (line 839) above `seatColor` and rewrite (lines 830-839) to:

```typescript
      const classCode = (row.classCode ?? row.cabinClass ?? newSeat?.classType ?? 'E').toUpperCase();
      const seatColor =
        JetsSeatMapPreparerService._calculateSeatColorByScore(seatScore, config.colorTheme?.customSeatColorRanges) ??
        JetsSeatMapPreparerService._calculateSeatColorByClass(classCode, config.colorTheme?.customSeatColorClasses) ??
        seatApiColor ??
        undefined;
```

(Delete the now-duplicate `const classCode = ...` at the old line 839.)

- [ ] **Step 7: Run the suite to verify it passes**

Run: `npx ng test seatmap-lib --watch=false`
Expected: PASS. The pre-existing tests `'range colour wins over API seat.color when score matches'` and `'API seat.color wins when score is out of every range'` still pass (those configs define no classes).

- [ ] **Step 8: Commit**

```bash
git add projects/seatmap-lib/src/lib/services/jets-seat-map-preparer.service.ts projects/seatmap-lib/src/lib/services/jets-seat-map-preparer.service.spec.ts
git commit -m "feat(seatmap-lib): drop score gate, resolve score>class>API seat colour (React parity)"
```

---

### Task 3: Remove the class lightness tint from the seat component and threading

**Files:**
- Modify: `projects/seatmap-lib/src/lib/components/jets-seat/jets-seat.component.ts` (import :21, `@Input` :119-121, tint branch :441-442)
- Modify: `projects/seatmap-lib/src/lib/components/jets-row/jets-row.component.ts` (:24, :35, :70)
- Modify: `projects/seatmap-lib/src/lib/components/jets-deck/jets-deck.component.ts` (:100, :199)
- Modify: `projects/seatmap-lib/src/lib/components/jets-seat-map/jets-seat-map.component.html` (:118)
- Modify: `projects/seatmap-lib/src/lib/components/jets-seat-map/jets-seat-map.component.ts` (`resolvedConfig` :187-188)
- Delete: `projects/seatmap-lib/src/lib/utils/color-tint.ts`
- Delete: `projects/seatmap-lib/src/lib/utils/color-tint.spec.ts`
- Modify: `projects/seatmap-lib/src/lib/components/jets-seat/jets-seat.component.spec.ts` (delete the `describe('colorfulSeatsByClass', ...)` block, ~lines 494-543)

**Interfaces:**
- Consumes: prepared `data.color` now already carries score/class/API colour (Task 2), so the available branch needs no class logic.

- [ ] **Step 1: Remove the tint from `_resolveStyle`**

In `jets-seat.component.ts`, the available branch (lines 436-445) becomes:

```typescript
      case 'available': {
        const base =
          force || availOverride
            ? (theme.seatAvailableColor ?? def.seatAvailableColor)
            : (this.data.color ?? def.seatAvailableColor);
        fillColor = base;
        break;
      }
```

Delete the import at line 21 (`import { tintSeatColorForClass } from '../../utils/color-tint';`) and the `@Input() colorfulSeatsByClass = false;` plus its doc comment (lines 119-121).

- [ ] **Step 2: Remove the threading**

- `jets-row.component.ts`: delete `colorfulSeatsByClass: colorfulSeatsByClass,` (line 24), the `[colorfulSeatsByClass]="colorfulSeatsByClass"` binding (line 35), and the `@Input() colorfulSeatsByClass = false;` (line 70).
- `jets-deck.component.ts`: delete the `[colorfulSeatsByClass]="colorfulSeatsByClass"` binding (line 100) and the `@Input() colorfulSeatsByClass = false;` (line 199).
- `jets-seat-map.component.html`: delete the `[colorfulSeatsByClass]="resolvedConfig.colorfulSeatsByClass ?? false"` binding (line 118).
- `jets-seat-map.component.ts`: in the `resolvedConfig` object, delete `colorfulSeatsByClass: this.config?.colorfulSeatsByClass ?? false,` and `colorfulSeatsByScore: this.config?.colorfulSeatsByScore ?? true,` (lines 187-188).

- [ ] **Step 3: Delete the tint utility and its spec**

```bash
git rm projects/seatmap-lib/src/lib/utils/color-tint.ts projects/seatmap-lib/src/lib/utils/color-tint.spec.ts
```

- [ ] **Step 4: Remove the obsolete seat-component tint tests**

In `jets-seat.component.spec.ts`, delete the entire `describe('colorfulSeatsByClass', () => { ... })` block (the comment banner at line 494 through the block's closing `});` around line 543). Verify no other test in this file references `colorfulSeatsByClass`.

- [ ] **Step 5: Run the suite to verify it passes**

Run: `npx ng test seatmap-lib --watch=false`
Expected: PASS. (If TypeScript complains about a leftover `colorfulSeatsByClass` reference, grep the lib `src` for it and remove the straggler.)

- [ ] **Step 6: Commit**

```bash
git add -A projects/seatmap-lib/src/lib
git commit -m "refactor(seatmap-lib): remove colorfulSeatsByClass tint and its threading"
```

---

### Task 4: Remove the dead IConfig/IColorTheme fields and clean up demo + e2e config references

By now nothing in the library reads `colorfulSeatsByScore` / `colorfulSeatsByClass` / `seatClassTints`, so the fields can go. This also touches the demo and e2e configs that still set them.

**Files:**
- Modify: `projects/seatmap-lib/src/lib/types.ts` (IConfig `colorfulSeatsByClass` :186-191, `colorfulSeatsByScore` :192-199; IColorTheme `seatClassTints` :132-137)
- Modify: `projects/seatmap-demo/src/app/flights.data.ts` (:49-50)
- Modify: `projects/seatmap-demo/e2e/exitIcons/exitIcons.spec.ts` (:37-38)
- Modify: `projects/seatmap-demo/e2e/customSeatColorRanges/customSeatColorRanges.spec.ts` (gate test :100-124)

- [ ] **Step 1: Remove the type fields**

In `types.ts`:
- Delete the `colorfulSeatsByClass?: boolean;` field and its doc comment (lines 186-191).
- Delete the `colorfulSeatsByScore?: boolean;` field and its doc comment (lines 192-199).
- Delete the `seatClassTints?: Partial<Record<TCabinClass, string>>;` field and its doc comment (lines 132-137).

- [ ] **Step 2: Remove the demo config flags**

In `flights.data.ts`, delete lines 49-50 from `BASE_CONFIG`:

```typescript
  colorfulSeatsByClass: false,
  colorfulSeatsByScore: true,
```

- [ ] **Step 3: Remove the exitIcons e2e config flags**

In `exitIcons/exitIcons.spec.ts`, delete the two config lines (37-38):

```typescript
  colorfulSeatsByClass: false,
  colorfulSeatsByScore: true,
```

- [ ] **Step 4: Rewrite the gate e2e test**

The test `'disabled — colorfulSeatsByScore:false ignores ranges (QT888)'` (lines 100-124) asserted the removed gate. Replace it with a test that score ranges now always apply when defined. Read the surrounding spec (its sentinel-range helper and `applyConfigAndReady` usage at the top of the file) and rewrite the single `test(...)` block so it:
- applies a config with `customSeatColorRanges` mapping the whole `[1,10]` score band to one sentinel colour and NO `colorfulSeatsByScore` key;
- asserts at least one rendered seat body uses the sentinel colour (ranges are honoured purely from their presence).

Keep the same helper imports already used at the top of the file. Concretely:

```typescript
  test('ranges always apply when present (no gate)', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(
      page,
      { colorTheme: { customSeatColorRanges: [{ range: [1, 10], color: '#abcdef' }] } },
      { availability: [] }
    );
    const hits = await page.evaluate(() => {
      const seats = Array.from(document.querySelectorAll('.jets-seat--available')) as HTMLElement[];
      let n = 0;
      for (const seat of seats) {
        for (const p of Array.from(seat.querySelectorAll('svg path'))) {
          if ((p.getAttribute('fill') || '').toLowerCase() === '#abcdef') { n++; break; }
        }
      }
      return n;
    });
    expect(hits, 'sentinel range colour must appear on available seats').toBeGreaterThan(0);
  });
```

(If the file's existing imports do not include `applyConfigAndReady`, add it from `../helpers/demo`.)

- [ ] **Step 5: Verify unit + e2e**

Run: `npx ng test seatmap-lib --watch=false` → Expected: PASS.
Then (dev demo on :4201): `PW_BASE_URL=http://localhost:4201 npx playwright test --config projects/seatmap-demo/e2e/playwright.config.ts customSeatColorRanges exitIcons --workers=1` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A projects/seatmap-lib/src/lib/types.ts projects/seatmap-demo
git commit -m "refactor: remove colorfulSeatsBy* config fields and seatClassTints; update demo + e2e"
```

---

### Task 5: Demo colour-priority e2e (4 combinations + availability)

Verify the demo can express all four toggle states purely through config, and that availability colours still win.

**Files:**
- Create: `projects/seatmap-demo/e2e/seatColors/seatColors.spec.ts`

**Interfaces:**
- Consumes: `applyConfigAndReady` from `../helpers/demo` (signature `(page, configOverrides, { availability? })`).

- [ ] **Step 1: Write the e2e**

```typescript
import { test, expect, type Page } from '@playwright/test';
import { applyConfigAndReady } from '../helpers/demo';

const RANGES = [{ range: [1, 10] as [number, number], color: '#abcdef' }];
const CLASSES = { F: '#111111', B: '#222222', P: '#333333', E: '#444444', A: '#555555' };
const FLAT = '#0a0a0a';

async function bodyColours(page: Page): Promise<Set<string>> {
  return new Set(
    await page.evaluate(() => {
      const grey = new Set(['rgb(169, 169, 169)', 'rgb(235, 235, 235)', 'rgb(255, 255, 255)', 'white', 'none']);
      const out: string[] = [];
      for (const seat of Array.from(document.querySelectorAll('.jets-seat--available')) as HTMLElement[]) {
        for (const p of Array.from(seat.querySelectorAll('svg path'))) {
          const f = (p.getAttribute('fill') || '').toLowerCase().trim();
          if (f && !grey.has(f)) { out.push(f); break; }
        }
      }
      return out;
    })
  );
}

test.describe('seat colour modes (config-driven)', () => {
  test('both off: seatAvailableColor flattens every available seat', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, { colorTheme: { seatAvailableColor: FLAT } }, { availability: [] });
    const colours = await bodyColours(page);
    expect(colours.size).toBe(1);
    expect([...colours][0]).toBe(FLAT);
  });

  test('score on: ranges colour the seats', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, { colorTheme: { customSeatColorRanges: RANGES } }, { availability: [] });
    expect(await bodyColours(page)).toContain('#abcdef');
  });

  test('class on: class palette overrides the API colour', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, { colorTheme: { customSeatColorClasses: CLASSES } }, { availability: [] });
    const colours = await bodyColours(page);
    expect([...colours].every(c => Object.values(CLASSES).map(v => v.toLowerCase()).includes(c))).toBe(true);
  });

  test('both on: score wins over class', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(
      page,
      { colorTheme: { customSeatColorRanges: RANGES, customSeatColorClasses: CLASSES } },
      { availability: [] }
    );
    const colours = await bodyColours(page);
    expect(colours.has('#abcdef')).toBe(true);
  });

  test('availability colour overrides score', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(
      page,
      { colorTheme: { customSeatColorRanges: RANGES } },
      { availability: [{ label: '*', price: 10, currency: 'USD', color: '#fe00fe' }] }
    );
    expect(await bodyColours(page)).toContain('#fe00fe');
  });
});
```

- [ ] **Step 2: Run the e2e**

Run: `PW_BASE_URL=http://localhost:4201 npx playwright test --config projects/seatmap-demo/e2e/playwright.config.ts seatColors --workers=1`
Expected: PASS (5 tests). If the dev server is stale, rebuild/restart per the Global Constraints note.

- [ ] **Step 3: Commit**

```bash
git add projects/seatmap-demo/e2e/seatColors/seatColors.spec.ts
git commit -m "test(seatmap-demo): e2e for config-driven seat colour priority + availability"
```

---

### Task 6: README documentation

**Files:**
- Modify: `projects/seatmap-lib/README.md` (the score-colouring section, ~lines 530-541)

- [ ] **Step 1: Document the new option and priority**

After the existing "Priority order: Score-based color > Original seat color > Default color." line (531-541), add a subsection documenting:
- `customSeatColorRanges` — score → colour (already partly covered), now always applied when present (no flag).
- `customSeatColorClasses` — `Partial<Record<'F'|'B'|'P'|'E'|'A', string>>`, per-class flat colour.
- The full priority: `seatAvailableColor (force) > availability colour > customSeatColorRanges (score) > customSeatColorClasses (class) > API seat.color > theme default`.
- A note that the removed `colorfulSeatsByScore` / `colorfulSeatsByClass` flags no longer exist; consumers express on/off by including/omitting the palettes (and `seatAvailableColor` for a flat look).

```markdown
### Seat colour priority

Available seats resolve their colour top-down:

1. `colorTheme.seatAvailableColor` / `forceThemeSeatColors` — forces every available seat to one colour.
2. `availability[].color` (individual entry > `*` wildcard) when the `availability` input is supplied.
3. `colorTheme.customSeatColorRanges` — score → colour; applied whenever ranges are defined and the seat `score` ∈ [1,10] matches.
4. `colorTheme.customSeatColorClasses` — `Partial<Record<'F'|'B'|'P'|'E'|'A', string>>`; per-class flat colour.
5. The seat's API `color`.
6. Theme default available colour.

There is no `colorfulSeatsByScore` / `colorfulSeatsByClass` flag — enable each axis by providing the
corresponding palette; for a flat look set `seatAvailableColor`.
```

- [ ] **Step 2: Commit**

```bash
git add projects/seatmap-lib/README.md
git commit -m "docs(seatmap-lib): document seat colour priority and customSeatColorClasses"
```

---

### Final: push and verify

- [ ] Run the full unit suite once more: `npx ng test seatmap-lib --watch=false` → all green.
- [ ] Run the touched e2e: `PW_BASE_URL=http://localhost:4201 npx playwright test --config projects/seatmap-demo/e2e/playwright.config.ts seatColors customSeatColorRanges exitIcons --workers=1` → all green.
- [ ] `git push origin dev`.

## Out of scope

The separate promo demo repo (`jets-seatmap-angular-lib-demo`) is rewired to the new options in a
follow-up after a new lib version is published — on a `dev` branch off its `main`, never on `main`.
