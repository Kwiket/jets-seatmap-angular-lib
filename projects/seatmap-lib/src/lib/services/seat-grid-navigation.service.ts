/**
 * Pure-logic service for 2D keyboard navigation across the seat grid.
 *
 * Navigation lands on real `seat` cells only (any status, including
 * `unavailable`). Non-seat spacer cells (aisle / empty / index) keep their
 * `role="gridcell"` for screen-reader grid structure but are NEVER an
 * arrow-key focus target — otherwise the focus ring renders around blank
 * space between seats. This is a deliberate, pragmatic departure from the
 * strict APG "Layout Grid" pattern (which makes every cell focusable); see
 * docs/wcag/PLAN.md Decisions log.
 *
 *   - Arrow keys move focus to the next/nearest SEAT in the axis, skipping
 *     spacer cells (and seatless separator rows for vertical moves).
 *   - Home / End jump to the first / last SEAT of the current row.
 *   - Ctrl+Home / Ctrl+End jump to the first / last SEAT of the current deck.
 *   - PageUp / PageDown jump 5 rows toward a seat-bearing row.
 *   - Ctrl+Arrow{Left,Right} "skim" between interactive seats only
 *     (available/selected/preferred/extra — i.e. also skipping `unavailable`).
 *
 * Cross-deck navigation is intentionally OUT OF SCOPE — `move()` always
 * returns the same `deckIdx`. The orchestrator wiring inside
 * `JetsSeatMapComponent` is responsible for translating "left edge of
 * deck N" into "deck N-1" if it wants to.
 *
 * Activation (Enter / Space) and dismiss (Escape) are NOT a grid concern;
 * they go through native button activation / per-seat handlers.
 */

import { Injectable } from '@angular/core';
import { IDeckData, ISeatData, TSeatStatus } from '../types';

export interface ICellPos {
  deckIdx: number;
  rowIdx: number;
  colIdx: number;
}

/** Discrete keystrokes the navigator understands (composer's vocabulary). */
export type TGridKey =
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'Home'
  | 'End'
  | 'CtrlHome'
  | 'CtrlEnd'
  | 'PageUp'
  | 'PageDown'
  | 'CtrlArrowLeft'
  | 'CtrlArrowRight';

const PAGE_STEP = 5;

/** Seat statuses that the user can interact with (focus + act on). */
const INTERACTIVE_STATUSES: ReadonlySet<TSeatStatus> = new Set<TSeatStatus>([
  'available',
  'selected',
  'preferred',
  'extra',
]);

@Injectable({ providedIn: 'root' })
export class SeatGridNavigationService {
  /**
   * Map a `KeyboardEvent` to a `TGridKey | null`. Returns null for keys the
   * grid does not consume (so callers can let the event bubble).
   * Handles Ctrl-modifier (or Meta on macOS) and PageUp/Down.
   */
  classifyKey(ev: KeyboardEvent): TGridKey | null {
    const mod = ev.ctrlKey || ev.metaKey;

    switch (ev.key) {
      case 'ArrowLeft':
        return mod ? 'CtrlArrowLeft' : 'ArrowLeft';
      case 'ArrowRight':
        return mod ? 'CtrlArrowRight' : 'ArrowRight';
      case 'ArrowUp':
        return 'ArrowUp';
      case 'ArrowDown':
        return 'ArrowDown';
      case 'Home':
        return mod ? 'CtrlHome' : 'Home';
      case 'End':
        return mod ? 'CtrlEnd' : 'End';
      case 'PageUp':
        return 'PageUp';
      case 'PageDown':
        return 'PageDown';
      default:
        return null;
    }
  }

