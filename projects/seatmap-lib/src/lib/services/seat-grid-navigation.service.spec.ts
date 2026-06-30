import { describe, it, expect, beforeEach } from 'vitest';
import {
  SeatGridNavigationService,
  ICellPos,
  TGridKey,
} from './seat-grid-navigation.service';
import {
  IDeckData,
  IRowData,
  ISeatData,
  TSeatStatus,
  TSeatType,
} from '../types';

// ─── Test helpers ────────────────────────────────────────────────────────────

function seat(
  type: TSeatType = 'seat',
  status: TSeatStatus = 'available',
  letter = 'A',
): ISeatData {
  return {
    id: `${type}-${status}-${letter}-${Math.random()}`,
    letter,
    type,
    status,
    size: 1,
  };
}

function row(seats: ISeatData[], id = `row-${Math.random()}`): IRowData {
  return { id, seats };
}

function deck(rows: IRowData[]): IDeckData {
  return { rows };
}

/** Build a uniform deck: `r` rows × `c` cols, all available seats. */
function uniformDeck(r: number, c: number): IDeckData {
  const rows: IRowData[] = [];
  for (let i = 0; i < r; i++) {
    const seats: ISeatData[] = [];
    for (let j = 0; j < c; j++) {
      seats.push(seat('seat', 'available', String.fromCharCode(65 + j)));
    }
    rows.push(row(seats, `row-${i}`));
  }
  return deck(rows);
}

