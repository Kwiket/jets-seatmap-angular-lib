# visibleSeatPriceLabels

Paints a per-seat price overlay on every available seat that carries a
numeric `price` in the availability payload. The currency string comes from
the seat's `data.currency` (or `config.currencySign` if set).

| name  | value | expected                                                |
|-------|-------|---------------------------------------------------------|
| true  | true  | Each priced seat shows `.jets-seat__price`.             |
| false | false | No price labels rendered (default).                     |
