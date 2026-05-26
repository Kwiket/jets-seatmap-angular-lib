/** Browser detection utility — ported from @seatmaps.com/react-lib */

export interface IEnvironmentInfo {
  isFirefox: boolean;
  isChrome: boolean;
  isSafari: boolean;
  isEdge: boolean;
  isTouchDevice: boolean;
}

let _cached: IEnvironmentInfo | null = null;

export function getEnvironmentInfo(): IEnvironmentInfo {
  if (_cached) return _cached;

  if (typeof navigator === 'undefined') {
    _cached = {
      isFirefox: false,
      isChrome: false,
      isSafari: false,
      isEdge: false,
      isTouchDevice: false,
    };
    return _cached;
  }

  const ua = navigator.userAgent.toLowerCase();
  const isFirefox = ua.includes('firefox');
  const isChrome = ua.includes('chrome');
  const isSafari = ua.includes('safari') && !isChrome;
  const isEdge = ua.includes('edg');
  const isTouchDevice = navigator.maxTouchPoints > 0 || 'ontouchstart' in document.documentElement;

  _cached = { isFirefox, isChrome, isSafari, isEdge, isTouchDevice };
  return _cached;
}

/** @internal Reset cached environment info — for tests only. */
export function resetCachedEnvironmentInfo(): void {
  _cached = null;
}