  /**
   * Compute the next focused cell given current position, the key, and the
   * deck data. Returns the SAME `ICellPos` (referentially) if no move was
   * possible.
   */
  move(from: ICellPos, key: TGridKey, decks: IDeckData[]): ICellPos {
    const deck = decks[from.deckIdx];
    if (!deck || !deck.rows || deck.rows.length === 0) {
      return from;
    }

    const rows = deck.rows;
    const currentRow = rows[from.rowIdx];
    if (!currentRow || !currentRow.seats) {
      return from;
    }

    switch (key) {
      case 'ArrowLeft':
        return this.stepHorizontal(from, currentRow.seats, -1);
      case 'ArrowRight':
        return this.stepHorizontal(from, currentRow.seats, +1);
      case 'ArrowUp':
        return this.stepVertical(from, rows, from.rowIdx - 1, -1);
      case 'ArrowDown':
        return this.stepVertical(from, rows, from.rowIdx + 1, +1);
      case 'Home': {
        const col = this.firstSeatCol(currentRow.seats);
        if (col < 0 || col === from.colIdx) return from;
        return { deckIdx: from.deckIdx, rowIdx: from.rowIdx, colIdx: col };
      }
      case 'End': {
        const col = this.lastSeatCol(currentRow.seats);
        if (col < 0 || col === from.colIdx) return from;
        return { deckIdx: from.deckIdx, rowIdx: from.rowIdx, colIdx: col };
      }
      case 'CtrlHome': {
        const cell = this.firstSeatCellOfDeck(from.deckIdx, rows);
        if (!cell || (cell.rowIdx === from.rowIdx && cell.colIdx === from.colIdx)) return from;
        return cell;
      }
      case 'CtrlEnd': {
        const cell = this.lastSeatCellOfDeck(from.deckIdx, rows);
        if (!cell || (cell.rowIdx === from.rowIdx && cell.colIdx === from.colIdx)) return from;
        return cell;
      }
      case 'PageUp': {
        if (from.rowIdx === 0) return from;
        // Scan from the target row back DOWN toward `from`, so we always land
        // on a seat-bearing row even if the exact target row is a separator.
        const target = Math.max(0, from.rowIdx - PAGE_STEP);
        return this.stepVertical(from, rows, target, +1);
      }
      case 'PageDown': {
        const lastRowIdx = rows.length - 1;
        if (from.rowIdx === lastRowIdx) return from;
        const target = Math.min(lastRowIdx, from.rowIdx + PAGE_STEP);
        return this.stepVertical(from, rows, target, -1);
      }
      case 'CtrlArrowLeft':
        return this.skim(from, decks, -1);
      case 'CtrlArrowRight':
        return this.skim(from, decks, +1);
      default:
        return from;
    }
  }

  /**
   * First focusable cell of a deck. Prefers the first interactive seat
   * (window/aisle/middle, any status except `unavailable`); falls back to
   * `{deckIdx, rowIdx: 0, colIdx: 0}` when nothing is interactive.
   */
  initialCell(deckIdx: number, decks: IDeckData[]): ICellPos {
    const fallback: ICellPos = { deckIdx, rowIdx: 0, colIdx: 0 };
    const deck = decks[deckIdx];
    if (!deck || !deck.rows) return fallback;

    for (let r = 0; r < deck.rows.length; r++) {
      const row = deck.rows[r];
      if (!row || !row.seats) continue;
      for (let c = 0; c < row.seats.length; c++) {
        if (this.isSeatInteractive(row.seats[c])) {
          return { deckIdx, rowIdx: r, colIdx: c };
        }
      }
    }

    return fallback;
  }

  /**
   * Whether the seat at the given position is "interactive" (a real
   * `seat`-type cell with a status the user can act on).
   */
  isInteractive(decks: IDeckData[], pos: ICellPos): boolean {
    const deck = decks[pos.deckIdx];
    if (!deck || !deck.rows) return false;
    const row = deck.rows[pos.rowIdx];
    if (!row || !row.seats) return false;
    const seat = row.seats[pos.colIdx];
    return this.isSeatInteractive(seat);
  }

  // ─── internals ─────────────────────────────────────────────────────────────

  /** Whether a cell is a real seat (any status) — the only arrow-key target. */
  private isSeatCell(seat: ISeatData | undefined): boolean {
    return !!seat && seat.type === 'seat';
  }

  /**
   * Move horizontally within a row to the next SEAT cell in `dir` (+1/-1),
   * skipping spacer cells. Returns `from` (referentially) if none exists.
   */
  private stepHorizontal(from: ICellPos, seats: ISeatData[], dir: 1 | -1): ICellPos {
    for (let c = from.colIdx + dir; c >= 0 && c < seats.length; c += dir) {
      if (this.isSeatCell(seats[c])) {
        return { deckIdx: from.deckIdx, rowIdx: from.rowIdx, colIdx: c };
      }
    }
    return from;
  }

