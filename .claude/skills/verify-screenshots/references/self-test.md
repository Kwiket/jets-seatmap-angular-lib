# Self-test: regress against the tooltip `[colorTheme]` bug

This procedure validates that the `verify-screenshots` skill flags real binding drops, not just typos in expected values. It uses a known historical bug as a fixture: for months, `<sm-jets-tooltip>` in `projects/seatmap-lib/src/lib/components/jets-seat-map/jets-seat-map.component.html` was missing its `[colorTheme]` input binding. Playwright stayed green; all tooltip-color tests silently produced unchanged screenshots.

The skill must (a) flag every affected case as `not-visible` under the broken code, and (b) flip those cases to `visible-correct` once the binding is restored. Anything else means the prompts have regressed.

## Pre-bug fixture (broken state)

The breaking line is in `projects/seatmap-lib/src/lib/components/jets-seat-map/jets-seat-map.component.html`. The inline tooltip element should look like:

```html
<sm-jets-tooltip
  [data]="activeTooltip"
  ...
  [colorTheme]="resolvedConfig.colorTheme"   <!-- this line is the regression target -->
  ...
/>
```

To reproduce the bug, delete that `[colorTheme]` attribute (only the inline element's; do not touch the `*ngComponentOutlet` branch above it).

## Procedure

### Step 1 — Reproduce the broken state

Work on a throwaway branch so you can drop the change cleanly:

```sh
git switch -c verify-screenshots-self-test
# edit jets-seat-map.component.html, delete `[colorTheme]="resolvedConfig.colorTheme"` from <sm-jets-tooltip>
```

### Step 2 — Refresh screenshots

```sh
npx playwright test --config=projects/seatmap-demo/e2e/playwright.config.ts --grep colorTheme
```

All 50 colorTheme tests must still pass. (That is the whole point — Playwright cannot catch this bug.)

### Step 3 — Invoke the skill

In a Claude Code session inside this worktree:

```
/verify-screenshots projects/seatmap-demo/e2e/colorTheme/colorTheme.spec.ts
```

### Step 4 — Pass criteria (broken state)

Open `projects/seatmap-demo/e2e/colorTheme/screenshots/_verification-report.md`. Confirm:

- Totals line shows at least **11 NOT-VISIBLE** entries.
- The Failures section contains, at minimum, these tests with verdict `NOT-VISIBLE`:
  - `field-tooltipBackgroundColor`
  - `field-tooltipBorderColor`
  - `field-tooltipFontColor`
  - `field-tooltipHeaderColor`
  - `field-tooltipIconColor`
  - `field-tooltipIconBorderColor`
  - `field-tooltipIconBackgroundColor`
  - `field-tooltipSelectButtonTextColor`
  - `field-tooltipSelectButtonBackgroundColor`
  - `field-tooltipCancelButtonTextColor`
  - `field-tooltipCancelButtonBackgroundColor`
- At least one of those hypotheses mentions `[colorTheme]` on `<sm-jets-tooltip>` or `resolvedConfig.colorTheme` not reaching the tooltip.
- Non-tooltip cases (`field-seatLabelColor`, `field-fuselageStrokeColor`, etc.) remain `OK`.

### Step 5 — Restore the fix

```sh
git restore projects/seatmap-lib/src/lib/components/jets-seat-map/jets-seat-map.component.html
```

### Step 6 — Refresh screenshots and rerun the skill

```sh
npx playwright test --config=projects/seatmap-demo/e2e/playwright.config.ts --grep colorTheme
```

Re-invoke `/verify-screenshots projects/seatmap-demo/e2e/colorTheme/colorTheme.spec.ts` in Claude Code.

### Step 7 — Pass criteria (fixed state)

- Totals line shows **0 NOT-VISIBLE** for all the tooltip cases listed in step 4.
- Same cases now appear in the Summary table with verdict `OK`.

### Step 8 — Cleanup

```sh
git switch -                           # back to the prior branch
git branch -D verify-screenshots-self-test
```

## When this self-test fails

| Symptom | Likely cause |
|---|---|
| Step 4 shows `OK` for tooltip cases under broken code | analyzer prompt is too lenient or compares against the wrong baseline; tighten verdict criteria in `prompts/analyzer.md` |
| Step 4 shows `INCONCLUSIVE` instead of `NOT-VISIBLE` | analyzer cannot tell tooltip-baseline from override; add the tooltip-default reference into the prompt |
| Step 7 shows `NOT-VISIBLE` after fix | hypothesis was right but render lag — bump the post-click wait inside the spec, then retry |
| Step 4 hypothesis blames the wrong file | spec-matching heuristics in `prompts/analyzer.md` are off; check the `screenshotSeatMap` extraction logic in step 2 of the analyzer procedure |

## Optional: smoke test against other suites

Once the colorTheme regression passes, run the skill against any other green Playwright suite (e.g. `currencySign.spec.ts`, `visibleWings.spec.ts`) and confirm the totals line shows all `OK` with no false positives. Any spurious `NOT-VISIBLE` there means the analyzer's "is this the baseline?" judgement is over-eager and needs the verdict taxonomy clarified.
