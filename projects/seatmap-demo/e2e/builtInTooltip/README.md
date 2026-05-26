# builtInTooltip

Toggles the library's built-in tooltip on seat click.

## Variants
| name  | value | expected                                                              |
|-------|-------|-----------------------------------------------------------------------|
| true  | true  | Clicking a seat opens the library's tooltip.                          |
| false | false | Tooltip is suppressed; host receives `tooltipRequested` to render its own. |

`tooltipOnHover` is forced to `false` to isolate the click path.
