# colorTheme

`colorTheme` is the largest config object — 30+ keys covering seat colors,
deck and fuselage backgrounds, cabin titles, exits, bulks, the passenger
badge, fonts, and the tooltip. The React Playwright suite splits these
into 11 sub-folders (`bulk/`, `cabinTitles/`, `customSeatColorRanges/`,
`deckLayout/`, `deckSelector/`, `exits/`, `fontFamily/`, `fuselage/`,
`passengerBadge/`, `seatColors/`, `seatMapBackground/`, `tooltip/`).

For now this Angular port consolidates them into a single spec that
exercises 4 distinctive whole-theme variants plus a dedicated tooltip case.
Each variant flips a different family of keys; the rendered screenshot
covers their visual interactions in one shot.

## Variants
| name           | what it changes                                              |
|----------------|--------------------------------------------------------------|
| default        | empty colorTheme — uses library defaults                     |
| dark           | dark background + dark tooltip + bright accent seats         |
| bright         | warm cream palette                                           |
| monochrome     | greyscale with strong selected color                         |
| tooltip-dark   | tooltip-only theme, opens tooltip on a seat for inspection   |

## When you need finer-grained tests
Splitting into 11 subfolders is straightforward — copy this file as a
template and pass a focused subset of theme keys. The `helpers/demo.ts`
contract is unchanged.
