import { IPassenger, IRowData, ISeatData, ISeatFeature } from '../types';

export type TSeatPosition = 'window' | 'aisle' | 'middle';

/**
 * Locale keys consumed by the a11y utilities. Listed centrally so the
 * accessible-name builder, the live-region announcer (commit 9) and the
 * list-view component (commit 13) stay in sync with `LOCALES_MAP`.
 */
export const A11Y_LOCALE_KEYS = {
  seatPositionWindow: 'seatPositionWindow',
  seatPositionAisle: 'seatPositionAisle',
  seatPositionMiddle: 'seatPositionMiddle',
  seatExtraLegroom: 'seatExtraLegroom',
  seatExitRow: 'seatExitRow',
  seatAvailable: 'seatAvailable',
  seatUnavailable: 'seatUnavailable',
  seatSelected: 'seatSelected',
  seatSelectedFor: 'seatSelectedFor',
  seatRestrictedFor: 'seatRestrictedFor',
  close: 'close',
  moveToSeat: 'moveToSeat',
  gridLabel: 'gridLabel',
  allSeats: 'allSeats',
  row: 'row',
  seat: 'seat',
  cabin: 'cabin',
  position: 'position',
  features: 'features',
  price: 'price',
  status: 'status',
  action: 'action',
} as const;

/**
 * Returns the position of a seat in its row from a passenger's perspective.
 * - `window`: first or last real (`type === 'seat'`) cell in the row
 * - `aisle`: immediately adjacent to an `aisle`-typed cell
 * - `middle`: any other interactive seat
 * - `null`: not a real seat (aisle, empty, index, etc.)
 *
 * The row's `seats` array is iterated to locate the seat by reference;
 * callers pass the same `seat` object they are about to render.
 */
export function computeSeatPosition(seat: ISeatData, row: IRowData): TSeatPosition | null {
  if (seat.type !== 'seat') return null;
  const cells = row.seats;
  const idx = cells.indexOf(seat);
  if (idx === -1) return null;

  let firstSeatIdx = -1;
  let lastSeatIdx = -1;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].type === 'seat') {
      if (firstSeatIdx === -1) firstSeatIdx = i;
      lastSeatIdx = i;
    }
  }
  if (idx === firstSeatIdx || idx === lastSeatIdx) return 'window';

  const prev = cells[idx - 1];
  const next = cells[idx + 1];
  if (prev?.type === 'aisle' || next?.type === 'aisle') return 'aisle';

  return 'middle';
}

/**
 * Build a comma-separated accessible name for a seat, suitable as the
 * `aria-label` of the seat button. Fragments are joined with `, ` so
 * screen readers pause between them.
 *
 * Sample outputs (locale=EN):
 *   "14C, aisle, extra legroom, available, €12"
 *   "14C, window, selected for John Doe"
 *   "14B, middle, unavailable"
 *   "12A, window, exit row, not available for infant"
 *
 * The function is pure — it does not read from the DOM, services or any
 * global state. Missing locale keys fall back to the bare key string so
 * partial locale tables remain useful in development.
 */
export function buildSeatAriaLabel(
  seat: ISeatData,
  position: TSeatPosition | null,
  locale: Record<string, string>
): string {
  const parts: string[] = [];
  parts.push(seatName(seat));

  if (position) {
    parts.push(t(locale, A11Y_LOCALE_KEYS[positionLocaleKey(position)]));
  }

  if (hasExitRow(seat)) {
    parts.push(t(locale, A11Y_LOCALE_KEYS.seatExitRow));
  } else if (hasExtraLegroom(seat)) {
    parts.push(t(locale, A11Y_LOCALE_KEYS.seatExtraLegroom));
  }

  switch (seat.status) {
    case 'selected':
    case 'preferred':
    case 'extra': {
      const pname = passengerLabel(seat.passenger);
      if (pname) {
        parts.push(`${t(locale, A11Y_LOCALE_KEYS.seatSelectedFor)} ${pname}`);
      } else {
        parts.push(t(locale, A11Y_LOCALE_KEYS.seatSelected));
      }
      break;
    }
    case 'unavailable':
    case 'disabled':
      parts.push(t(locale, A11Y_LOCALE_KEYS.seatUnavailable));
      break;
    case 'available':
    default: {
      const restriction = restrictionLabel(seat, locale);
      if (restriction) {
        parts.push(restriction);
      } else {
        parts.push(t(locale, A11Y_LOCALE_KEYS.seatAvailable));
        const price = priceLabel(seat);
        if (price) parts.push(price);
      }
      break;
    }
  }

  return parts.join(', ');
}

function positionLocaleKey(position: TSeatPosition): 'seatPositionWindow' | 'seatPositionAisle' | 'seatPositionMiddle' {
  switch (position) {
    case 'window':
      return 'seatPositionWindow';
    case 'aisle':
      return 'seatPositionAisle';
    case 'middle':
      return 'seatPositionMiddle';
  }
}

function seatName(seat: ISeatData): string {
  if (seat.number) return seat.number;
  if (seat.name) return seat.name;
  const synthesised = `${seat.rowName ?? ''}${seat.letter ?? ''}`;
  return synthesised || seat.id;
}

function hasFeatureMatching(seat: ISeatData, predicate: (f: ISeatFeature) => boolean): boolean {
  const lists: Array<ISeatFeature[] | undefined> = [seat.features, seat.additionalProps, seat.measurements];
  for (const list of lists) {
    if (!list) continue;
    for (const feature of list) {
      if (predicate(feature)) return true;
    }
  }
  return false;
}

function hasExtraLegroom(seat: ISeatData): boolean {
  if (seat.status === 'extra') return true;
  return hasFeatureMatching(
    seat,
    f =>
      f.key === 'extra_legroom' ||
      f.key === 'extraLegroom' ||
      f.title === 'Extra legroom' ||
      f.title === 'extra_legroom'
  );
}

function hasExitRow(seat: ISeatData): boolean {
  return hasFeatureMatching(seat, f => f.key === 'exitRow' || f.title === 'Exit row');
}

function passengerLabel(p?: IPassenger): string {
  if (!p) return '';
  return p.passengerLabel?.trim() || p.abbr?.trim() || '';
}

function priceLabel(seat: ISeatData): string {
  if (seat.price == null) return '';
  const currency = (seat.currency ?? '').trim();
  return currency ? `${currency}${seat.price}` : String(seat.price);
}

function restrictionLabel(seat: ISeatData, locale: Record<string, string>): string {
  const types = seat.passengerTypes;
  if (!types || types.length === 0) return '';
  const template = t(locale, A11Y_LOCALE_KEYS.seatRestrictedFor);
  const translatedTypes = types.map(pt => locale[pt] ?? pt).join(', ');
  return template.includes('{type}') ? template.replace('{type}', translatedTypes) : `${template} ${translatedTypes}`;
}

function t(locale: Record<string, string>, key: string): string {
  return locale[key] ?? key;
}
