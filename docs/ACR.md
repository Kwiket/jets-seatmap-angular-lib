# Accessibility Conformance Report — `@kwiket/jets-seatmap-angular-lib`

**Standard:** WCAG 2.2, Level A and AA (Level AAA out of scope).
**Date:** 2026-06-05.
**Scope:** the `JetsSeatMapComponent` widget shipped from
`@kwiket/jets-seatmap-angular-lib` (selector `sm-jets-seat-map`), its
sub-components (`JetsDeck`, `JetsRow`, `JetsSeat`, `JetsTooltip`,
`JetsTooltipView`, `JetsDeckSelector`, `JetsSeatListComponent`, the
decorative chrome — `JetsPlaneBody`, `JetsWing`, `JetsNose`, `JetsTail`,
`JetsDeckSeparator`, `JetsBulk`, `JetsDeckExit`, `JetsNotInit`,
`JetsNoData`), and the `LiveAnnouncer` integration.

**Out of scope:** the host page that embeds the widget. Criteria that
can only be met at the document or session level (page title, language
of page/parts, authentication, redundant entry, page-level audio
controls, the page-level ACR itself) are flagged below as
*Host responsibility*.

**Conformance values used in the tables**

- **Supports** — the widget fully meets the success criterion.
- **Partially supports** — the widget meets most of the criterion;
  see the *How met* column for the residual gap.
- **Does not support** — the criterion is in scope and is not met.
- **Not applicable** — the criterion applies to content the widget
  does not produce (e.g. audio, video, forms).
- **Host responsibility** — the criterion can only be met by the host
  page; the widget exposes the inputs / outputs needed for the host to
  satisfy it.

**Where references** point at the file path in the published library
(or the demo) plus the SHA of the commit that introduced the
behaviour. Commit SHAs are taken from the `WCAG` branch of
`Kwiket/jets-seatmap-angular-lib`.

---

## Principle 1 — Perceivable

### Guideline 1.1 — Text Alternatives

| SC | Title | Level | Conformance | How met | Where |
|---|---|---|---|---|---|
| 1.1.1 | Non-text Content | A | Supports | Decorative SVG (fuselage, wings, nose, tail, deck separators, bulks, deck exits, deck-selector glyphs, tooltip amenity / dimension icons, seat-inner SVG, passenger badge, price pill, unavailable cross) carry `aria-hidden="true"`. Functional seats expose an `aria-label` from `utils/a11y.ts#buildSeatAriaLabel` (e.g. `"14C, aisle, extra legroom, available, €12"`). The single source of truth for each cell is the button's accessible name. | `projects/seatmap-lib/src/lib/utils/a11y.ts` (commit 3, `7a70627`); decorative `aria-hidden` (commit 2, `21c0eba`). |

### Guideline 1.2 — Time-based Media

| SC | Title | Level | Conformance | How met | Where |
|---|---|---|---|---|---|
| 1.2.1 | Audio-only and Video-only (Prerecorded) | A | Not applicable | The widget renders no audio or video. | — |
| 1.2.2 | Captions (Prerecorded) | A | Not applicable | No prerecorded media. | — |
| 1.2.3 | Audio Description or Media Alternative (Prerecorded) | A | Not applicable | No prerecorded media. | — |
| 1.2.4 | Captions (Live) | AA | Not applicable | No live media. | — |
| 1.2.5 | Audio Description (Prerecorded) | AA | Not applicable | No prerecorded media. | — |

### Guideline 1.3 — Adaptable

