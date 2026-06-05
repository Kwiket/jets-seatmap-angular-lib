import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IDeckData, ISeatData, IRowData, IColorTheme } from '../../types';
import { JetsRowComponent } from '../jets-row/jets-row.component';
import { JetsDeckExitComponent } from '../jets-deck-exit/jets-deck-exit.component';
import { JetsBulkComponent } from '../jets-bulk/jets-bulk.component';
import { DEFAULT_COLOR_THEME, LOCALES_MAP, SEAT_SIZE_BY_TYPE, DEFAULT_SEAT_TYPE } from '../../constants';

interface ICabinSection {
  title: string;
  top: number;
  height: number;
  color: string;
}

@Component({
  selector: 'sm-jets-deck',
  standalone: true,
  imports: [CommonModule, JetsRowComponent, JetsDeckExitComponent, JetsBulkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'role': 'grid',
    '[attr.aria-label]': 'gridAriaLabel',
    '[attr.aria-rowcount]': 'rowCount',
    '[attr.aria-colcount]': 'colCount',
  },
  template: `
    <div class="jets-deck" [style.padding-top.px]="deckHeightSpacingPx" [style.padding-bottom.px]="deckHeightSpacingPx">
      @if (deck.title && showNumber) {
        <div class="jets-deck__title" [style.color]="titleColor">
          {{ deck.title }}
        </div>
      } @else if (showNumber && deck.number != null) {
        <div class="jets-deck__title" [style.color]="titleColor">{{ deckLabel }}: {{ deck.number }}</div>
      }

      <div
        class="jets-deck__body"
        [style.padding-top.px]="deckTopPadding"
        [style.min-height.px]="deckBodyMinHeight"
        [style.--cabin-label-gap]="cabinLabelGap + 'px'"
      >
        <!-- Emergency exits -->
        @if (hasExits) {
          <sm-jets-deck-exit
            [exits]="deck.extras!.exits!"
            [colorTheme]="colorTheme"
            [scale]="scale"
            [topAdjust]="overlayTopOffset"
          />
        }

        <!-- Bulkheads / cargo -->
        @if (hasBulks) {
          <sm-jets-bulk
            [bulks]="deck.extras!.bulks!"
            [colorTheme]="colorTheme"
            [flatBulks]="flatBulks"
            [scale]="scale"
            [topAdjust]="overlayTopOffset"
          />
        }

        <!-- Wings: now rendered as sibling of deck-floor in jets-seatmap template (matches React) -->

        <!-- Cabin side labels (vertical text on fuselage walls) -->
        @if (visibleCabinTitles) {
          @for (section of cabinSections; track section.title + section.top) {
            <div
              class="jets-cabin-label jets-cabin-label--left"
              [style.top.px]="section.top + overlayTopOffset"
              [style.height.px]="section.height"
              [style.border-color]="section.color"
            >
              <span class="jets-cabin-label__text jets-cabin-label__text--left" [style.color]="labelColor">{{
                section.title
              }}</span>
            </div>
            <div
              class="jets-cabin-label jets-cabin-label--right"
              [style.top.px]="section.top + overlayTopOffset"
              [style.height.px]="section.height"
              [style.border-color]="section.color"
            >
              <span class="jets-cabin-label__text" [style.color]="labelColor">{{ section.title }}</span>
            </div>
          }
        }

        <!-- Rows -->
        @for (row of deck.rows; track row.id; let i = $index) {
          @if (horizontalCabinTitles && row.cabinTitle) {
            <div
              class="jets-cabin-section-title"
              [attr.data-cabin-code]="row.cabinClassCode"
              [style.color]="titleColor"
            >
              {{ row.cabinTitle }}
            </div>
          }
          <sm-jets-row
            [row]="row"
            [colorTheme]="colorTheme"
            [showPrice]="showPrice"
            [currencyOverride]="currencyOverride"
            [colorfulSeatsByClass]="colorfulSeatsByClass"
            [scale]="scale"
            [seatOverride]="seatOverride"
            [prevRowTopOffset]="i > 0 ? (deck.rows[i - 1].topOffset ?? 0) : 0"
            [prevRowHeight]="i > 0 ? _getRowHeight(deck.rows[i - 1]) : 0"
            [rowIndex]="i + 1"
            [lang]="lang"
            (seatClick)="seatClick.emit($event)"
            (seatMouseEnter)="seatMouseEnter.emit($event)"
            (seatMouseLeave)="seatMouseLeave.emit($event)"
          />
        }
      </div>
    </div>
  `,
  styles: [
    `
      .jets-deck {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        padding: 4px 0;
      }
      .jets-deck__title {
        font-size: 18px;
        font-weight: 700;
        color: #333;
        min-height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
      }
      .jets-deck__body {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
      }

      .jets-cabin-label {
        position: absolute;
        top: 0;
        width: 20px;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        pointer-events: none;
        border-width: 0;
        border-style: solid;
        opacity: 0.85;
        z-index: 5;
        padding-top: 6px;
      }

      .jets-cabin-label--left {
        right: calc(100% + 8px + var(--cabin-label-gap, 0px));
        border-right-width: 3px;
      }

      .jets-cabin-label--right {
        left: calc(100% + 8px + var(--cabin-label-gap, 0px));
        border-left-width: 3px;
      }

      .jets-cabin-label__text {
        writing-mode: vertical-rl;
        text-orientation: mixed;
        font-size: 16px;
        font-weight: 400;
        letter-spacing: 0.5px;
        white-space: nowrap;
        user-select: none;
      }

      .jets-cabin-label__text--left {
        transform: rotate(180deg);
      }

      .jets-cabin-section-title {
        width: 100%;
        text-align: center;
        font-size: 20px;
        font-weight: 700;
        padding: 20px 0 10px;
        z-index: 1;
        position: relative;
      }
    `,
  ],
})
export class JetsDeckComponent {
  @Input() deck!: IDeckData;
  @Input() lang = 'EN';
  @Input() showNumber = false;
  @Input() colorTheme?: IColorTheme;
  @Input() showPrice = false;
  @Input() currencyOverride?: string;
  @Input() flatBulks = false;
  @Input() colorfulSeatsByClass = false;
  @Input() bodyWidth = 350;
  @Input() fuselageWidth = 350;
  @Input() visibleCabinTitles = true;
  /** Show horizontal centered cabin class headers between sections */
  @Input() horizontalCabinTitles = false;
  /** Extra gap (px) to push cabin labels outward from deck-floor to fuselage edge */
  @Input() cabinLabelGap = 0;
  /** Override component for the seat, propagated to JetsRowComponent. */
  @Input() seatOverride?: Type<unknown> | null;
  @Output() seatClick = new EventEmitter<{
    seat: ISeatData;
    element: HTMLElement;
    event?: Event;
  }>();
  @Output() seatMouseEnter = new EventEmitter<{
    seat: ISeatData;
    element: HTMLElement;
    event?: Event;
  }>();
  @Output() seatMouseLeave = new EventEmitter<{
    seat: ISeatData;
    element: HTMLElement;
    event?: Event;
  }>();