  /**
   * Scan rows starting at `startRowIdx` in `dir` for the first seat-bearing
   * row, landing on the seat nearest `from.colIdx`. Skips seatless separator
   * rows. Returns `from` if no seat row is reachable (or if it resolves back
   * to the current cell).
   */
  private stepVertical(
    from: ICellPos,
    rows: IDeckData['rows'],
    startRowIdx: number,
    dir: 1 | -1,
  ): ICellPos {
    for (let r = startRowIdx; r >= 0 && r < rows.length; r += dir) {
      const seats = rows[r]?.seats;
      if (!seats) continue;
      const col = this.nearestSeatCol(seats, from.colIdx);
      if (col >= 0) {
        if (r === from.rowIdx && col === from.colIdx) return from;
        return { deckIdx: from.deckIdx, rowIdx: r, colIdx: col };
      }
    }
    return from;
  }

  /** Index of the first seat cell in a row, or -1. */
  private firstSeatCol(seats: ISeatData[]): number {
    for (let c = 0; c < seats.length; c++) {
      if (this.isSeatCell(seats[c])) return c;
    }
    return -1;
  }

  /** Index of the last seat cell in a row, or -1. */
  private lastSeatCol(seats: ISeatData[]): number {
    for (let c = seats.length - 1; c >= 0; c--) {
      if (this.isSeatCell(seats[c])) return c;
    }
    return -1;
  }

  /** Seat cell nearest to `desiredCol` (ties resolve to the left), or -1. */
  private nearestSeatCol(seats: ISeatData[], desiredCol: number): number {
    let best = -1;
    let bestDist = Infinity;
    for (let c = 0; c < seats.length; c++) {
      if (!this.isSeatCell(seats[c])) continue;
      const dist = Math.abs(c - desiredCol);
      if (dist < bestDist) {
        best = c;
        bestDist = dist;
      }
    }
    return best;
  }

  /** First seat cell of the deck (top-down), or null. */
  private firstSeatCellOfDeck(deckIdx: number, rows: IDeckData['rows']): ICellPos | null {
    for (let r = 0; r < rows.length; r++) {
      const seats = rows[r]?.seats;
      const col = seats ? this.firstSeatCol(seats) : -1;
      if (col >= 0) return { deckIdx, rowIdx: r, colIdx: col };
    }
    return null;
  }

  /** Last seat cell of the deck (bottom-up), or null. */
  private lastSeatCellOfDeck(deckIdx: number, rows: IDeckData['rows']): ICellPos | null {
    for (let r = rows.length - 1; r >= 0; r--) {
      const seats = rows[r]?.seats;
      const col = seats ? this.lastSeatCol(seats) : -1;
      if (col >= 0) return { deckIdx, rowIdx: r, colIdx: col };
    }
    return null;
  }

  /**
   * Skim within the current row toward `dir` (+1 or -1). Returns the next
   * interactive seat encountered. If no further interactive seat exists in
   * the requested direction, returns the LAST interactive cell encountered
   * during the scan (i.e. stays at the furthest interactive cell that the
   * scan reached). If the row contains no interactive cell at all in that
   * direction, returns `from` unchanged.
   */
  private skim(from: ICellPos, decks: IDeckData[], dir: 1 | -1): ICellPos {
    const deck = decks[from.deckIdx];
    if (!deck || !deck.rows) return from;
    const row = deck.rows[from.rowIdx];
    if (!row || !row.seats || row.seats.length === 0) return from;

    let lastInteractive: number | null = null;
    let c = from.colIdx + dir;
    while (c >= 0 && c < row.seats.length) {
      if (this.isSeatInteractive(row.seats[c])) {
        lastInteractive = c;
        // Stop at the FIRST interactive cell in the requested direction —
        // skim mode is "hop to the next playable seat".
        return { deckIdx: from.deckIdx, rowIdx: from.rowIdx, colIdx: c };
      }
      c += dir;
    }

    // No further interactive cell in this direction: stay where we are.
    // (The brief says "stop at the last interactive cell encountered" —
    //  since we encountered none beyond `from`, we don't move.)
    return lastInteractive === null
      ? from
      : { deckIdx: from.deckIdx, rowIdx: from.rowIdx, colIdx: lastInteractive };
  }

  private isSeatInteractive(seat: ISeatData | undefined): boolean {
    if (!seat) return false;
    if (seat.type !== 'seat') return false;
    return INTERACTIVE_STATUSES.has(seat.status);
  }
}
