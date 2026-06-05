import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IColorTheme,
  IDeckData,
  IRowData,
  ISeatData,
  ISeatFeature,
  TLang,
} from '../../types';
import { LOCALES_MAP } from '../../constants';
import { computeSeatPosition, TSeatPosition } from '../../utils/a11y';

/**
 * Sort keys consumed by the `<select>` filter above the table. Matches the
 * <option value> attributes in the template.
 */
export type TSeatListSortKey = 'row' | 'priceAsc' | 'priceDesc';

/**
 * Internal shape: an `ISeatData` enriched with the row's display name / id
 * so the Row column can render a value without a second lookup. Kept as a
 * type alias rather than exporting a new public type — it never escapes
 * the list component.
 */
interface ISeatRow {
  seat: ISeatData;
  row: IRowData;
  rowName: string;
  position: TSeatPosition | null;
}

/**
 * Accessible alternative to the 2D seat grid. Renders all seats as a
 * semantic `<table>` with a `<fieldset>` of filter checkboxes and a sort
 * `<select>` above it.
 *
 * Outputs `seatSelected` / `seatUnselected` so the parent
 * `JetsSeatMapComponent` can reuse its existing tooltip handlers — which
 * also means LiveAnnouncer announcements fire for free.
 */
@Component({
  selector: 'sm-jets-seat-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './jets-seat-list.component.html',
  styleUrls: ['./jets-seat-list.component.scss'],
})
export class JetsSeatListComponent {
  @Input() content: IDeckData[] = [];
  @Input() lang: TLang = 'EN';
  @Input() colorTheme?: IColorTheme;
  @Input() showActions = true;
  @Input() isSelectAvailable = false;

  @Output() seatSelected = new EventEmitter<ISeatData>();
  @Output() seatUnselected = new EventEmitter<ISeatData>();

  // ─── Filter / sort state (driven by [(ngModel)] in the template) ────────
  filterWindow = false;
  filterAisle = false;
  filterExtraLegroom = false;
  filterExitRow = false;
  sortKey: TSeatListSortKey = 'row';

  // ─── Computed views ──────────────────────────────────────────────────────

  /** Flatten content → all real seats, tagged with parent row info. */
  get flatSeats(): ISeatRow[] {
    const result: ISeatRow[] = [];
    for (const deck of this.content || []) {
      for (const row of deck.rows || []) {
        const rowName = row.name ?? row.id ?? '';
        for (const seat of row.seats || []) {
          if (seat.type !== 'seat') continue;
          result.push({
            seat,
            row,
            rowName,
            position: computeSeatPosition(seat, row),
          });
        }
      }
    }
    return result;
  }

  /** Apply filter checkboxes then sort by the chosen key. */
  get filteredAndSortedSeats(): ISeatRow[] {
    const filtered = this.flatSeats.filter(entry => this._matchesFilters(entry));
    return this._sort(filtered);
  }

  // ─── Cell helpers ────────────────────────────────────────────────────────

  positionLabel(entry: ISeatRow): string {
    const loc = this._locale();
    switch (entry.position) {
      case 'window':
        return loc['seatPositionWindow'] || 'window';
      case 'aisle':
        return loc['seatPositionAisle'] || 'aisle';
      case 'middle':
        return loc['seatPositionMiddle'] || 'middle';
      default:
        return '—';
    }
  }

  /**
   * Comma-joined titles of amenity features (those with `value == null`).
   * Dimensions (`pitch` / `width` / `recline`) are intentionally excluded —
   * they live in their own column in tooltip view and would clutter the
   * Features cell here.
   */
  featuresLabel(seat: ISeatData): string {
    const loc = this._locale();
    const features: ISeatFeature[] = (seat.features || []).filter(f => f.value == null);
    if (!features.length) return '—';
    const titles = features
      .map(f => {
        if (f.key && loc[f.key]) return loc[f.key];
        return f.title ?? '';
      })
      .filter(t => t.length > 0);
    return titles.length ? titles.join(', ') : '—';
  }

  priceLabel(seat: ISeatData): string {
    const loc = this._locale();
    if (seat.price == null) return '—';
    if (seat.price === 0) return loc['free'] || 'free';
    const currency = (seat.currency ?? '').trim();
    return currency ? `${currency}${seat.price}` : String(seat.price);
  }

  statusLabel(seat: ISeatData): string {
    const loc = this._locale();
    switch (seat.status) {
      case 'available':
        return loc['available'] || 'Available';
      case 'unavailable':
        return loc['unavailable'] || 'Unavailable';
      case 'selected':
        return loc['selected'] || 'Selected';
      case 'preferred':
        return loc['preferred'] || 'Preferred';
      case 'extra':
        return loc['extra'] || 'Extra';
      case 'disabled':
        return loc['disabled'] || 'Disabled';
      default:
        return String(seat.status);
    }
  }

  // ─── Locale facades for the template ────────────────────────────────────

  get loc(): Record<string, string> {
    return this._locale();
  }