| SC | Title | Level | Conformance | How met | Where |
|---|---|---|---|---|---|
| 1.3.1 | Info and Relationships | A | Supports | Full APG Layout-Grid pattern: per-deck `role="grid"` with `aria-rowcount` / `aria-colcount`; each row is `role="row"` with `aria-rowindex`; every position (seats, aisles, empties, unavailables) is `role="gridcell"` with `aria-rowindex` / `aria-colindex`. Alternative list view uses a semantic `<table>` with `<caption>`, `scope="col"` headers, `<thead>` / `<tbody>`. Tooltip uses `role="dialog"` with `aria-labelledby` and `aria-describedby`. | grid scaffolding `projects/seatmap-lib/src/lib/components/jets-deck/`, `jets-row/`, `jets-seat/` (commit 6, `49c34f6`); list view `projects/seatmap-lib/src/lib/components/jets-seat-list/` (commit 13, `b81fead`); tooltip `projects/seatmap-lib/src/lib/components/jets-tooltip/` (commit 11, `8ce3f3f`). |
| 1.3.2 | Meaningful Sequence | A | Supports | DOM order matches visual reading order: deck-selector → grid (row 1 col 1 … row N col M) → tooltip-when-open → skip-link target. The alternative list view follows row-then-seat order. | `projects/seatmap-lib/src/lib/components/jets-seat-map/jets-seat-map.component.html` (commits 6, `49c34f6` and 12, `f216a55`). |
| 1.3.3 | Sensory Characteristics | A | Supports | Instructions in tooltip text and locale strings reference seats by label (`"14C"`), position (`window`, `aisle`, `middle`) and price — never by colour or spatial cue alone. | `projects/seatmap-lib/src/lib/utils/a11y.ts#buildSeatAriaLabel` and `LOCALES_MAP` (commit 3, `7a70627`). |
| 1.3.4 | Orientation | AA | Supports | The widget does not lock orientation; both portrait and landscape render, and `alternativeView: 'auto'` switches to the list view below 480 CSS px. | `projects/seatmap-lib/src/lib/components/jets-seat-map/jets-seat-map.component.ts` (commit 13, `b81fead`). |
| 1.3.5 | Identify Input Purpose | AA | Not applicable | The widget contains no user-input fields whose purpose maps to the WCAG input-purpose taxonomy. (The tooltip's Select / Unselect / Cancel buttons are actions, not data entry.) | — |

### Guideline 1.4 — Distinguishable

| SC | Title | Level | Conformance | How met | Where |
|---|---|---|---|---|---|
| 1.4.1 | Use of Color | A | Supports | State is never carried by colour alone: unavailable seats render a visible cross (`seatUnavailableCrossColor`); selected seats render a passenger badge / checkmark; restricted seats carry a `seatRestrictionMessage` visible in the tooltip. The legend uses `icon: 'cross' | 'checkmark'` alongside the colour swatch. | `projects/seatmap-lib/src/lib/services/seat-template.service.ts`; legend in `JetsSeatMapComponent`; restriction wiring (commit 10, `eb4d17f`). |
| 1.4.2 | Audio Control | A | Not applicable | The widget produces no audio. | — |
| 1.4.3 | Contrast (Minimum) | AA | Supports | `DEFAULT_COLOR_THEME` in `constants.ts` was regenerated so that `seatLabelColor` over every seat-fill token meets ≥4.5:1, and the disabled / unavailable state uses a discrete token rather than `opacity: 0.6`. Contrasts are documented inline in the constants file. Consumers passing their own `colorTheme` are responsible for their own contrast budget. | `projects/seatmap-lib/src/lib/constants.ts` (commit 4, `d49e100`). |
| 1.4.4 | Resize Text | AA | Supports | All seat-grid typography is in `em` / `rem`; the component does not pin font-size in `px`. Zoom to 200% is verified on the demo without text clipping. | `projects/seatmap-lib/src/lib/components/jets-seat/jets-seat.component.scss` and tooltip SCSS. |
| 1.4.5 | Images of Text | AA | Supports | No images of text. Seat labels, prices and tooltip headings are live text; SVG geometry is decorative only. | — |
| 1.4.10 | Reflow | AA | Supports | The seat grid is a 2D spatial diagram and falls under the canonical "2D layout required for meaning" exception. To satisfy users who cannot use the 2D representation, `config.alternativeView` provides a single-column semantic list-table view that reflows to 320 CSS px without horizontal scrolling. | `projects/seatmap-lib/src/lib/components/jets-seat-list/` (commit 13, `b81fead`). |
| 1.4.11 | Non-text Contrast | AA | Supports | Focus ring is `2px solid` with `outline-offset: 2px`, drawn against a high-contrast token guaranteed ≥3:1 against every seat-fill in the default theme. Seat borders between available / unavailable / selected states are ≥3:1. | `projects/seatmap-lib/src/lib/components/jets-seat/jets-seat.component.scss` (commits 4, `d49e100` and 5, `df885db`). |
| 1.4.12 | Text Spacing | AA | Supports | No CSS pins `line-height`, `letter-spacing` or `word-spacing` to non-overridable values on grid text. User-stylesheet overrides applied at the standard ratios do not clip seat labels. | `projects/seatmap-lib/src/lib/components/jets-seat/jets-seat.component.scss`. |
| 1.4.13 | Content on Hover or Focus | AA | Supports | The hover-tooltip is **dismissable** (Esc closes from inside the tooltip or the trigger seat), **hoverable** (an 80 ms close delay plus a `relatedTarget` check keeps the tooltip open while the pointer is over it), and **persistent** (it stays until the user dismisses, focus moves elsewhere, or the underlying data invalidates). Keyboard focus on a seat opens the tooltip with the same UX as mouse hover. | `projects/seatmap-lib/src/lib/components/jets-seat-map/jets-seat-map.component.ts` and `jets-tooltip/jets-tooltip.component.ts` (commit 8, `8ea5e36`). |

---

## Principle 2 — Operable

### Guideline 2.1 — Keyboard Accessible

| SC | Title | Level | Conformance | How met | Where |
|---|---|---|---|---|---|
| 2.1.1 | Keyboard | A | Supports | Every interactive surface is reachable and operable from the keyboard: Arrow keys (1D), Home/End (row), Ctrl+Home / Ctrl+End (whole map), PageUp/PageDown (±5 rows), Ctrl+Arrow (skim — next interactable seat), Enter / Space (activate), Esc (close tooltip). The deck-selector exposes Arrow / Home / End for tablist mode. The tooltip's Select / Unselect / Cancel buttons are native `<button>` elements; Tab cycles them. | `projects/seatmap-lib/src/lib/services/seat-grid-navigation.service.ts` + wiring in `jets-seat-map.component.ts` (commits 7, `c055e2a` / `61b3b78`). |
| 2.1.2 | No Keyboard Trap | A | Supports | The tooltip is non-modal (no `cdkTrapFocus`, no `aria-modal`); Tab leaves the tooltip and continues into the next document focusable. Esc returns focus to the trigger seat. | `projects/seatmap-lib/src/lib/components/jets-tooltip/jets-tooltip.component.ts` (commit 11, `8ce3f3f`). |
| 2.1.4 | Character Key Shortcuts | A | Supports | The widget binds no single-character shortcut. All keyboard bindings either require a modifier (Ctrl+Arrow, Ctrl+Home/End) or are intrinsic widget keys (Arrow, Home, End, PageUp/Down, Enter, Space, Esc) consistent with the APG Layout-Grid pattern. | `projects/seatmap-lib/src/lib/services/seat-grid-navigation.service.ts` (commit 7, `61b3b78`). |

### Guideline 2.2 — Enough Time

| SC | Title | Level | Conformance | How met | Where |
|---|---|---|---|---|---|
| 2.2.1 | Timing Adjustable | A | Not applicable | The widget enforces no time limits. | — |
| 2.2.2 | Pause, Stop, Hide | A | Not applicable | The widget has no auto-updating, auto-scrolling or auto-moving content. The `_jumpToSeat` smooth scroll is user-triggered. | — |

### Guideline 2.3 — Seizures and Physical Reactions

| SC | Title | Level | Conformance | How met | Where |
|---|---|---|---|---|---|
| 2.3.1 | Three Flashes or Below Threshold | A | Supports | The widget contains no flashing content; hover / focus transitions are ≤200 ms and are suppressed under `prefers-reduced-motion: reduce`. | hover / motion media queries (commit 14, `8fbc5a3`). |

### Guideline 2.4 — Navigable

| SC | Title | Level | Conformance | How met | Where |
|---|---|---|---|---|---|
| 2.4.1 | Bypass Blocks | A | Supports | The widget wraps itself in `<section role="region" aria-labelledby="…">` with a visually-hidden `<h2>` and a skip-link that jumps past the grid to the next focusable element after the widget. | `projects/seatmap-lib/src/lib/components/jets-seat-map/jets-seat-map.component.html` (commit 12, `f216a55`). |
| 2.4.2 | Page Titled | A | Host responsibility | The widget cannot set `<title>`. The host page is responsible. | host page. |
| 2.4.3 | Focus Order | A | Supports | One Tab stop into the grid (roving tabindex); within the grid, arrow keys move focus in spatial reading order; tooltip is inserted after its trigger in DOM and follows it in focus order. After tooltip-close, focus returns to the trigger seat. | `projects/seatmap-lib/src/lib/services/seat-grid-navigation.service.ts` (commit 7); tooltip focus restoration (commit 11, `8ce3f3f`). |
| 2.4.4 | Link Purpose (In Context) | A | Not applicable | The widget renders no links; all interactive elements are `<button>`. | — |
| 2.4.5 | Multiple Ways | AA | Not applicable | The widget is a single component within a single page; multiple-ways applies to the site. | host page. |
| 2.4.6 | Headings and Labels | AA | Supports | The widget heading (`<h2>` cdk-visually-hidden) is descriptive (`"Seat map"` localised). Every interactive control has a label (seat `aria-label`, tooltip header text, button labels). | `projects/seatmap-lib/src/lib/components/jets-seat-map/jets-seat-map.component.html` (commit 12, `f216a55`). |
| 2.4.7 | Focus Visible | AA | Supports | `:focus-visible { outline: 2px solid …; outline-offset: 2px; }` applies to every interactive surface (seat button, tooltip buttons, deck-selector, list-view buttons / filters). The forced-colors rule keeps the ring visible in High Contrast mode. | `jets-seat.component.scss`, `jets-tooltip.component.scss`, `jets-deck-selector.component.scss`, `jets-seat-list.component.scss` (commits 5, `df885db`, 11, `8ce3f3f`, 12, `f216a55`, 13, `b81fead`, 15, `22494ce`). |
| 2.4.11 | Focus Not Obscured (Minimum) | AA *(new in 2.2)* | Partially supports | The widget guarantees the focused cell is scrolled into view (`scrollIntoView` on every focus transition driven by `SeatGridNavigationService`). The tooltip positioning logic prefers `openBelow` / `openAbove` so the trigger seat is never covered. The widget cannot, however, see host-level sticky headers / footers — if the host page pins overlays around the widget, the host must add `scroll-margin-top` / `scroll-margin-bottom` to keep the focused seat clear. Documented in the README's *Known host responsibilities*. | `_focusCell` / `scrollIntoView` in `jets-seat-map.component.ts` (commit 7, `c055e2a`); tooltip positioning in `jets-tooltip.component.ts` (commit 11, `8ce3f3f`). |
| 2.4.12 | Focus Not Obscured (Enhanced) | AAA | Not applicable | AAA, out of scope. The widget's behaviour exceeds the AA minimum but a formal AAA claim is not made. | — |
| 2.4.13 | Focus Appearance | AAA | Not applicable | AAA, out of scope. The widget's focus indicator is ≥2 px solid at ≥3:1, which meets the spirit of the criterion, but a formal AAA claim is not made. | — |

### Guideline 2.5 — Input Modalities

| SC | Title | Level | Conformance | How met | Where |
|---|---|---|---|---|---|
| 2.5.1 | Pointer Gestures | A | Supports | All interactions are single-pointer single-tap (click / tap on a seat, click on a tooltip button). No multi-point, path-based or pinch gestures are required. | — |
| 2.5.2 | Pointer Cancellation | A | Supports | All `<button>` activations use the default click semantics: `down` does not commit, `up`-outside aborts the activation. | native button semantics in `jets-seat.component.ts` (commit 5, `df885db`). |
| 2.5.3 | Label in Name | A | Supports | Each interactive button's accessible name (`aria-label`) begins with or contains the visible text (the seat label `"14C"`, the tooltip button text `"Select" / "Unselect" / "Cancel"`). | `projects/seatmap-lib/src/lib/utils/a11y.ts#buildSeatAriaLabel` (commit 3, `7a70627`); tooltip locale strings. |
| 2.5.4 | Motion Actuation | A | Not applicable | The widget does not respond to device motion (shake, tilt). | — |
| 2.5.7 | Dragging Movements | AA *(new in 2.2)* | Not applicable | The widget exposes no drag-based interaction. All seat selection and deck switching is single-tap / single-click / keyboard-only. | — |
| 2.5.8 | Target Size (Minimum) | AA *(new in 2.2)* | Partially supports | The grid view targets a ≥24×24 CSS px footprint for every seat button in the default theme, satisfying the AA minimum. For very dense cabin layouts on narrow viewports, the auto-switch to `alternativeView: 'list'` (≤480 px) provides a ≥44×44 row hit target. Hosts that force `alternativeView: 'grid'` on narrow viewports remain responsible for verifying target size in their own theme. | `projects/seatmap-lib/src/lib/components/jets-seat/jets-seat.component.scss`; list view (commit 13, `b81fead`). |

---

## Principle 3 — Understandable

### Guideline 3.1 — Readable

| SC | Title | Level | Conformance | How met | Where |
|---|---|---|---|---|---|
| 3.1.1 | Language of Page | A | Host responsibility | `<html lang>` is set by the host. The widget's locale strings are selected from `config.lang` and `LOCALES_MAP`, so they match the host's chosen language. | host page; `LOCALES_MAP` in `projects/seatmap-lib/src/lib/constants.ts`. |
| 3.1.2 | Language of Parts | AA | Host responsibility | If a region of the host page is in a different language from `<html lang>`, the host adds the per-region `lang` attribute. The widget itself renders content only in `config.lang`. | host page. |

### Guideline 3.2 — Predictable

| SC | Title | Level | Conformance | How met | Where |
|---|---|---|---|---|---|
| 3.2.1 | On Focus | A | Supports | Focusing a seat does not cause an unexpected change of context. With `config.tooltipOnHover` enabled it opens a non-modal tooltip — same UX as mouse hover — which is widely understood as a hint surface, not a context change. | `onSeatFocusIn` in `jets-seat-map.component.ts` (commit 8, `8ea5e36`). |
| 3.2.2 | On Input | A | Supports | Activating a seat (Enter / Space / click) emits a deterministic event documented in the README; no implicit navigation. | `onSeatClick` flow in `jets-seat-map.component.ts`. |
| 3.2.3 | Consistent Navigation | AA | Supports | The deck-selector, grid keyboard model and tooltip behaviour are consistent across every instance of the widget. | — |
| 3.2.4 | Consistent Identification | AA | Supports | Equivalent UI is identified consistently: every seat button has the same role / structure of aria-label, every Select button is named `Select` (per locale). | `utils/a11y.ts` (commit 3, `7a70627`). |
| 3.2.6 | Consistent Help | A *(new in 2.2)* | Host responsibility | The widget does not expose a help affordance. If the host page exposes one, the host must keep it consistent across pages. | host page. |

### Guideline 3.3 — Input Assistance

| SC | Title | Level | Conformance | How met | Where |
|---|---|---|---|---|---|
| 3.3.1 | Error Identification | A | Supports | When a seat cannot be selected (passenger-type restriction, exit-row rule, etc.), the tooltip renders a visible reason under the disabled Select button, the button carries `aria-describedby` pointing at the reason, and `LiveAnnouncer` announces it politely. The `selectAttemptBlocked` Output also lets the host react. | `getSelectDisabledReason` in `jets-tooltip.component.ts` (commit 10, `eb4d17f`). |
| 3.3.2 | Labels or Instructions | A | Supports | Every actionable control carries either a visible label (tooltip buttons, deck-selector tabs, list-view filters) or an `aria-label` (seat cells). | `utils/a11y.ts` (commit 3, `7a70627`); tooltip / deck-selector / list-view templates. |
| 3.3.3 | Error Suggestion | AA | Supports | Where a suggestion is meaningful (e.g. `"not available for infant passenger — try row 12 or later"`), the localised restriction message includes it. Where no constructive suggestion exists, the reason text identifies the constraint. | `LOCALES_MAP` restriction keys (commits 3, `7a70627` and 10, `eb4d17f`). |
| 3.3.4 | Error Prevention (Legal, Financial, Data) | AA | Not applicable | Seat selection is reversible (Unselect button + Esc to cancel the tooltip without committing). No legal or financial transaction is finalised inside the widget. | — |
| 3.3.7 | Redundant Entry | A *(new in 2.2)* | Host responsibility | The widget contains no multi-step form. Passenger / payment forms that surround the widget are the host's concern. | host page. |
| 3.3.8 | Accessible Authentication (Minimum) | AA *(new in 2.2)* | Host responsibility | The widget does not authenticate the user. The host's login flow is the host's concern. | host page. |
| 3.3.9 | Accessible Authentication (Enhanced) | AAA | Not applicable | AAA, out of scope. | — |

---

## Principle 4 — Robust

### Guideline 4.1 — Compatible

| SC | Title | Level | Conformance | How met | Where |
|---|---|---|---|---|---|
| 4.1.1 | Parsing | A | Not applicable | Obsoleted by WCAG 2.2 (parsing is enforced by modern HTML parsers); included for completeness. Angular templates compile to well-formed DOM. | — |
| 4.1.2 | Name, Role, Value | A | Supports | Every interactive element is a native `<button>` or carries an explicit ARIA role (`gridcell`, `dialog`, `region`, `switch`, `tab`, `tablist`). Name comes from `aria-label`, `aria-labelledby` or visible text. Value / state is `aria-selected`, `aria-disabled`, `aria-checked`, `aria-expanded` as appropriate. Unavailable seats use `aria-disabled="true"` rather than the native `disabled` attribute so they remain focusable. | seat (commit 5, `df885db`); grid (commit 6, `49c34f6`); tooltip (commit 11, `8ce3f3f`); deck-selector (commit 12, `f216a55`). |
| 4.1.3 | Status Messages | AA | Supports | `@angular/cdk/a11y` `LiveAnnouncer` (politeness `polite`) announces seat select, seat unselect, jump-to-seat, and restricted-select attempts. A visually-hidden polite live region is also rendered as a tree-shake fallback. All strings localised via `LOCALES_MAP`. The widget does not announce the running total — that remains the host's responsibility. | `LiveAnnouncer` integration in `jets-seat-map.component.ts` (commits 9, `d85a86a` and 10, `eb4d17f`). |

---

## Override Responsibility

When the host swaps any of the default components via
`config.componentOverrides`, the override inherits the ARIA contract
the default implementation provides. The library cannot enforce this at
compile time, so a custom component that ships without the contract
will silently regress the conformance claims above.

### `JetsSeat`

A custom `JetsSeat` MUST:

- Render an activatable element with `role="gridcell"`. The default is
  a `<button type="button">`; if a host substitutes a `<div>` it must
  add `role="button"` *in addition to* `role="gridcell"` and wire up
  `keydown.enter` / `keydown.space` handlers.
- Pass through `ariaLabel`, `ariaSelected`, `ariaDisabled`,
  `rovingTabindex`, `colIndex` from the parent row.
- Bind `tabindex` from `rovingTabindex` — exactly one cell per deck
  carries `0`, the rest `-1`. Do not hard-code `tabindex="0"`.
- Use `aria-disabled="true"` (not the native `disabled` attribute) for
  unavailable seats, so they remain focusable for screen readers.
- Preserve the CSS class `.jets-seat` and the `data-seat-number`
  attribute — the parent container queries these for focus
  restoration and for `seatJumpTo`.
- Ignore activation (`click`, `keydown.enter`, `keydown.space`) when
  `ariaDisabled` is true.

### `JetsTooltip`

A custom `JetsTooltip` MUST:

- Carry `role="dialog"` (without `aria-modal`) when rendered as a
  floating tooltip, or `role="region"` when rendered in the
  `sidePanel` variant.
- Provide an accessible name via `aria-labelledby` (preferred) or
  `aria-label`.
- Wire `aria-describedby` to the amenities block and, when present,
  to the seat-restriction reason. The default implementation derives
  these via `getSelectDisabledReason`; if the override re-implements
  the tooltip, it must surface the reason text.
- Auto-focus the primary action on open (Select if available, else
  Unselect if the seat is taken, else Cancel).
- Close on Esc and restore focus to the trigger seat. The trigger is
  exposed by `JetsSeatMapComponent` via the `lastTriggerElement`
  reference; if the override consumes the existing
  `tooltipRequested` flow it gets this for free.
- Provide a localised aria-label for the close button (key `close` in
  `LOCALES_MAP`).

### `JetsTooltipView`

A custom `JetsTooltipView` may render any markup, but MUST:

- Preserve every element that the container references via
  `aria-labelledby` / `aria-describedby` (the header element and the
  amenities / restriction-reason blocks). If you change their IDs,
  re-wire the container's aria attributes accordingly.
- Keep the visible seat-restriction reason rendered when the parent
  passes one — removing it regresses 3.3.1 and 3.3.3.
- Not introduce focusable elements without an accessible name.

### `JetsNotInit`

A custom `JetsNotInit` (the loading state) SHOULD:

- Carry `role="status"` or be rendered inside a live region so screen
  readers announce the loading state.
- Provide a visible localised loading message rather than relying on
  decorative imagery alone.

---

## Known Limitations

- **Forced-colors inline SVG fills.** Inline SVG inside the seat
  template (rendered via `bypassSecurityTrustHtml`) keeps its original
  hard-coded `fill` / `stroke` in some browsers when Windows High
  Contrast is on. The seat *border*, *focus ring*, *cross icon* and
  *passenger badge* are normalised via `@media (forced-colors: active)`
  (commit 15, `22494ce`), so the cell remains discoverable and the
  state cues survive, but the inner SVG glyph may render in its
  authored colours. Tracked as a non-blocking polish item; does not
  affect any AA criterion because the accessible-name on the seat
  button carries all state.
- **Pre-existing e2e flakes** unrelated to a11y: `colorTheme ·
  field-seatArmrestColor`, `colorTheme · field-seatStrokeWidth`,
  `customCabinTitles · default`, `customCabinTitles · short`. These
  pass in single-worker Playwright runs and fail intermittently on
  parallel workers. Recorded here for transparency; they will be
  diagnosed separately from the WCAG branch.
- **Host sticky overlays.** 2.4.11 is satisfied inside the widget, but
  host pages that pin overlays around the widget must add
  `scroll-margin-top` / `scroll-margin-bottom` to keep the focused
  seat clear of the overlay (see *Principle 2 → 2.4.11*).
- **Custom `colorTheme`.** The default theme is AA-compliant; consumers
  passing a custom `colorTheme` are responsible for their own contrast
  audit. The library does not validate consumer themes.

---

## References

- WCAG 2.2 specification — [https://www.w3.org/TR/WCAG22/](https://www.w3.org/TR/WCAG22/).
- ARIA Authoring Practices Guide, Layout Grid pattern —
  [https://www.w3.org/WAI/ARIA/apg/patterns/grid/](https://www.w3.org/WAI/ARIA/apg/patterns/grid/).
- ITI / Section 508 VPAT 2.5 Rev WCAG template — column structure
  borrowed for the matrix above.
- Implementation roadmap and per-commit decisions —
  [`docs/wcag/PLAN.md`](./wcag/PLAN.md).
