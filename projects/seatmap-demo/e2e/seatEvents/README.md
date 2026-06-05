# seatEvents (React-parity)

End-to-end smoke for `seatMouseClick`, `seatMouseLeave` and `availabilityApplied`.

Drives the demo into `externalPassengerManagement + tooltipOnHover` mode with
`builtInTooltip` left at its default (`true`) — the original regression
scenario — then hovers, clicks and uncovers the seat to fire all three events.

| event                  | trigger                                   | expected log line                                |
|------------------------|-------------------------------------------|--------------------------------------------------|
| `tooltipRequested`     | `mouseenter` (hover-tooltip mode)         | `Tooltip requested for seat <N>`                 |
| `seatMouseClick`       | actual click on the seat                  | `Mouse click seat <N>`                           |
| `seatMouseLeave`       | cursor leaves the seat                    | `Mouse leave seat <N>`                           |
| `availabilityApplied`  | after `setAvailability` resolves          | `Availability applied. Existing: N, missing: M`  |

The availability payload deliberately includes `ZZ9` so that
`nonExistingSeatLabels` is non-empty (asserted as `missing: 2`).

`seatEvents-log.png` is the focused screenshot of the event log;
`seatEvents-full.png` shows the seat map + controls + log together.
