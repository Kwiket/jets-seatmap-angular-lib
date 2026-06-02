# rightToLeft

Enables RTL adjustments for RTL locales. The seat layout itself is not
mirrored — only tooltip text direction and horizontal-mode orientation
change.

| name  | value | expected                                                                 |
|-------|-------|--------------------------------------------------------------------------|
| true  | true  | Seat layout unchanged; tooltip header/features use `direction: rtl`.     |
| false | false | Default LTR layout.                                                      |