  get deckLabel(): string {
    return LOCALES_MAP[this.lang]?.['deck'] ?? 'Deck';
  }

  /**
   * Accessible label for `role="grid"` host. Mirrors APG Layout Grid pattern.
   * Prefers the locale's `gridLabel` (commit 3) over an English fallback,
   * and surfaces the deck title / number so multi-deck planes are
   * distinguishable to AT.
   */
  get gridAriaLabel(): string {
    const loc = LOCALES_MAP[this.lang] ?? {};
    const base = loc['gridLabel'] || 'Seat map';
    const ctx = this.deck?.title || (this.deck?.number != null ? `${this.deckLabel} ${this.deck.number}` : '');
    return ctx ? `${base} — ${ctx}` : base;
  }

  /** 1-based row total (rows.length) for `aria-rowcount`. */
  get rowCount(): number {
    return this.deck?.rows?.length ?? 0;
  }

  /**
   * 1-based column count for `aria-colcount`: maximum seats-in-row across
   * every row, including aisle/empty cells so the geometry doesn't lie to AT
   * (Decisions log 2026-06-04 — full Layout Grid pattern).
   */
  get colCount(): number {
    const rows = this.deck?.rows ?? [];
    let max = 0;
    for (const r of rows) {
      const n = r.seats?.length ?? 0;
      if (n > max) max = n;
    }
    return max;
  }

  get hasExits(): boolean {
    return (this.deck.extras?.exits?.length ?? 0) > 0;
  }

  get hasBulks(): boolean {
    return (this.deck.extras?.bulks?.length ?? 0) > 0;
  }

  get labelColor(): string {
    return this.colorTheme?.cabinTitlesLabelColor || DEFAULT_COLOR_THEME.cabinTitlesLabelColor;
  }

  get titleColor(): string {
    // deckLabelTitleColor is the documented public alias (README + demo +
    // DEFAULT_COLOR_THEME); deckTitleColor stays as a legacy fallback so
    // existing consumers don't regress.
    return (
      this.colorTheme?.deckLabelTitleColor ??
      this.colorTheme?.deckTitleColor ??
      this.colorTheme?.seatmapFontColor ??
      '#333'
    );
  }

  get scale(): number {
    return this.deck.scale ?? 1;
  }

  // Opt-in: return null when unset so Angular skips the inline style and the
  // component CSS padding (4px 0) wins for consumers that don't theme the
  // value. Mirrors the wingsWidth precedent.
  get deckHeightSpacingPx(): number | null {
    const themed = this.colorTheme?.deckHeightSpacing;
    if (typeof themed === 'number' && themed > 0) {
      return Math.round(themed * this.scale);
    }
    return null;
  }

  /**
   * Top padding (px) on the deck body to create visual space between the
   * fuselage nose and the first content (exits / bulkheads / rows).
   *
   * Mirrors React's offset calculation:
   *   offset = |minNegativeTopOffset| + DEFAULT_INDEX_ROW_HEIGHT
   * where DEFAULT_INDEX_ROW_HEIGHT = 120 native units of breathing room.
   */
  get deckTopPadding(): number {
    // Find the minimum topOffset across all deck elements (bulks, exits).
    // React's _getFirstElementDeckOffset starts the reduce at 0, so only
    // negative values matter.
    let minOffset = 0;

    const extras = this.deck.extras;
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
    // 120 = DEFAULT_INDEX_ROW_HEIGHT from React reference
    const result = (absMin + 120) * this.scale;

    return result;
  }

