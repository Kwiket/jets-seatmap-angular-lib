import { describe, it, expect } from 'vitest';
import { buildSeatAriaLabel, computeSeatPosition } from './a11y';
import { IRowData, ISeatData } from '../types';

const EN: Record<string, string> = {
  seatPositionWindow: 'window',
  seatPositionAisle: 'aisle',
  seatPositionMiddle: 'middle',
  seatExtraLegroom: 'extra legroom',
  seatExitRow: 'exit row',
  seatAvailable: 'available',
  seatUnavailable: 'unavailable',
  seatSelected: 'selected',
  seatSelectedFor: 'selected for',
  seatRestrictedFor: 'not available for',
  ADT: 'adult',
  CHD: 'child',
  INF: 'infant',
};

function makeSeat(overrides: Partial<ISeatData> = {}): ISeatData {
  return {
    id: 's-default',
    letter: 'C',
    type: 'seat',
    status: 'available',
    size: 32,
    number: '14C',
    rowName: '14',
    ...overrides,
  };
}

function makeRow(seats: ISeatData[]): IRowData {
  return { id: 'r-1', seats };
}

function makeAisle(id: string): ISeatData {
  return { id, letter: '', type: 'aisle', status: 'available', size: 32 };
}

describe('computeSeatPosition', () => {
  it('returns null for non-seat cells', () => {
    const aisle = makeAisle('a-1');
    const row = makeRow([aisle]);
    expect(computeSeatPosition(aisle, row)).toBeNull();
  });

  it('returns null when the seat is not present in the row', () => {
    const seat = makeSeat();
    const otherRow = makeRow([makeSeat({ id: 'other' })]);
    expect(computeSeatPosition(seat, otherRow)).toBeNull();
  });

  it('marks the first seat-type cell as window', () => {
    const window = makeSeat({ id: 's-A', letter: 'A', number: '14A' });
    const middle = makeSeat({ id: 's-B', letter: 'B', number: '14B' });
    const aisle = makeAisle('a-1');
    const window2 = makeSeat({ id: 's-D', letter: 'D', number: '14D' });
    const row = makeRow([window, middle, aisle, window2]);
    expect(computeSeatPosition(window, row)).toBe('window');
  });

  it('marks the last seat-type cell as window even when followed by extras', () => {
    const w1 = makeSeat({ id: 's-A' });
    const w2 = makeSeat({ id: 's-B' });
    const row = makeRow([w1, w2]);
    expect(computeSeatPosition(w2, row)).toBe('window');
  });

  it('marks seats adjacent to an aisle cell as aisle', () => {
    const window = makeSeat({ id: 's-A' });
    const aisleSeat = makeSeat({ id: 's-B' });
    const aisle = makeAisle('a');
    const aisleSeat2 = makeSeat({ id: 's-C' });
    const window2 = makeSeat({ id: 's-D' });
    const row = makeRow([window, aisleSeat, aisle, aisleSeat2, window2]);
    expect(computeSeatPosition(aisleSeat, row)).toBe('aisle');
    expect(computeSeatPosition(aisleSeat2, row)).toBe('aisle');
  });

  it('falls back to middle for interior seats without aisle neighbours', () => {
    const w = makeSeat({ id: 'w' });
    const m = makeSeat({ id: 'm' });
    const w2 = makeSeat({ id: 'w2' });
    const row = makeRow([w, m, w2]);
    expect(computeSeatPosition(m, row)).toBe('middle');
  });

  it('treats a single-seat row as window for that seat', () => {
    const only = makeSeat({ id: 'only' });
    const row = makeRow([only]);
    expect(computeSeatPosition(only, row)).toBe('window');
  });
});

describe('buildSeatAriaLabel', () => {
  it('builds an available label with position and price', () => {
    const seat = makeSeat({ price: 12, currency: '€' });
    expect(buildSeatAriaLabel(seat, 'aisle', EN)).toBe('14C, aisle, available, €12');
  });

  it('omits price fragment when the seat has no numeric price', () => {
    const seat = makeSeat({ price: undefined });
    expect(buildSeatAriaLabel(seat, 'window', EN)).toBe('14C, window, available');
  });

  it('omits the position fragment when position is null', () => {
    const seat = makeSeat();
    expect(buildSeatAriaLabel(seat, null, EN)).toBe('14C, available');
  });

  it('adds the extra-legroom marker when the seat status is `extra`', () => {
    const seat = makeSeat({ status: 'extra', price: 25, currency: '$' });
    expect(buildSeatAriaLabel(seat, 'window', EN)).toContain('extra legroom');
  });

  it('adds the exit-row marker from features', () => {
    const seat = makeSeat({ features: [{ title: 'Exit row', key: 'exitRow' }] });
    expect(buildSeatAriaLabel(seat, 'window', EN)).toContain('exit row');
  });

  it('prefers exit-row marker over extra-legroom marker', () => {
    const seat = makeSeat({
      status: 'extra',
      features: [{ title: 'Exit row', key: 'exitRow' }],
    });
    const label = buildSeatAriaLabel(seat, 'window', EN);
    expect(label).toContain('exit row');
    expect(label).not.toContain('extra legroom');
  });

  it('uses passenger label when seat is selected', () => {
    const seat = makeSeat({
      status: 'selected',
      passenger: { id: 'p1', passengerLabel: 'John Doe' },
    });
    expect(buildSeatAriaLabel(seat, 'window', EN)).toBe('14C, window, selected for John Doe');
  });

  it('falls back to the bare `selected` token when no passenger is attached', () => {
    const seat = makeSeat({ status: 'selected' });
    expect(buildSeatAriaLabel(seat, 'window', EN)).toBe('14C, window, selected');
  });

  it('renders the unavailable marker for unavailable seats', () => {
    const seat = makeSeat({ status: 'unavailable' });
    expect(buildSeatAriaLabel(seat, 'middle', EN)).toBe('14C, middle, unavailable');
  });

  it('renders the passenger-type restriction when set on an available seat', () => {
    const seat = makeSeat({ passengerTypes: ['INF'] });
    expect(buildSeatAriaLabel(seat, 'window', EN)).toBe('14C, window, not available for infant');
  });

  it('joins multiple restricted passenger types with comma', () => {
    const seat = makeSeat({ passengerTypes: ['INF', 'CHD'] });
    expect(buildSeatAriaLabel(seat, 'window', EN)).toBe('14C, window, not available for infant, child');
  });

  it('supports the `{type}` placeholder in the restriction template', () => {
    const locale = { ...EN, seatRestrictedFor: 'reserved for non-{type} passengers' };
    const seat = makeSeat({ passengerTypes: ['INF'] });
    expect(buildSeatAriaLabel(seat, 'window', locale)).toBe(
      '14C, window, reserved for non-infant passengers'
    );
  });

  it('falls back to the key when a locale entry is missing', () => {
    const seat = makeSeat();
    const label = buildSeatAriaLabel(seat, 'window', {});
    expect(label).toBe('14C, seatPositionWindow, seatAvailable');
  });

  it('uses the synthesised row+letter name when `number` is missing', () => {
    const seat = makeSeat({ number: undefined, rowName: '7', letter: 'F' });
    expect(buildSeatAriaLabel(seat, 'window', EN)).toBe('7F, window, available');
  });
});