function key(k: string, opts: { ctrlKey?: boolean; metaKey?: boolean } = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: k, ...opts });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SeatGridNavigationService', () => {
  let svc: SeatGridNavigationService;

  beforeEach(() => {
    svc = new SeatGridNavigationService();
  });

  // ── classifyKey ────────────────────────────────────────────────────────────
  describe('classifyKey', () => {
    const cases: Array<[string, { ctrlKey?: boolean; metaKey?: boolean }, TGridKey | null]> = [
      ['ArrowLeft', {}, 'ArrowLeft'],
      ['ArrowRight', {}, 'ArrowRight'],
      ['ArrowUp', {}, 'ArrowUp'],
      ['ArrowDown', {}, 'ArrowDown'],
      ['Home', {}, 'Home'],
      ['End', {}, 'End'],
      ['PageUp', {}, 'PageUp'],
      ['PageDown', {}, 'PageDown'],
      ['ArrowLeft', { ctrlKey: true }, 'CtrlArrowLeft'],
      ['ArrowRight', { ctrlKey: true }, 'CtrlArrowRight'],
      ['ArrowLeft', { metaKey: true }, 'CtrlArrowLeft'],
      ['ArrowRight', { metaKey: true }, 'CtrlArrowRight'],
      ['Home', { ctrlKey: true }, 'CtrlHome'],
      ['End', { ctrlKey: true }, 'CtrlEnd'],
      ['Home', { metaKey: true }, 'CtrlHome'],
      ['End', { metaKey: true }, 'CtrlEnd'],
      // Non-grid keys → null (so caller can let them bubble).
      ['Enter', {}, null],
      [' ', {}, null],
      ['Escape', {}, null],
      ['Tab', {}, null],
      ['a', {}, null],
      ['Shift', {}, null],
    ];

    for (const [k, opts, expected] of cases) {
      const label = `${opts.ctrlKey ? 'Ctrl+' : ''}${opts.metaKey ? 'Meta+' : ''}${k === ' ' ? 'Space' : k}`;
      it(`maps ${label} → ${expected}`, () => {
        expect(svc.classifyKey(key(k, opts))).toBe(expected);
      });
    }
  });

  // ── initialCell ────────────────────────────────────────────────────────────
  describe('initialCell', () => {
    it('picks the first interactive seat in the deck', () => {
      // Row 0: [aisle, empty, seat(unavailable), seat(available)]
      // Row 1: [seat(available), ...]
      const d = deck([
        row([
          seat('aisle', 'available'),
          seat('empty', 'available'),
          seat('seat', 'unavailable'),
          seat('seat', 'available', 'D'),
        ]),
        row([seat('seat', 'available', 'A')]),
      ]);

      expect(svc.initialCell(0, [d])).toEqual({ deckIdx: 0, rowIdx: 0, colIdx: 3 });
    });

    it('falls back to (0,0,0) when the deck has no interactive seats', () => {
      const d = deck([
        row([seat('aisle', 'available'), seat('empty', 'available')]),
        row([seat('seat', 'unavailable'), seat('index', 'available')]),
      ]);

      expect(svc.initialCell(0, [d])).toEqual({ deckIdx: 0, rowIdx: 0, colIdx: 0 });
    });

    it('falls back to (deckIdx,0,0) for a missing / empty deck', () => {
      expect(svc.initialCell(0, [])).toEqual({ deckIdx: 0, rowIdx: 0, colIdx: 0 });
      expect(svc.initialCell(2, [uniformDeck(2, 2)])).toEqual({ deckIdx: 2, rowIdx: 0, colIdx: 0 });
    });

    it('honours the requested deckIdx', () => {
      const decks = [uniformDeck(2, 3), uniformDeck(2, 3)];
      expect(svc.initialCell(1, decks)).toEqual({ deckIdx: 1, rowIdx: 0, colIdx: 0 });
    });
  });

  // ── move: arrows ───────────────────────────────────────────────────────────
  describe('move: arrows', () => {
    const decks = [uniformDeck(4, 4)];

    it('ArrowRight from middle moves +1 colIdx', () => {
      const from: ICellPos = { deckIdx: 0, rowIdx: 1, colIdx: 1 };
      expect(svc.move(from, 'ArrowRight', decks)).toEqual({ deckIdx: 0, rowIdx: 1, colIdx: 2 });
    });

    it('ArrowRight at the last column stays put (referential identity)', () => {
      const from: ICellPos = { deckIdx: 0, rowIdx: 0, colIdx: 3 };
      const next = svc.move(from, 'ArrowRight', decks);
      expect(next).toBe(from);
    });

    it('ArrowLeft at colIdx 0 stays put (referential identity)', () => {
      const from: ICellPos = { deckIdx: 0, rowIdx: 0, colIdx: 0 };
      const next = svc.move(from, 'ArrowLeft', decks);
      expect(next).toBe(from);
    });

    it('ArrowLeft from middle moves -1 colIdx', () => {
      const from: ICellPos = { deckIdx: 0, rowIdx: 2, colIdx: 2 };
      expect(svc.move(from, 'ArrowLeft', decks)).toEqual({ deckIdx: 0, rowIdx: 2, colIdx: 1 });
    });

    it('ArrowDown moves to the next row, same colIdx', () => {
      const from: ICellPos = { deckIdx: 0, rowIdx: 1, colIdx: 2 };
      expect(svc.move(from, 'ArrowDown', decks)).toEqual({ deckIdx: 0, rowIdx: 2, colIdx: 2 });
    });

    it('ArrowDown clamps colIdx to the next row when shorter', () => {
      // Row 0 has 4 cols, row 1 has 2 cols.
      const d = deck([
        row([seat(), seat(), seat(), seat()]),
        row([seat(), seat()]),
      ]);
      const from: ICellPos = { deckIdx: 0, rowIdx: 0, colIdx: 3 };
      expect(svc.move(from, 'ArrowDown', [d])).toEqual({ deckIdx: 0, rowIdx: 1, colIdx: 1 });
    });

    it('ArrowUp at rowIdx 0 stays put', () => {
      const from: ICellPos = { deckIdx: 0, rowIdx: 0, colIdx: 1 };
      const next = svc.move(from, 'ArrowUp', decks);
      expect(next).toBe(from);
    });

    it('ArrowDown at the last row stays put', () => {
      const from: ICellPos = { deckIdx: 0, rowIdx: 3, colIdx: 0 };
      const next = svc.move(from, 'ArrowDown', decks);
      expect(next).toBe(from);
    });

    it('ArrowUp clamps colIdx to the previous row when shorter', () => {
      // Row 0 has 2 cols, row 1 has 4 cols.
      const d = deck([
        row([seat(), seat()]),
        row([seat(), seat(), seat(), seat()]),
      ]);
      const from: ICellPos = { deckIdx: 0, rowIdx: 1, colIdx: 3 };
      expect(svc.move(from, 'ArrowUp', [d])).toEqual({ deckIdx: 0, rowIdx: 0, colIdx: 1 });
    });
  });

  // ── move: arrows skip non-seat spacer cells ─────────────────────────────────
  describe('move: arrows skip non-seat spacer cells', () => {
    // [seat A(0), aisle(1), seat C(2), empty(3), seat E(4)]
    const spacerRow = () =>
      row([
        seat('seat', 'available', 'A'),
        seat('aisle', 'available'),
        seat('seat', 'available', 'C'),
        seat('empty', 'available'),
        seat('seat', 'available', 'E'),
      ]);

    it('ArrowRight hops over an aisle to the next seat', () => {
      const d = deck([spacerRow()]);
      expect(svc.move({ deckIdx: 0, rowIdx: 0, colIdx: 0 }, 'ArrowRight', [d])).toEqual({
        deckIdx: 0,
        rowIdx: 0,
        colIdx: 2,
      });
    });

    it('ArrowRight hops over an empty to the next seat', () => {
      const d = deck([spacerRow()]);
      expect(svc.move({ deckIdx: 0, rowIdx: 0, colIdx: 2 }, 'ArrowRight', [d])).toEqual({
        deckIdx: 0,
        rowIdx: 0,
        colIdx: 4,
      });
    });

    it('ArrowLeft hops over spacers back to the previous seat', () => {
      const d = deck([spacerRow()]);
      expect(svc.move({ deckIdx: 0, rowIdx: 0, colIdx: 4 }, 'ArrowLeft', [d])).toEqual({
        deckIdx: 0,
        rowIdx: 0,
        colIdx: 2,
      });
    });

    it('ArrowRight stays put (referential identity) when only spacers remain', () => {
      // [seat(0), aisle(1), empty(2)]
      const d = deck([
        row([seat('seat', 'available', 'A'), seat('aisle', 'available'), seat('empty', 'available')]),
      ]);
      const from: ICellPos = { deckIdx: 0, rowIdx: 0, colIdx: 0 };
      expect(svc.move(from, 'ArrowRight', [d])).toBe(from);
    });

    it('plain ArrowRight still lands on an unavailable seat (only spacers are skipped)', () => {
      // [seat available(0), aisle(1), seat unavailable(2)]
      const d = deck([
        row([
          seat('seat', 'available', 'A'),
          seat('aisle', 'available'),
          seat('seat', 'unavailable', 'C'),
        ]),
      ]);
      expect(svc.move({ deckIdx: 0, rowIdx: 0, colIdx: 0 }, 'ArrowRight', [d])).toEqual({
        deckIdx: 0,
        rowIdx: 0,
        colIdx: 2,
      });
    });

    it('Home / End target the first / last SEAT, not a leading / trailing spacer', () => {
      // [aisle(0), seat B(1), seat C(2), empty(3)]
      const d = deck([
        row([
          seat('aisle', 'available'),
          seat('seat', 'available', 'B'),
          seat('seat', 'available', 'C'),
          seat('empty', 'available'),
        ]),
      ]);
      expect(svc.move({ deckIdx: 0, rowIdx: 0, colIdx: 2 }, 'Home', [d])).toEqual({
        deckIdx: 0,
        rowIdx: 0,
        colIdx: 1,
      });
      expect(svc.move({ deckIdx: 0, rowIdx: 0, colIdx: 1 }, 'End', [d])).toEqual({
        deckIdx: 0,
        rowIdx: 0,
        colIdx: 2,
      });
    });

    it('ArrowDown skips a seatless separator row to the next row with seats', () => {
      const d = deck([
        row([seat('seat', 'available', 'A'), seat('seat', 'available', 'B')]), // row 0
        row([seat('aisle', 'available'), seat('empty', 'available')]), // row 1: separator, no seats
        row([seat('seat', 'available', 'A'), seat('seat', 'available', 'B')]), // row 2
      ]);
      expect(svc.move({ deckIdx: 0, rowIdx: 0, colIdx: 1 }, 'ArrowDown', [d])).toEqual({
        deckIdx: 0,
        rowIdx: 2,
        colIdx: 1,
      });
    });

    it('CtrlEnd lands on the last SEAT, skipping a trailing spacer cell', () => {
      // last row: [seat A(0), seat B(1), empty(2)]
      const d = deck([
        row([seat('seat', 'available', 'A'), seat('seat', 'available', 'B')]),
        row([seat('seat', 'available', 'A'), seat('seat', 'available', 'B'), seat('empty', 'available')]),
      ]);
      expect(svc.move({ deckIdx: 0, rowIdx: 0, colIdx: 0 }, 'CtrlEnd', [d])).toEqual({
        deckIdx: 0,
        rowIdx: 1,
        colIdx: 1,
      });
    });
  });

  // ── move: Home / End ───────────────────────────────────────────────────────
  describe('move: Home / End', () => {
    const decks = [uniformDeck(3, 5)];

    it('Home jumps to colIdx 0 of the current row', () => {
      const from: ICellPos = { deckIdx: 0, rowIdx: 1, colIdx: 3 };
      expect(svc.move(from, 'Home', decks)).toEqual({ deckIdx: 0, rowIdx: 1, colIdx: 0 });
    });

    it('Home at colIdx 0 stays put', () => {
      const from: ICellPos = { deckIdx: 0, rowIdx: 1, colIdx: 0 };
      const next = svc.move(from, 'Home', decks);
      expect(next).toBe(from);
    });

    it('End jumps to the last column of the current row', () => {
      const from: ICellPos = { deckIdx: 0, rowIdx: 2, colIdx: 1 };
      expect(svc.move(from, 'End', decks)).toEqual({ deckIdx: 0, rowIdx: 2, colIdx: 4 });
    });

    it('End at the last column stays put', () => {
      const from: ICellPos = { deckIdx: 0, rowIdx: 2, colIdx: 4 };
      const next = svc.move(from, 'End', decks);
      expect(next).toBe(from);
    });
  });

  // ── move: CtrlHome / CtrlEnd ───────────────────────────────────────────────
  describe('move: CtrlHome / CtrlEnd', () => {
    it('CtrlHome jumps to the first column of the first row', () => {
      const decks = [uniformDeck(3, 4)];
      const from: ICellPos = { deckIdx: 0, rowIdx: 2, colIdx: 3 };
      expect(svc.move(from, 'CtrlHome', decks)).toEqual({ deckIdx: 0, rowIdx: 0, colIdx: 0 });
    });

    it('CtrlEnd jumps to the last column of the last row', () => {
      const decks = [uniformDeck(3, 4)];
      const from: ICellPos = { deckIdx: 0, rowIdx: 0, colIdx: 0 };
      expect(svc.move(from, 'CtrlEnd', decks)).toEqual({ deckIdx: 0, rowIdx: 2, colIdx: 3 });
    });

    it('CtrlEnd respects ragged last row width', () => {
      // Row 0: 4 cols, Row 1: 2 cols.
      const d = deck([
        row([seat(), seat(), seat(), seat()]),
        row([seat(), seat()]),
      ]);
      const from: ICellPos = { deckIdx: 0, rowIdx: 0, colIdx: 0 };
      expect(svc.move(from, 'CtrlEnd', [d])).toEqual({ deckIdx: 0, rowIdx: 1, colIdx: 1 });
    });

    it('CtrlHome already at (0,0) stays put', () => {
      const decks = [uniformDeck(2, 2)];
      const from: ICellPos = { deckIdx: 0, rowIdx: 0, colIdx: 0 };
      expect(svc.move(from, 'CtrlHome', decks)).toBe(from);
    });
  });

  // ── move: PageUp / PageDown ────────────────────────────────────────────────
  describe('move: PageUp / PageDown', () => {
    it('PageDown moves +5 rows', () => {
      const decks = [uniformDeck(10, 3)];
      const from: ICellPos = { deckIdx: 0, rowIdx: 2, colIdx: 1 };
      expect(svc.move(from, 'PageDown', decks)).toEqual({ deckIdx: 0, rowIdx: 7, colIdx: 1 });
    });

    it('PageDown clamps to the last row', () => {
      const decks = [uniformDeck(8, 3)];
      const from: ICellPos = { deckIdx: 0, rowIdx: 6, colIdx: 2 };
      expect(svc.move(from, 'PageDown', decks)).toEqual({ deckIdx: 0, rowIdx: 7, colIdx: 2 });
    });

    it('PageUp moves -5 rows', () => {
      const decks = [uniformDeck(10, 3)];
      const from: ICellPos = { deckIdx: 0, rowIdx: 8, colIdx: 0 };
      expect(svc.move(from, 'PageUp', decks)).toEqual({ deckIdx: 0, rowIdx: 3, colIdx: 0 });
    });

    it('PageUp clamps to row 0', () => {
      const decks = [uniformDeck(10, 3)];
      const from: ICellPos = { deckIdx: 0, rowIdx: 3, colIdx: 2 };
      expect(svc.move(from, 'PageUp', decks)).toEqual({ deckIdx: 0, rowIdx: 0, colIdx: 2 });
    });

    it('PageUp at row 0 stays put', () => {
      const decks = [uniformDeck(10, 3)];
      const from: ICellPos = { deckIdx: 0, rowIdx: 0, colIdx: 1 };
      expect(svc.move(from, 'PageUp', decks)).toBe(from);
    });

    it('PageDown clamps colIdx for ragged target row', () => {
      // Rows 0-4 have 4 cols; row 5 has 2 cols.
      const rows: IRowData[] = [];
      for (let i = 0; i < 5; i++) rows.push(row([seat(), seat(), seat(), seat()]));
      rows.push(row([seat(), seat()]));
      const d = deck(rows);
      const from: ICellPos = { deckIdx: 0, rowIdx: 0, colIdx: 3 };
      expect(svc.move(from, 'PageDown', [d])).toEqual({ deckIdx: 0, rowIdx: 5, colIdx: 1 });
    });
  });

  // ── move: skim (Ctrl+Arrow) ────────────────────────────────────────────────
  describe('move: skim mode (CtrlArrowLeft / CtrlArrowRight)', () => {
    it('CtrlArrowRight hops over aisle / empty / unavailable to the next interactive seat', () => {
      // cols:  0=seat(avail), 1=aisle, 2=empty, 3=seat(unavail), 4=seat(avail)
      const d = deck([
        row([
          seat('seat', 'available', 'A'),
          seat('aisle', 'available'),
          seat('empty', 'available'),
          seat('seat', 'unavailable', 'D'),
          seat('seat', 'available', 'E'),
        ]),
      ]);
      const from: ICellPos = { deckIdx: 0, rowIdx: 0, colIdx: 0 };
      expect(svc.move(from, 'CtrlArrowRight', [d])).toEqual({
        deckIdx: 0,
        rowIdx: 0,
        colIdx: 4,
      });
    });

    it('CtrlArrowLeft hops left to the previous interactive seat', () => {
      const d = deck([
        row([
          seat('seat', 'available', 'A'),
          seat('aisle', 'available'),
          seat('seat', 'unavailable', 'C'),
          seat('seat', 'available', 'D'),
        ]),
      ]);
      const from: ICellPos = { deckIdx: 0, rowIdx: 0, colIdx: 3 };
      expect(svc.move(from, 'CtrlArrowLeft', [d])).toEqual({
        deckIdx: 0,
        rowIdx: 0,
        colIdx: 0,
      });
    });

    it('CtrlArrowRight stays put when no further interactive seat exists in the row', () => {
      const d = deck([
        row([
          seat('seat', 'available', 'A'),
          seat('aisle', 'available'),
          seat('seat', 'unavailable', 'C'),
        ]),
      ]);
      const from: ICellPos = { deckIdx: 0, rowIdx: 0, colIdx: 0 };
      const next = svc.move(from, 'CtrlArrowRight', [d]);
      expect(next).toBe(from);
    });

    it('CtrlArrowLeft stays put when no further interactive seat exists to the left', () => {
      const d = deck([
        row([
          seat('aisle', 'available'),
          seat('seat', 'unavailable', 'B'),
          seat('seat', 'available', 'C'),
        ]),
      ]);
      const from: ICellPos = { deckIdx: 0, rowIdx: 0, colIdx: 2 };
      const next = svc.move(from, 'CtrlArrowLeft', [d]);
      expect(next).toBe(from);
    });

    it('CtrlArrowRight finds adjacent interactive seat', () => {
      const d = deck([
        row([
          seat('seat', 'available', 'A'),
          seat('seat', 'selected', 'B'),
          seat('seat', 'preferred', 'C'),
        ]),
      ]);
      const from: ICellPos = { deckIdx: 0, rowIdx: 0, colIdx: 0 };
      expect(svc.move(from, 'CtrlArrowRight', [d])).toEqual({
        deckIdx: 0,
        rowIdx: 0,
        colIdx: 1,
      });
    });
  });

  // ── isInteractive ──────────────────────────────────────────────────────────
  describe('isInteractive', () => {
    const interactiveStatuses: TSeatStatus[] = ['available', 'selected', 'preferred', 'extra'];
    const nonInteractiveStatuses: TSeatStatus[] = ['unavailable', 'disabled'];
    const nonSeatTypes: TSeatType[] = ['aisle', 'empty', 'index'];

    for (const status of interactiveStatuses) {
      it(`true for seat-type with status "${status}"`, () => {
        const d = deck([row([seat('seat', status)])]);
        expect(svc.isInteractive([d], { deckIdx: 0, rowIdx: 0, colIdx: 0 })).toBe(true);
      });
    }

    for (const status of nonInteractiveStatuses) {
      it(`false for seat-type with status "${status}"`, () => {
        const d = deck([row([seat('seat', status)])]);
        expect(svc.isInteractive([d], { deckIdx: 0, rowIdx: 0, colIdx: 0 })).toBe(false);
      });
    }

    for (const t of nonSeatTypes) {
      it(`false for type "${t}" regardless of status`, () => {
        const d = deck([row([seat(t, 'available')])]);
        expect(svc.isInteractive([d], { deckIdx: 0, rowIdx: 0, colIdx: 0 })).toBe(false);
      });
    }

    it('false for missing deck / row / seat positions', () => {
      const d = deck([row([seat('seat', 'available')])]);
      expect(svc.isInteractive([d], { deckIdx: 5, rowIdx: 0, colIdx: 0 })).toBe(false);
      expect(svc.isInteractive([d], { deckIdx: 0, rowIdx: 5, colIdx: 0 })).toBe(false);
      expect(svc.isInteractive([d], { deckIdx: 0, rowIdx: 0, colIdx: 5 })).toBe(false);
    });
  });

  // ── defensive: empty / malformed decks ─────────────────────────────────────
  describe('defensive', () => {
    it('move() returns from unchanged when deck is missing', () => {
      const from: ICellPos = { deckIdx: 0, rowIdx: 0, colIdx: 0 };
      expect(svc.move(from, 'ArrowRight', [])).toBe(from);
    });

    it('move() returns from unchanged when row is missing', () => {
      const d = deck([]);
      const from: ICellPos = { deckIdx: 0, rowIdx: 0, colIdx: 0 };
      expect(svc.move(from, 'ArrowRight', [d])).toBe(from);
    });
  });

  // ─── Horizontal arrow remap (P1a) ──────────────────────────────────────────
  // The cabin is rotated 90deg; in horizontal LTR it is additionally flipped
  // 180deg (deck wrapper), so the visual rotation is opposite to RTL. Remap the
  // four arrow keys so they match the on-screen direction. Measured on the demo:
  //   LTR: model ArrowRight → visually UP, ArrowDown → visually RIGHT
  //   RTL: model ArrowRight → visually DOWN, ArrowDown → visually LEFT
  describe('remapForOrientation', () => {
    it('passes keys through unchanged in vertical mode', () => {
      for (const k of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'] as TGridKey[]) {
        expect(svc.remapForOrientation(k, false, false)).toBe(k);
      }
    });

    it('rotates arrows so they match the screen in horizontal LTR', () => {
      expect(svc.remapForOrientation('ArrowRight', true, false)).toBe('ArrowDown');
      expect(svc.remapForOrientation('ArrowDown', true, false)).toBe('ArrowLeft');
      expect(svc.remapForOrientation('ArrowLeft', true, false)).toBe('ArrowUp');
      expect(svc.remapForOrientation('ArrowUp', true, false)).toBe('ArrowRight');
    });

    it('rotates arrows the opposite way in horizontal RTL', () => {
      expect(svc.remapForOrientation('ArrowRight', true, true)).toBe('ArrowUp');
      expect(svc.remapForOrientation('ArrowDown', true, true)).toBe('ArrowRight');
      expect(svc.remapForOrientation('ArrowLeft', true, true)).toBe('ArrowDown');
      expect(svc.remapForOrientation('ArrowUp', true, true)).toBe('ArrowLeft');
    });

    it('leaves non-arrow keys unchanged in horizontal mode', () => {
      for (const k of ['Home', 'End', 'CtrlHome', 'PageUp'] as TGridKey[]) {
        expect(svc.remapForOrientation(k, true, false)).toBe(k);
      }
    });
  });
});
