import { TCabinClass } from '../types';

/**
 * Per-class lightness offset (in HSL L percent points) used when
 * `colorfulSeatsByClass` is on and the theme does not provide an explicit
 * override. Values chosen to be visible but subtle.
 */
const CLASS_LIGHTNESS_DELTA: Record<TCabinClass, number> = {
  F: -10,
  B: -5,
  P: 5,
  E: 10,
  A: 0,
};

export function tintSeatColorForClass(
  baseColor: string,
  classType: string,
  themeOverrides?: Partial<Record<TCabinClass, string>>,
): string {
  const cls = (classType?.toUpperCase() ?? 'E') as TCabinClass;
  const override = themeOverrides?.[cls];
  if (override) return override;
  const delta = CLASS_LIGHTNESS_DELTA[cls];
  if (!delta) return baseColor;
  return adjustLightness(baseColor, delta);
}

/**
 * Shift the HSL lightness of a hex (#rgb / #rrggbb) or rgb()/rgba() colour
 * by `deltaPercent` (clamped to [0,100]). Unrecognised formats — for
 * example named CSS colours like `dimgrey` — are returned unchanged.
 */
export function adjustLightness(color: string, deltaPercent: number): string {
  const rgb = parseColorToRgb(color);
  if (!rgb) return color;
  const [h, s, l] = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const newL = clamp(l + deltaPercent, 0, 100);
  const [r2, g2, b2] = hslToRgb(h, s, newL);
  return rgbToHex(r2, g2, b2);
}

function parseColorToRgb(color: string): { r: number; g: number; b: number } | null {
  if (!color) return null;
  const trimmed = color.trim();
  const hex = parseHex(trimmed);
  if (hex) return hex;
  const rgb = parseRgb(trimmed);
  if (rgb) return rgb;
  return null;
}

function parseHex(color: string): { r: number; g: number; b: number } | null {
  const m3 = /^#([0-9a-f]{3})$/i.exec(color);
  if (m3) {
    const [r, g, b] = m3[1].split('').map(c => parseInt(c + c, 16));
    return { r, g, b };
  }
  const m6 = /^#([0-9a-f]{6})$/i.exec(color);
  if (m6) {
    const v = m6[1];
    return {
      r: parseInt(v.slice(0, 2), 16),
      g: parseInt(v.slice(2, 4), 16),
      b: parseInt(v.slice(4, 6), 16),
    };
  }
  return null;
}

function parseRgb(color: string): { r: number; g: number; b: number } | null {
  const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(color);
  if (!m) return null;
  return {
    r: clamp(Math.round(parseFloat(m[1])), 0, 255),
    g: clamp(Math.round(parseFloat(m[2])), 0, 255),
    b: clamp(Math.round(parseFloat(m[3])), 0, 255),
  };
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100, ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = ln - c / 2;
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => v.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
