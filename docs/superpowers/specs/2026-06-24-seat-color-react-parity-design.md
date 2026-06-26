# Seat colouring — React parity + data-driven class palette

Date: 2026-06-24
Status: Approved (design)
Scope target: `jets-seatmap-angular-lib` (library) + in-repo demo (`projects/seatmap-demo`). Branch: `dev`.

## Problem

The Angular library diverges from the upstream React library in how seats are coloured:

1. **`colorfulSeatsByScore`** — an Angular-only boolean gate wrapped around React's always-on
   score colouring. In React, score colouring is controlled *only* by the presence of
   `colorTheme.customSeatColorRanges`. The extra gate means `colorfulSeatsByScore: false`
   suppresses a defined `customSeatColorRanges` — behaviour React and the README do not have.
2. **`colorfulSeatsByClass`** — an Angular-only feature with no React counterpart. It applies a
   subtle per-class HSL *lightness tint* (`utils/color-tint.ts`, `theme.seatClassTints`) on top of
   the base colour. It reads as "not working" because it is a small shade shift, not a distinct
   per-class palette.

Neither flag is documented in the library README. The goal is to make the library resemble React,
and move presentation policy (the on/off toggles) into the demo apps.

## Goal

- Remove the `colorfulSeatsByScore` gate → score colouring is driven solely by
  `customSeatColorRanges` (React parity).
- Remove the `colorfulSeatsByClass` lightness tint (and its `color-tint.ts` / `seatClassTints`
  infrastructure).
- Add a new **data-driven** `customSeatColorClasses` palette (class code → colour). When defined,
  available seats of that class render in that colour. This is the *one* deliberate, documented
  divergence from React — but it is a palette map in the same style as `customSeatColorRanges`,
  not a behavioural flag.
- The demo apps implement the `colorfulSeatsByScore` / `colorfulSeatsByClass` toggle UX on top of
  these data-driven options.

## Colour resolution scheme (library)

Resolution depends first on seat **status**:

| Status        | Fill colour |
|---------------|-------------|
| `unavailable` | `notAvailableSeatsColor` (grey). Score/class/API are NOT applied. |
| `selected`    | `seatSelectedColor` / seat `originalColor` (passenger seat) |
| `preferred`   | `seatPreferredColor` |
| `extra`       | `seatExtraColor` |
| `available`   | the chain below |

For an **available** seat, fill colour is the first match, top to bottom:

| # | Source | When |
|---|--------|------|
| 1 | `colorTheme.seatAvailableColor` / `forceThemeSeatColors` | set → ALL available seats this one colour (the "flat" lever) |
| 2 | availability colour (individual `color` > wildcard `color`) | `availability` Input passed and the matching entry carries a `color` |
| 3 | score palette `customSeatColorRanges` | seat `score` ∈ [1,10] matches a range |
| 4 | class palette `customSeatColorClasses` (NEW) | a colour is defined for the seat's cabin class |
| 5 | API `seat.color` | the backend's original per-seat colour (itself score-derived on the sandbox flights) |
| 6 | theme default `seatAvailableColor` | nothing above matched |

Precedence summary: **seatAvailableColor(force) > availability colour > score > class > API colour > default.**
(Decision: when both `customSeatColorRanges` and `customSeatColorClasses` are defined, **score wins**;
class only colours seats whose score produced no match — full React-style ordering.)

### Where each step is computed

- Steps 3–5 are computed in the **preparer** as the seat's `color` / `originalColor`:
  `color = scorePalette(score, ranges) ?? classPalette(classCode, classes) ?? apiColor ?? undefined`.
- Step 2 (availability) is applied in `setAvailabilityHandler`, which already does
  `color = source.color ?? seat.originalColor ?? seat.color` — so an availability colour overrides
  the prepared score/class/API colour, and a colourless availability entry preserves it.
- Step 1 (force override) stays in the seat component `_resolveStyle`
  (`force || availOverride ? seatAvailableColor : data.color`).

## Availability interaction (must not break)

`availability` operates on an orthogonal axis — it sets **status** and optionally **colour**:

- Seats present in the availability map / matching the `*` wildcard → `available`; otherwise →
  `unavailable` (and unavailable seats never reach the available chain, so score/class never apply
  to them).
- If the availability entry has a `color` → it overrides score/class/API (step 2). If it has none
  (e.g. a `{ label: '*', price }` wildcard) → the prepared `originalColor` (score/class/API)
  survives.

Result: availability and score/class coexist. Explicit availability colours win; otherwise
available seats keep their score/class colour; unavailable seats are grey. No conflict.

## Demo behaviour (4 toggle combinations)

