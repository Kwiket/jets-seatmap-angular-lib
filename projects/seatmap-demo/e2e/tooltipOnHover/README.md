# tooltipOnHover

Opens the tooltip on `mouseenter` (not just on click) when true. Suppressed
on touch devices by the library (see `JetsSeatMapComponent.onSeatMouseEnter`).

| name  | value | expected                                          |
|-------|-------|---------------------------------------------------|
| true  | true  | Hover over a seat shows the tooltip immediately.  |
| false | false | Tooltip appears only on click (default).          |
