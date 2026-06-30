import { describe, expect, it } from 'vitest';
import { getWcagFlags } from './wcag-flags';
import { IConfig } from '../types';

const baseConfig = (): IConfig =>
  ({
    width: 400,
    lang: 'EN',
    apiUrl: '',
    apiAppId: '',
    apiKey: '',
  }) as IConfig;

describe('getWcagFlags', () => {
  it('returns all flags off when wcag is undefined (parity with main)', () => {
    const flags = getWcagFlags(baseConfig());
    expect(flags.enabled).toBe(false);
    expect(flags.defaultColorTheme).toBe(false);
    expect(flags.liveAnnouncer).toBe(false);
    expect(flags.visibleRestrictionReason).toBe(false);
    expect(flags.landmarksAndSkipLink).toBe(false);
    expect(flags.gridSemantics).toBe(false);
    expect(flags.keyboardNavigation).toBe(false);
    expect(flags.tooltipDialog).toBe(false);
    expect(flags.alternativeView).toBe('grid');
  });

  it('returns all flags off when wcag is empty', () => {
    const flags = getWcagFlags({ ...baseConfig(), wcag: {} });
    expect(flags.enabled).toBe(false);
    expect(flags.defaultColorTheme).toBe(false);
    expect(flags.gridSemantics).toBe(false);
  });

  it('enabled=true flips every undefined flag to true', () => {
    const flags = getWcagFlags({ ...baseConfig(), wcag: { enabled: true } });
    expect(flags.defaultColorTheme).toBe(true);
    expect(flags.liveAnnouncer).toBe(true);
    expect(flags.gridSemantics).toBe(true);
    // keyboardNavigation flips on too because gridSemantics is true
    expect(flags.keyboardNavigation).toBe(true);
    expect(flags.tooltipDialog).toBe(true);
  });

  it('explicit false beats enabled=true (opt-out per flag)', () => {
    const flags = getWcagFlags({
      ...baseConfig(),
      wcag: { enabled: true, liveAnnouncer: false, tooltipDialog: false },
    });
    expect(flags.liveAnnouncer).toBe(false);
    expect(flags.tooltipDialog).toBe(false);
    // Sibling flags stay on
    expect(flags.gridSemantics).toBe(true);
    expect(flags.visibleRestrictionReason).toBe(true);
  });

  it('keyboardNavigation requires gridSemantics — falls back to false otherwise', () => {
    const flags = getWcagFlags({
      ...baseConfig(),
      wcag: { keyboardNavigation: true, gridSemantics: false },
    });
    expect(flags.gridSemantics).toBe(false);
    expect(flags.keyboardNavigation).toBe(false);
  });

  it('per-flag opt-in works without enabled shortcut', () => {
    const flags = getWcagFlags({
      ...baseConfig(),
      wcag: { liveAnnouncer: true },
    });
    expect(flags.liveAnnouncer).toBe(true);
    expect(flags.gridSemantics).toBe(false);
    expect(flags.defaultColorTheme).toBe(false);
  });

  it('alternativeView prefers wcag.alternativeView over top-level fallback', () => {
    const f1 = getWcagFlags({ ...baseConfig(), wcag: { alternativeView: 'list' } });
    expect(f1.alternativeView).toBe('list');

    // Fallback path: deprecated top-level field still recognised when wcag.* is absent
    const f2 = getWcagFlags({ ...baseConfig(), alternativeView: 'auto' } as IConfig);
    expect(f2.alternativeView).toBe('auto');

    // wcag.* wins when both are set
    const f3 = getWcagFlags({
      ...baseConfig(),
      alternativeView: 'list',
      wcag: { alternativeView: 'grid' },
    } as IConfig);
    expect(f3.alternativeView).toBe('grid');
  });

  it('handles null/undefined config defensively', () => {
    expect(getWcagFlags(null).gridSemantics).toBe(false);
    expect(getWcagFlags(undefined).alternativeView).toBe('grid');
  });
});
