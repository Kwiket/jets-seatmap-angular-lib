import { IDeckData, IRowData } from '../types';
import { SEAT_SIZE_BY_TYPE, DEFAULT_SEAT_TYPE, LOCALES_MAP, CLASS_CODE_MAP } from '../constants';

/**
 * Collect unique cabin classes from deck content.
 * Returns an array of { code, title } in order of appearance.
 */
export function getAvailableCabins(
  content: IDeckData[],
  lang: string,
): { code: string; title: string }[] {
  const seen = new Map<string, string>();
  for (const deck of content) {
    for (const row of deck.rows) {
      if (row.cabinClassCode && !seen.has(row.cabinClassCode)) {
        const locale = LOCALES_MAP[lang as keyof typeof LOCALES_MAP] || LOCALES_MAP['EN'];
        const title =
          row.cabinTitle ||
          locale[row.cabinClassCode as keyof typeof locale] ||
          CLASS_CODE_MAP[row.cabinClassCode as keyof typeof CLASS_CODE_MAP] ||
          row.cabinClassCode;
        seen.set(row.cabinClassCode, title);
      }
    }
  }
  return Array.from(seen.entries()).map(([code, title]) => ({ code, title }));
}

/** Native (unscaled) row height from SEAT_SIZE_BY_TYPE. */
export function getNativeRowHeight(row: IRowData): number {
  const seats = row.seats;
  if (!seats?.length) return 0;
  let maxH = 0;
  for (const s of seats) {
    if (s.type === 'aisle') continue;
    const entry = SEAT_SIZE_BY_TYPE[s.seatIconType ?? DEFAULT_SEAT_TYPE];
    const h = entry ? entry[1] : 100;
    if (h > maxH) maxH = h;
  }
  return maxH;
}

/**
 * Split a deck into per-cabin sub-decks with rebased coordinates.
 * Each sub-deck is self-contained: its rows start at topOffset ≈ 0,
 * and exits/bulkheads are filtered and rebased to match.
 */
export function getCabinSubDecks(
  deck: IDeckData,
): { title: string; cabinCode: string; subDeck: IDeckData }[] {
  const rows = deck.rows;
  if (!rows.length) return [];

  const groups: { title: string; code: string; startIdx: number; endIdx: number }[] = [];
  let curTitle = '';
  let curCode = '';
  let curStart = 0;

  for (let i = 0; i < rows.length; i++) {
    if (rows[i].cabinTitle) {
      if (curTitle) {
        groups.push({ title: curTitle, code: curCode, startIdx: curStart, endIdx: i });
      }
      curTitle = rows[i].cabinTitle!;
      curCode = rows[i].cabinClassCode ?? '';
      curStart = i;
    }
  }
  if (curTitle) {
    groups.push({ title: curTitle, code: curCode, startIdx: curStart, endIdx: rows.length });
  }

  if (groups.length === 0) {
    return [{ title: '', cabinCode: '', subDeck: deck }];
  }

  const deckFirstRowOffset = rows[0].topOffset ?? 0;

  return groups.map(g => {
    const cabinRows = rows.slice(g.startIdx, g.endIdx);
    const baseOffset = cabinRows[0].topOffset ?? 0;

    const rebasedRows: IRowData[] = cabinRows.map(r => ({
      ...r,
      topOffset: r.topOffset != null ? r.topOffset - baseOffset : r.topOffset,
    }));

    const lastRow = cabinRows[cabinRows.length - 1];
    const lastRowOffset = lastRow.topOffset ?? baseOffset;
    const lastRowH = getNativeRowHeight(lastRow);
    const rangeEnd = lastRowOffset + lastRowH;

    const cabinExits = (deck.extras?.exits ?? [])
      .filter(e => e.topOffset >= baseOffset - 50 && e.topOffset <= rangeEnd + 50)
      .map(e => ({ ...e, topOffset: e.topOffset - baseOffset }));

    const cabinBulks = (deck.extras?.bulks ?? [])
      .filter(b => {
        const bTop = b.topOffset ?? 0;
        return bTop >= baseOffset - 100 && bTop <= rangeEnd + 100;
      })
      .map(b => ({
        ...b,
        topOffset: b.topOffset != null ? b.topOffset - baseOffset : b.topOffset,
      }));

    let cabinWingsInfo = deck.extras?.wingsInfo;
    if (cabinWingsInfo && cabinWingsInfo.topOffset != null) {
      cabinWingsInfo = {
        ...cabinWingsInfo,
        topOffset: cabinWingsInfo.topOffset - (baseOffset - deckFirstRowOffset),
      };
    }

    return {
      title: g.title,
      cabinCode: g.code,
      subDeck: {
        ...deck,
        rows: rebasedRows,
        extras: {
          ...deck.extras,
          exits: cabinExits.length ? cabinExits : undefined,
          bulks: cabinBulks.length ? cabinBulks : undefined,
          wingsInfo: cabinWingsInfo,
        },
      },
    };
  });
}

/**
 * Filter a deck to only include rows of a specific cabin class,
 * with rebased coordinates and filtered exits/bulks/wings.
 * If the cabin class is not found, returns the deck unchanged.
 */
export function filterDeckByCabin(deck: IDeckData, cabinClass: string): IDeckData {
  const subDecks = getCabinSubDecks(deck);
  const match = subDecks.find(s => s.cabinCode.toUpperCase() === cabinClass.toUpperCase());
  return match ? match.subDeck : deck;
}

/**
 * Wing top-adjust for a cabin sub-deck (no deck title shown).
 */
export function getCabinSubDeckWingTopAdjust(subDeck: IDeckData): number {
  const scale = subDeck.scale ?? 1;
  let minOffset = 0;
  const extras = subDeck.extras;
  if (extras?.bulks) {
    for (const b of extras.bulks) {
      if (b.topOffset != null && b.topOffset < minOffset) minOffset = b.topOffset;
    }
  }
  if (extras?.exits) {
    for (const e of extras.exits) {
      if (e.topOffset != null && e.topOffset < minOffset) minOffset = e.topOffset;
    }
  }
  const absMin = minOffset < 0 ? -minOffset : 0;
  const deckTopPadding = (absMin + 120) * scale;
  return 4 + deckTopPadding;
}
