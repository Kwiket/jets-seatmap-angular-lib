/**
 * Pure-logic service for 2D keyboard navigation across the seat grid.
 *
 * Implements the WAI-ARIA Authoring Practices "Layout Grid" pattern:
 *   - Arrow keys move focus one cell at a time in the corresponding axis.
 *   - Home / End jump to the first / last column of the current row.
 *   - Ctrl+Home / Ctrl+End jump to the first / last cell of the current deck.
 *   - PageUp / PageDown jump 5 rows (clamped to the deck boundaries).
 *   - Ctrl+Arrow{Left,Right} "skim" between interactive seats only.
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
      case 'ArrowLeft': {
        if (from.colIdx <= 0) return from;
        return { deckIdx: from.deckIdx, rowIdx: from.rowIdx, colIdx: from.colIdx - 1 };
      }
      case 'ArrowRight': {
        const lastCol = currentRow.seats.length - 1;
        if (from.colIdx >= lastCol) return from;
        return { deckIdx: from.deckIdx, rowIdx: from.rowIdx, colIdx: from.colIdx + 1 };
      }
      case 'ArrowUp': {
        if (from.rowIdx <= 0) return from;
        const targetRowIdx = from.rowIdx - 1;
        const targetCol = this.clampCol(rows, targetRowIdx, from.colIdx);
        return { deckIdx: from.deckIdx, rowIdx: targetRowIdx, colIdx: targetCol };
      }
      case 'ArrowDown': {
        if (from.rowIdx >= rows.length - 1) return from;
        const targetRowIdx = from.rowIdx + 1;
        const targetCol = this.clampCol(rows, targetRowIdx, from.colIdx);
        return { deckIdx: from.deckIdx, rowIdx: targetRowIdx, colIdx: targetCol };
      }
      case 'Home': {
        if (from.colIdx === 0) return from;
        return { deckIdx: from.deckIdx, rowIdx: from.rowIdx, colIdx: 0 };
      }
      case 'End': {
        const lastCol = currentRow.seats.length - 1;
        if (from.colIdx === lastCol) return from;
        return { deckIdx: from.deckIdx, rowIdx: from.rowIdx, colIdx: lastCol };
      }
      case 'CtrlHome': {
        if (from.rowIdx === 0 && from.colIdx === 0) return from;
        return { deckIdx: from.deckIdx, rowIdx: 0, colIdx: 0 };
      }
      case 'CtrlEnd': {
        const lastRowIdx = rows.length - 1;
        const lastRow = rows[lastRowIdx];
        const lastCol = lastRow && lastRow.seats ? Math.max(0, lastRow.seats.length - 1) : 0;
        if (from.rowIdx === lastRowIdx && from.colIdx === lastCol) return from;
        return { deckIdx: from.deckIdx, rowIdx: lastRowIdx, colIdx: lastCol };
      }
      case 'PageUp': {
        if (from.rowIdx === 0) return from;
        const targetRowIdx = Math.max(0, from.rowIdx - PAGE_STEP);
        const targetCol = this.clampCol(rows, targetRowIdx, from.colIdx);
        return { deckIdx: from.deckIdx, rowIdx: targetRowIdx, colIdx: targetCol };
      }
      case 'PageDown': {
        const lastRowIdx = rows.length - 1;
        if (from.rowIdx === lastRowIdx) return from;
        const targetRowIdx = Math.min(lastRowIdx, from.rowIdx + PAGE_STEP);
        const targetCol = this.clampCol(rows, targetRowIdx, from.colIdx);
        return { deckIdx: from.deckIdx, rowIdx: targetRowIdx, colIdx: targetCol };
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

  /** Clamp a desired colIdx to the valid range of `rows[rowIdx].seats`. */
  private clampCol(rows: IDeckData['rows'], rowIdx: number, desiredCol: number): number {
    const row = rows[rowIdx];
    if (!row || !row.seats || row.seats.length === 0) return 0;
    const lastCol = row.seats.length - 1;
    if (desiredCol < 0) return 0;
    if (desiredCol > lastCol) return lastCol;
    return desiredCol;
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
