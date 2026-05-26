# currencySign

Global currency string painted on every available seat's price overlay
(`config.currencySign`). Overrides per-seat `data.currency` at render time.

`visibleSeatPriceLabels` is forced to `true` so the price overlay renders.

## Variants
| name           | sign  | notes                                                 |
|----------------|-------|-------------------------------------------------------|
| dollar         | `$`   | single-char baseline                                  |
| euro           | `€`   | non-ASCII single-char                                 |
| pound          | `£`   | non-ASCII single-char                                 |
| USD-truncated  | `USD` | multi-char string — verifies whatever the lib does with it |
