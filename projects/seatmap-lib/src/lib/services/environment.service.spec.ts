import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getEnvironmentInfo, resetCachedEnvironmentInfo } from './environment.service';

function setUserAgent(value: string): void {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    get: () => value,
  });
}

function setMaxTouchPoints(value: number): void {
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    get: () => value,
  });
}

/**
 * jsdom defines `ontouchstart` on HTMLElement.prototype, so
 * `'ontouchstart' in document.documentElement` is `true` by default.
 * Temporarily remove it to simulate a desktop browser.
 */
function withoutTouchInPrototype(fn: () => void): void {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  const had = Object.prototype.hasOwnProperty.call(proto, 'ontouchstart');
  const originalDescriptor = had
    ? Object.getOwnPropertyDescriptor(proto, 'ontouchstart')
    : undefined;

  if (had) {
    delete proto['ontouchstart'];
  }

  try {
    fn();
  } finally {
    if (had && originalDescriptor) {
      Object.defineProperty(proto, 'ontouchstart', originalDescriptor);
    }
  }
}

describe('environment.service', () => {
  let originalUserAgentDescriptor: PropertyDescriptor | undefined;
  let originalMaxTouchPointsDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalUserAgentDescriptor =
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), 'userAgent') ??
      Object.getOwnPropertyDescriptor(navigator, 'userAgent');

    originalMaxTouchPointsDescriptor =
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), 'maxTouchPoints') ??
      Object.getOwnPropertyDescriptor(navigator, 'maxTouchPoints');

    resetCachedEnvironmentInfo();
  });

  afterEach(() => {
    if (originalUserAgentDescriptor) {
      Object.defineProperty(navigator, 'userAgent', originalUserAgentDescriptor);
    }
    if (originalMaxTouchPointsDescriptor) {
      Object.defineProperty(navigator, 'maxTouchPoints', originalMaxTouchPointsDescriptor);
    }

    resetCachedEnvironmentInfo();
  });

  describe('isTouchDevice', () => {
    it('returns true when navigator.maxTouchPoints > 0', () => {
      setMaxTouchPoints(2);
      setUserAgent('Mozilla/5.0 (X11; Linux x86_64)');

      withoutTouchInPrototype(() => {
        const info = getEnvironmentInfo();
        expect(info.isTouchDevice).toBe(true);
      });
    });

    it('returns true when "ontouchstart" is present on documentElement', () => {
      setMaxTouchPoints(0);
      setUserAgent('Mozilla/5.0 (X11; Linux x86_64)');
      // jsdom already has ontouchstart on HTMLElement.prototype; do not strip it.

      const info = getEnvironmentInfo();
      expect(info.isTouchDevice).toBe(true);
    });

    it('returns false when neither indicator is present', () => {
      setMaxTouchPoints(0);
      setUserAgent('Mozilla/5.0 (X11; Linux x86_64)');

      withoutTouchInPrototype(() => {
        resetCachedEnvironmentInfo();
        const info = getEnvironmentInfo();
        expect(info.isTouchDevice).toBe(false);
      });
    });
  });

  describe('browser detection', () => {
    beforeEach(() => {
      setMaxTouchPoints(0);
    });

    it('detects Firefox', () => {
      setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0');

      const info = getEnvironmentInfo();
      expect(info.isFirefox).toBe(true);
      expect(info.isChrome).toBe(false);
      expect(info.isSafari).toBe(false);
      expect(info.isEdge).toBe(false);
    });

    it('detects Chrome', () => {
      setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );

      const info = getEnvironmentInfo();
      expect(info.isChrome).toBe(true);
      expect(info.isFirefox).toBe(false);
      // Chrome UA contains 'safari' substring, but isSafari excludes Chrome.
      expect(info.isSafari).toBe(false);
    });

    it('detects Safari (without Chrome substring)', () => {
      setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      );

      const info = getEnvironmentInfo();
      expect(info.isSafari).toBe(true);
      expect(info.isChrome).toBe(false);
      expect(info.isFirefox).toBe(false);
    });

    it('detects Edge', () => {
      setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      );

      const info = getEnvironmentInfo();
      expect(info.isEdge).toBe(true);
    });
  });

  describe('caching', () => {
    it('returns the same object on subsequent calls', () => {
      setMaxTouchPoints(0);
      setUserAgent('Mozilla/5.0 (X11; Linux x86_64)');

      const first = getEnvironmentInfo();
      const second = getEnvironmentInfo();

      expect(second).toBe(first);
    });

    it('resetCachedEnvironmentInfo invalidates the cache', () => {
      setUserAgent('Mozilla/5.0 (X11; Linux x86_64)');

      withoutTouchInPrototype(() => {
        setMaxTouchPoints(0);
        resetCachedEnvironmentInfo();
        const first = getEnvironmentInfo();
        expect(first.isTouchDevice).toBe(false);

        resetCachedEnvironmentInfo();
        setMaxTouchPoints(5);

        const second = getEnvironmentInfo();
        expect(second).not.toBe(first);
        expect(second.isTouchDevice).toBe(true);
      });
    });
  });
});