  /**
   * Filter checkbox labels. Falls back to English literals where the
   * locale key is missing. TODO(commit 17 docs): add dedicated locale keys
   * for 'filterWindow' / 'filterAisle' / 'filterExtraLegroom' / 'filterExitRow'
   * / 'sortBy' / 'sortByRow' / 'sortByPriceAsc' / 'sortByPriceDesc' /
   * 'filters' / 'showAsList'.
   */
  get filterWindowLabel(): string {
    return this.loc['filterWindow'] || this.loc['seatPositionWindow']?.replace(/^./, c => c.toUpperCase()) || 'Window';
  }

  get filterAisleLabel(): string {
    return this.loc['filterAisle'] || this.loc['seatPositionAisle']?.replace(/^./, c => c.toUpperCase()) || 'Aisle';
  }

  get filterExtraLegroomLabel(): string {
    return this.loc['filterExtraLegroom'] || this.loc['extra_legroom'] || 'Extra legroom';
  }

  get filterExitRowLabel(): string {
    return this.loc['filterExitRow'] || this.loc['exitRow'] || 'Exit row';
  }

  get sortLabel(): string {
    return this.loc['sortBy'] || 'Sort by';
  }

  get sortByRowLabel(): string {
    return this.loc['sortByRow'] || this.loc['row'] || 'Row';
  }

  get sortByPriceAscLabel(): string {
    return this.loc['sortByPriceAsc'] || `${this.loc['price'] || 'Price'} ↑`;
  }

  get sortByPriceDescLabel(): string {
    return this.loc['sortByPriceDesc'] || `${this.loc['price'] || 'Price'} ↓`;
  }

  get filtersLegend(): string {
    return this.loc['filters'] || 'Filters';
  }

  get tableCaption(): string {
    return this.loc['allSeats'] || 'All seats';
  }

  get selectLabel(): string {
    return this.loc['select'] || 'Select';
  }

  get unselectLabel(): string {
    return this.loc['unselect'] || 'Unselect';
  }

  // ─── Output emitters (template wiring) ───────────────────────────────────

  onSelectClick(seat: ISeatData): void {
    if (this._isSelectDisabled(seat)) return;
    this.seatSelected.emit(seat);
  }

  onUnselectClick(seat: ISeatData): void {
    this.seatUnselected.emit(seat);
  }

  /**
   * The Select button is disabled when there is no passenger queued AND the
   * seat does not already belong to one (i.e. the click would be a no-op).
   * Exposed publicly so the template can read it inside `[disabled]`.
   */
  isSelectDisabled(seat: ISeatData): boolean {
    return this._isSelectDisabled(seat);
  }

  trackByEntry(_: number, entry: ISeatRow): string {
    return entry.seat.id;
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  private _locale(): Record<string, string> {
    return LOCALES_MAP[this.lang] || LOCALES_MAP['EN'] || {};
  }

  private _matchesFilters(entry: ISeatRow): boolean {
    if (this.filterWindow && entry.position !== 'window') return false;
    if (this.filterAisle && entry.position !== 'aisle') return false;
    if (this.filterExtraLegroom && !this._hasExtraLegroom(entry.seat)) return false;
    if (this.filterExitRow && !this._hasExitRow(entry.seat)) return false;
    return true;
  }

  private _sort(entries: ISeatRow[]): ISeatRow[] {
    const copy = entries.slice();
    switch (this.sortKey) {
      case 'priceAsc':
        return copy.sort((a, b) => this._priceKey(a.seat) - this._priceKey(b.seat));
      case 'priceDesc':
        return copy.sort((a, b) => this._priceKey(b.seat) - this._priceKey(a.seat));
      case 'row':
      default:
        // Stable preserve the natural deck/row/seat order from `flatSeats`.
        return copy;
    }
  }

  private _priceKey(seat: ISeatData): number {
    // Treat missing prices as +Infinity so they sink to the bottom in
    // ascending order and to the top in descending (consistent UX).
    return seat.price != null ? seat.price : Number.POSITIVE_INFINITY;
  }

  private _hasExtraLegroom(seat: ISeatData): boolean {
    if (seat.status === 'extra') return true;
    return this._hasFeatureMatching(
      seat,
      f =>
        f.key === 'extra_legroom' ||
        f.key === 'extraLegroom' ||
        f.title === 'Extra legroom' ||
        f.title === 'extra_legroom'
    );
  }

  private _hasExitRow(seat: ISeatData): boolean {
    return this._hasFeatureMatching(seat, f => f.key === 'exitRow' || f.title === 'Exit row');
  }

  private _hasFeatureMatching(seat: ISeatData, predicate: (f: ISeatFeature) => boolean): boolean {
    const lists: Array<ISeatFeature[] | undefined> = [seat.features, seat.additionalProps, seat.measurements];
    for (const list of lists) {
      if (!list) continue;
      for (const feature of list) {
        if (predicate(feature)) return true;
      }
    }
    return false;
  }

  private _isSelectDisabled(seat: ISeatData): boolean {
    if (seat.passenger) return false;
    if (this.isSelectAvailable) return false;
    return true;
  }
}
