# Changelog

All notable changes to `@kwiket/jets-seatmap-angular-lib` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/) and the
project loosely adheres to [Semantic Versioning](https://semver.org/).

## [0.0.3] — 2026-06-30 — WCAG 2.2 AA refit

Brings the library to WCAG 2.2 Level AA conformance for the seat-grid widget,
ships a full [Accessibility Conformance Report](docs/ACR.md), and adds an
*Accessibility* section to the library [README](projects/seatmap-lib/README.md).
17 commits, three of which are breaking.

### Breaking changes

- **Peer dependency.** `@angular/cdk@^21.2.0` is now a required peer
  dependency. The library uses `LiveAnnouncer` from `@angular/cdk/a11y` to
  satisfy WCAG 4.1.3 *Status Messages*. Hosts already on Angular 21 typically
  have `@angular/cdk` installed transitively; if not, run
  `npm install @angular/cdk@^21.2.0`. *(commit 1, `7d0b368`)*
- **Default visual theme.** `DEFAULT_COLOR_THEME` was regenerated to satisfy
  AA contrast — `seatLabelColor` over every seat-fill token now meets ≥4.5:1,
  and UI / non-text contrast meets ≥3:1. Disabled / unavailable state uses a
  discrete colour token instead of `opacity: 0.6`. **Consumers that pass their
  own `colorTheme` are unaffected.** Consumers relying on the defaults will see
  lighter Material-200 / Material-400-based fills with darker labels. 99
  Playwright snapshot baselines under `projects/seatmap-demo/e2e/colorTheme/`
  were regenerated. *(commit 4, `d49e100`)*
- **DOM tag of the seat root.** Interactive seat cells now render as
  `<button class="jets-seat">` instead of `<div class="jets-seat">`. The
  `.jets-seat` CSS class and the `data-seat-number` attribute are preserved,
  so selectors of the form `.jets-seat` and `[data-seat-number="…"]` continue
  to work. **Consumers using `div.jets-seat` CSS selectors must switch** to
  `button.jets-seat` or to the bare `.jets-seat` class. Non-interactive
  positions (aisles, empties) remain `<div role="gridcell">`. *(commit 5,
  `df885db`)*

### Added

- `chore(a11y)`: add `@angular/cdk@^21.2.0` peer dep. *(commit 1, `7d0b368`)*
- `feat(a11y)`: hide decorative graphics from assistive tech via `aria-hidden`
  on all chrome SVG, tooltip amenity / dimension icons and seat decorative
  layers. *(commit 2, `21c0eba`)*
- `feat(a11y)`: accessible-name builder `utils/a11y.ts#buildSeatAriaLabel`
  plus 22 new locale keys across 18 languages
  (EN / RU / CN / DE / FR / ES / IT / PT / PT-BR / AR / JA / KO / TR / NL /
  PL / CS / UK / VI). *(commit 3, `7a70627`)*
- `feat(a11y)`: grid scaffolding — per-deck `role="grid"` with `aria-rowcount`
  / `aria-colcount`, `role="row"` with `aria-rowindex`, `role="gridcell"`
  with `aria-rowindex` / `aria-colindex` on every position (seats, aisles,
  empties, unavailables). *(commit 6, `49c34f6`)*
- `feat(a11y)`: `SeatGridNavigationService` — pure roving-tabindex + 2D
  keyboard-navigation logic with 66 specs. *(commit 7, `61b3b78`)*
- `feat(a11y)`: wire roving tabindex and 2D keyboard navigation into
  `JetsSeatMapComponent` — Arrow keys, Home/End, Ctrl+Home/End, PageUp/Down,
  Ctrl+Arrow (skim), Enter / Space, Esc, `focusedCell` state, and
  `_applyRovingTabindex` / `_focusCell` machinery. *(commit 7, `c055e2a`)*
- `feat(a11y)`: `LiveAnnouncer` integration for select / unselect /
  jump-to-seat events. *(commit 9, `d85a86a`)*
- `feat(a11y)`: expose seat-restriction reasoning in the tooltip — visible
  reason text under the disabled Select button, `aria-describedby` wiring,
  new `selectAttemptBlocked` `@Output()`, `getSelectDisabledReason()` helper
  while keeping the `isSelectDisabled()` boolean facade. Closes WCAG 3.3.1
  and 3.3.3. *(commit 10, `eb4d17f`)*
- `feat(a11y)`: tooltip becomes a non-modal `role="dialog"` with
  `aria-labelledby` / `aria-describedby`, auto-focus on primary action,
  Esc-to-close, and `lastTriggerElement` focus restoration. The `sidePanel`
  variant uses `role="region"`. Close button gets a localised aria-label.
  *(commit 11, `8ce3f3f`)*
- `feat(a11y)`: landmarks + skip link + deck-selector semantics — wrap the
  widget in `<section role="region">` with a visually-hidden `<h2>` and a
  skip-link; deck-selector becomes `role="switch"` (N=2) or
  `role="tablist"` with arrow navigation (N≥3). *(commit 12, `f216a55`)*
- `feat(a11y)`: alternative list view —
  new `JetsSeatListComponent` (semantic `<table>` with filters and sort) wired
  through `JetsSeatMapComponent` via `config.alternativeView: 'grid' | 'list'
  | 'auto'` (default `'grid'`). The `'auto'` mode reacts to
  `matchMedia('(max-width: 480px)')`. Closes WCAG 2.5.8 Target Size on narrow
  viewports. *(commit 13, `b81fead`)*
- `feat(a11y)`: respect `prefers-reduced-motion` on `_jumpToSeat` smooth
  scroll, seat hover transitions and deck-selector rotation. *(commit 14,
  `8fbc5a3`)*
- `feat(a11y)`: forced-colors / Windows High Contrast support — explicit
  `@media (forced-colors: active)` rules for seat / exit / deck-selector /
  deck-separator focus rings, borders and unavailable cross. *(commit 15,
  `22494ce`)*

### Changed

- `feat(a11y)`: `DEFAULT_COLOR_THEME` tokens regenerated to meet WCAG AA
  contrast (≥4.5:1 text, ≥3:1 UI). Documented inline in
  `projects/seatmap-lib/src/lib/constants.ts`. **Visual breaking change** —
  see the *Breaking changes* section above. *(commit 4, `d49e100`)*
- `feat(a11y)`: seat root tag changed from `<div class="jets-seat">` to
  `<button class="jets-seat">` for interactive cells. New `@Input`s on
  `JetsSeatComponent`: `ariaLabel`, `ariaSelected`, `ariaDisabled`,
  `rovingTabindex`, `colIndex`. **DOM breaking change** — see the
  *Breaking changes* section above. *(commit 5, `df885db`)*

### Fixed

- `fix(a11y)`: 1.4.13 *Content on Hover or Focus* — `tooltipOnHover` now
  opens on keyboard `focusin`, closes with an 80 ms delay (so the tooltip is
  hoverable), keeps itself open while the pointer or focus is inside it, and
  closes on Esc. *(commit 8, `8ea5e36`)*

### Docs

- `docs(a11y)`: README *Accessibility* section + `docs/ACR.md` (full WCAG 2.2
  A+AA conformance matrix grouped by principle) + this CHANGELOG. Documents
  *Override Responsibility* for `JetsSeat` / `JetsTooltip` / `JetsTooltipView`
  consumers. *(commit 17)*

### Known limitations

- Forced-colors inline SVG fills may render in their authored colours in some
  browsers (see `docs/ACR.md` → *Known Limitations*).
- Pre-existing e2e flakes (`colorTheme · field-seatArmrestColor`,
  `colorTheme · field-seatStrokeWidth`, `customCabinTitles · default`,
  `customCabinTitles · short`) are unrelated to the WCAG refit; they pass in
  single-worker Playwright runs and fail intermittently under parallel
  workers. To be diagnosed separately.

---

> Earlier history is tracked in git only; this is the first formal CHANGELOG
> entry, introduced together with the WCAG 2.2 AA refit.
