# customCabinTitles

Overrides the cabin class labels (F/B/P/E) shown on the deck side strip
when `visibleCabinTitles` is true.

## Variants
| name    | notes                                              |
|---------|----------------------------------------------------|
| default | built-in EN defaults: `First class / Business class / Premium class / Economy class` |
| short   | single-letter labels: `{ F:'F', B:'B', P:'P', E:'E' }` |
| long    | full names: `{ F:'First', B:'Business', P:'Premium', E:'Economy' }` |

Each test also asserts the rendered cabin labels in the DOM (`.jets-cabin-label__text`)
match the expected list, so the screenshot is backed by a real check, not just a snapshot.
