import { describe, it, expect } from 'vitest';
import { tintSeatColorForClass, adjustLightness } from './color-tint';

describe('adjustLightness', () => {
  it('returns the same hex when delta is 0', () => {
    expect(adjustLightness('#888888', 0)).toBe('#888888');
  });

  it('lightens a hex colour', () => {
    const lighter = adjustLightness('#888888', 10);
    expect(lighter).not.toBe('#888888');
    expect(parseInt(lighter.slice(1, 3), 16)).toBeGreaterThan(0x88);
  });

  it('darkens a hex colour', () => {
    const darker = adjustLightness('#888888', -10);
    expect(darker).not.toBe('#888888');
    expect(parseInt(darker.slice(1, 3), 16)).toBeLessThan(0x88);
  });

  it('accepts shorthand hex (#rgb)', () => {
    const out = adjustLightness('#888', 10);
    expect(out).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('accepts rgb(...) notation', () => {
    const out = adjustLightness('rgb(136, 136, 136)', 10);
    expect(out).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('returns input unchanged for unrecognised formats (named colour)', () => {
    expect(adjustLightness('dimgrey', 10)).toBe('dimgrey');
  });

  it('clamps lightness at 0 and 100', () => {
    expect(adjustLightness('#000000', -50)).toBe('#000000');
    expect(adjustLightness('#ffffff', 50)).toBe('#ffffff');
  });
});

describe('tintSeatColorForClass', () => {
  const BASE = '#4cAF50';

  it('returns base color for class A (no delta)', () => {
    expect(tintSeatColorForClass(BASE, 'A')).toBe(BASE);
  });

  it('produces a lighter colour for economy (E) than for first (F)', () => {
    const economy = tintSeatColorForClass(BASE, 'E');
    const first = tintSeatColorForClass(BASE, 'F');
    expect(economy).not.toBe(BASE);
    expect(first).not.toBe(BASE);
    expect(economy).not.toBe(first);
  });

  it('uppercases classType', () => {
    expect(tintSeatColorForClass(BASE, 'e')).toBe(tintSeatColorForClass(BASE, 'E'));
  });

  it('lets themeOverrides win over algorithmic tint', () => {
    expect(
      tintSeatColorForClass(BASE, 'B', { B: '#ff0000' }),
    ).toBe('#ff0000');
  });

  it('falls back to algorithm when override key is missing for the class', () => {
    const out = tintSeatColorForClass(BASE, 'E', { F: '#ff0000' });
    expect(out).not.toBe('#ff0000');
    expect(out).not.toBe(BASE);
  });

  it('returns base color for unknown class codes', () => {
    expect(tintSeatColorForClass(BASE, 'X')).toBe(BASE);
  });
});
