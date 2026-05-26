# hiddenSeatFeatures

Filter list of seat feature keys to suppress from the tooltip's feature
icons section.

## Variants
| name           | hidden list                                          |
|----------------|------------------------------------------------------|
| none-hidden    | `[]` — all features shown                            |
| all-hidden     | `['noFloorStorage', 'nearLavatory', 'nearStairs']`   |
| partial-hidden | `['nearLavatory', 'nearGalley']`                     |

Each variant opens the tooltip on a seat so the feature icons can be observed.
