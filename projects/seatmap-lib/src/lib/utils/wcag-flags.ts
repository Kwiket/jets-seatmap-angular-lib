import { IConfig, IWcagConfig } from '../types';

/**
 * Fully-resolved WCAG flag set. Components read this instead of touching
 * `config.wcag?` directly so the `enabled` shortcut and any cross-flag
 * implications are applied in one place.
 */
export type TResolvedWcagFlags = Required<Omit<IWcagConfig, 'alternativeView'>> & {
  alternativeView: 'grid' | 'list' | 'auto';
};

const FLAG_KEYS: Array<keyof Omit<IWcagConfig, 'enabled' | 'alternativeView'>> = [
  'defaultColorTheme',
  'liveAnnouncer',
  'visibleRestrictionReason',
  'landmarksAndSkipLink',
  'gridSemantics',
  'keyboardNavigation',
  'tooltipDialog',
];

/**
 * Resolve `config.wcag` into a flat, default-populated flag set.
 *
 * Rules, in this order:
 *  1. Every individual flag defaults to `false` (pre-WCAG parity).
 *  2. When `wcag.enabled === true`, any flag that is `undefined` flips to
 *     `true`. Flags explicitly set to `false` stay `false` — this is what
 *     lets a consumer say "everything on except the LiveAnnouncer".
 *  3. `keyboardNavigation` requires `gridSemantics` (it queries cells by
 *     `aria-rowindex`/`aria-colindex`). When `gridSemantics` resolves to
 *     `false` we force `keyboardNavigation` to `false` regardless of the
 *     user's input — the alternative is silently broken arrow keys.
 *  4. `alternativeView` is a tri-state mode, not a boolean. Read from
 *     `wcag.alternativeView` first, fall back to the deprecated top-level
 *     `config.alternativeView`, default `'grid'`.
 */
export function getWcagFlags(config: IConfig | null | undefined): TResolvedWcagFlags {
  const w = config?.wcag ?? {};
  const enabled = w.enabled === true;
  const resolved: Record<string, boolean> = {};
  for (const key of FLAG_KEYS) {
    const explicit = w[key];
    resolved[key] = explicit === undefined ? enabled : explicit;
  }
  if (!resolved['gridSemantics']) {
    resolved['keyboardNavigation'] = false;
  }
  return {
    enabled,
    defaultColorTheme: resolved['defaultColorTheme'],
    liveAnnouncer: resolved['liveAnnouncer'],
    visibleRestrictionReason: resolved['visibleRestrictionReason'],
    landmarksAndSkipLink: resolved['landmarksAndSkipLink'],
    gridSemantics: resolved['gridSemantics'],
    keyboardNavigation: resolved['keyboardNavigation'],
    tooltipDialog: resolved['tooltipDialog'],
    alternativeView: w.alternativeView ?? config?.alternativeView ?? 'grid',
  };
}