The demo theme always defines a flat default colour `D`.

| Toggle state        | Demo passes to library | Result (per scheme) |
|---------------------|------------------------|---------------------|
| Both OFF            | `seatAvailableColor = D` (no ranges/classes) | step 1 → all available seats flat `D` |
| Score ON, Class OFF | `customSeatColorRanges` (palette), no seatAvailableColor | step 3 → score colours |
| Score OFF, Class ON | `customSeatColorClasses`, no seatAvailableColor | step 4 → class colours (override API) |
| Both ON             | `customSeatColorRanges` + `customSeatColorClasses` | step 3 wins; class fills score-less seats |

Key rule: the demo sets `seatAvailableColor` **only** in the both-OFF state. `seatAvailableColor`
(a separate top-priority axis) is preferred over a single `[1,10]` range, because a single range
sits in the score slot (would mask the class palette and miss score-less seats).

## Library changes

- **Types (`types.ts`)**: remove `IConfig.colorfulSeatsByScore`, `IConfig.colorfulSeatsByClass`,
  and `IColorTheme.seatClassTints`. Add `IColorTheme.customSeatColorClasses?: Partial<Record<TCabinClass, string>>`.
- **Preparer (`jets-seat-map-preparer.service.ts`)**: drop the `enabled` gate param from
  `_calculateSeatColorByScore` (always apply when ranges defined). Add a `_calculateSeatColorByClass`
  step so the prepared `color`/`originalColor` is `score ?? class ?? apiColor`. Both old-format and
  legacy-format seat paths.
- **Seat component (`jets-seat.component.ts`)**: remove the `colorfulSeatsByClass` `@Input` and the
  `tintSeatColorForClass` call from `_resolveStyle`. Keep the `seatAvailableColor` / `forceThemeSeatColors`
  force override.
- **Threading**: remove the `colorfulSeatsByClass` `@Input` plumbing through `jets-row`, `jets-deck`,
  `jets-deck`→seat, and the binding in `jets-seat-map.component.html` + the `resolvedConfig` getter.
- **Remove `utils/color-tint.ts`** (after confirming no other consumer of `tintSeatColorForClass` /
  `adjustLightness`).
- **Config merge**: add validation/constraints for `customSeatColorClasses` mirroring
  `_applyColorRangesConstraints` (drop entries with invalid colour strings).

## Demo changes (in-repo `projects/seatmap-demo`)

- `flights.data.ts`: remove `colorfulSeatsByScore` / `colorfulSeatsByClass` from `BASE_CONFIG` and
  per-flight configs. Keep `customSeatColorRanges` on qt888.
- Rewrite the e2e colour-mode tests (`horizontal/horizontalParity.spec.ts` helpers and the
  `seat-color-modes` screenshot harness) to drive the 4 combinations via the new config
  (`customSeatColorRanges` / `customSeatColorClasses` / `seatAvailableColor`) and assert the
  priority order, including an availability-interaction case.

## Out of scope (this pass)

- The separate **promo demo repo** (`jets-seatmap-angular-lib-demo`) consumes the published npm
  package and cannot compile against the new API until a new version is published. It will be rewired
  (toggles → new options) in a follow-up after publish. Its current `colorfulSeatsBy*` usage keeps
  working against the old published version until then.

## Workflow / branches

- Library + in-repo demo work: branch `dev` of `jets-seatmap-angular-lib` (this repo).
- The separate promo demo repo (`jets-seatmap-angular-lib-demo`) follow-up MUST be done on a `dev`
  branch created off `main` — never commit directly to its `main`, so `main` cannot break.

## Backward compatibility

Breaking change for any consumer setting `colorfulSeatsByScore` / `colorfulSeatsByClass` or
`seatClassTints`. The README documents none of them, so external blast radius is low. After the
change, score colouring matches React (driven by `customSeatColorRanges`); per-class colouring is
available via the new `customSeatColorClasses` palette.

## Testing (TDD)

- **Unit (vitest)**: preparer colour resolution — score-only, class-only, score+class precedence,
  fallback to API colour, fallback to default; `_calculateSeatColorByScore` with ranges absent/present
  (no gate); `customSeatColorClasses` validation. Seat component `_resolveStyle` — `seatAvailableColor`
  force override beats prepared colour; no class tint remains.
- **e2e (Playwright, against the in-repo demo)**: the 4 demo combinations produce the expected
  rendered seat-body colours; availability colour overrides score/class; unavailable seats stay grey.

## README

Document `customSeatColorRanges` (already partly documented) and the new `customSeatColorClasses`,
and the priority order, so the colour behaviour is no longer a surprise. Note that `colorfulSeatsBy*`
are removed.
