# builtInDeckSelector

Toggles the library's built-in deck selector UI on a multi-deck flight.

## Variants
| name  | value | expected                                                   |
|-------|-------|------------------------------------------------------------|
| true  | true  | Deck selector control is rendered when more than one deck. |
| false | false | Deck selector control is hidden; deck switching is delegated to the host. |

## Run

```bash
npm run e2e -- builtInDeckSelector
```