  /**
   * Vertical offset (px) for absolutely-positioned overlays.
   * Equals the deck body top padding so absolute overlays stay aligned
   * with flow-positioned rows (which are pushed down by the padding).
   */
  get overlayTopOffset(): number {
    return this.deckTopPadding;
  }

  /**
   * Minimum height (px) for the deck body so the floor covers all
   * absolutely-positioned elements (bulkheads, exits).
   * Mirrors React's calculateDeckHeight which sets an explicit height
   * as max(lastSeatBottom, lastBulkBottom, lastExitBottom).
   */
  get deckBodyMinHeight(): number {
    const rows = this.deck.rows;
    if (!rows.length) return 0;

    const sc = this.scale;
    const padding = this.deckTopPadding;

    // Last row bottom
    const lastRow = rows[rows.length - 1];
    let maxBottom = (lastRow.topOffset ?? 0) * sc + padding + this._getRowHeight(lastRow);

    // Bulk bottoms
    const bulks = this.deck.extras?.bulks;
    if (bulks?.length) {
      for (const b of bulks) {
        const bottom = ((b.topOffset ?? 0) + (b.height ?? 150)) * sc + padding;
        if (bottom > maxBottom) maxBottom = bottom;
      }
    }

    // Exit bottoms (exits use translateY(-50%), so bottom ≈ topOffset + half exit size)
    const exits = this.deck.extras?.exits;
    if (exits?.length) {
      for (const e of exits) {
        const bottom = e.topOffset * sc + padding + 20;
        if (bottom > maxBottom) maxBottom = bottom;
      }
    }

    return maxBottom;
  }

  /**
   * Return the flex-layout height of a row in pixels.
   * Must match the seat component's seatHeight getter exactly:
   *   seat: Math.round(nativeH * scale)
   *   non-seat: s.size (square)
   *   aisle: excluded (1px, doesn't affect row height)
   */
  _getRowHeight(row: IRowData): number {
    const seats = row.seats;
    if (!seats?.length) return 0;
    const sc = this.scale;
    let maxH = 0;
    for (const s of seats) {
      if (s.type === 'aisle') continue;
      let h: number;
      if (s.type === 'seat') {
        const entry = SEAT_SIZE_BY_TYPE[s.seatIconType ?? DEFAULT_SEAT_TYPE];
        h = entry ? Math.round(entry[1] * sc) : s.size;
      } else {
        h = s.size;
      }
      if (h > maxH) maxH = h;
    }
    return maxH;
  }

  /**
   * Compute cabin sections from rows that have a cabinTitle.
   * Each section runs from that row's topOffset to the next cabin boundary.
   */
  get cabinSections(): ICabinSection[] {
    const rows = this.deck.rows;
    const sections: ICabinSection[] = [];
    const sc = this.scale;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.cabinTitle || row.topOffset == null) continue;

      const startOffset = row.topOffset;

      // Find the last row in this cabin (before next cabinTitle or end of rows)
      let lastCabinRow = row;
      for (let j = i + 1; j < rows.length; j++) {
        if (rows[j].cabinTitle) break;
        lastCabinRow = rows[j];
      }

      // Match React: height = lastRowTopOffset - firstRowTopOffset + lastRowHeight/2
      // React uses native (unscaled) row height from SEAT_SIZE_BY_TYPE, not pre-scaled size.
      // All values here are in native coordinates, then scaled at the end.
      const lastRowOffset = lastCabinRow.topOffset ?? startOffset;
      const lastRowNativeHeight = this._getNativeRowHeight(lastCabinRow);
      const rawHeight =
        lastCabinRow === row ? lastRowNativeHeight : lastRowOffset - startOffset + lastRowNativeHeight / 2;

      const height = Math.max(20, Math.round(rawHeight * sc));
      const top = Math.round(startOffset * sc);

      const cabinCode = row.cabinClassCode ?? this._cabinCodeFromTitle(row.cabinTitle);
      const highlightColors =
        this.colorTheme?.cabinTitlesHighlightColors ?? DEFAULT_COLOR_THEME.cabinTitlesHighlightColors;
      const color = highlightColors[cabinCode] ?? '#9e9e9e';

      sections.push({ title: row.cabinTitle, top, height, color });
    }

    return sections;
  }

  /**
   * Native (unscaled) row height — matches React's row.height = SEAT_SIZE_BY_TYPE[seatType][1].
   * Used for cabin section height calculation where all coordinates are native.
   */
  private _getNativeRowHeight(row: IRowData): number {
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

  private _cabinCodeFromTitle(title: string): string {
    const t = title.toLowerCase();
    if (t.startsWith('first')) return 'F';
    if (t.startsWith('business')) return 'B';
    if (t.startsWith('premium')) return 'P';
    return 'E';
  }
}
