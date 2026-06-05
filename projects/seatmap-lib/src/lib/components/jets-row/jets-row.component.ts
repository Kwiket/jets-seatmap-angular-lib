import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, Type } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { ISeatData, IRowData, IColorTheme } from '../../types';
import { DEFAULT_LANG } from '../../constants';
import { JetsSeatComponent } from '../jets-seat/jets-seat.component';

@Component({
  selector: 'sm-jets-row',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet, JetsSeatComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'role': 'row',
    '[attr.aria-rowindex]': 'rowIndex ?? null',
  },
  template: `
    <div class="jets-row" [class.jets-row--has-offset]="row.topOffset != null" [style.margin-top.px]="rowMarginTop">
      <div class="jets-row__seats">
        @for (seat of row.seats; track seat.id; let i = $index) {
          @if (seatOverride) {
            <ng-container
              *ngComponentOutlet="
                seatOverride;
                inputs: {
                  data: seat,
                  colorTheme: colorTheme,
                  showPrice: showPrice,
                  currencyOverride: currencyOverride,
                  colorfulSeatsByClass: colorfulSeatsByClass,
                  scale: scale,
                  ariaLabel: ariaLabel,
                  ariaSelected: ariaSelected,
                  ariaDisabled: ariaDisabled,
                  rovingTabindex: rovingTabindex,
                  colIndex: i + 1,
                  rowIndex: rowIndex,
                  lang: lang,
                }
              "
            />
          } @else {
            <sm-jets-seat
              [data]="seat"
              [colorTheme]="colorTheme"
              [showPrice]="showPrice"
              [currencyOverride]="currencyOverride"
              [colorfulSeatsByClass]="colorfulSeatsByClass"
              [scale]="scale"
              [ariaLabel]="ariaLabel"
              [ariaSelected]="ariaSelected"
              [ariaDisabled]="ariaDisabled"
              [rovingTabindex]="rovingTabindex"
              [colIndex]="i + 1"
              [rowIndex]="rowIndex"
              [lang]="lang"
              (seatClick)="seatClick.emit($event)"
              (seatMouseEnter)="seatMouseEnter.emit($event)"
              (seatMouseLeave)="seatMouseLeave.emit($event)"
            />
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      .jets-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        width: 100%;
      }

      .jets-row__seats {
        display: flex;
        flex-direction: row;
        align-items: center;
        flex: 1;
        justify-content: center;
      }
    `,
  ],
})
export class JetsRowComponent {
  @Input() row!: IRowData;
  @Input() colorTheme?: IColorTheme;
  @Input() showPrice = false;
  @Input() currencyOverride?: string;
  @Input() colorfulSeatsByClass = false;
  @Input() prevRowTopOffset?: number;
  @Input() prevRowHeight = 0;
  @Input() scale = 1;
  /** Override component for the seat, propagated from componentOverrides.JetsSeat. */
  @Input() seatOverride?: Type<unknown> | null;

  // ─── A11y pass-throughs (WCAG commit 5) ─────────────────────────────
  // Plumbing for the grid scaffold (commit 6) and roving tabindex (commit 7).
  // The parent map (`jets-seat-map`) wires real values in commit 6; here we
  // simply forward whatever it provides down to the seat.
  @Input() ariaLabel?: string;
  @Input() ariaSelected?: boolean | null;
  @Input() ariaDisabled?: boolean;
  @Input() rovingTabindex?: number;
  /**
   * @deprecated colIndex is computed per-seat from the @for index (1-based) in commit 6.
   * The input is preserved for API stability but no longer flows through to seats.
   */
  @Input() colIndex?: number;
  /** 1-based row index for `aria-rowindex` (commit 6 grid scaffold). */
  @Input() rowIndex?: number;
  /** Language tag forwarded to seat for non-seat aria-labels (commit 6). */
  @Input() lang: string = DEFAULT_LANG;
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

  /**
   * Margin-top that positions this row so its top is at topOffset × scale
   * in the deck's coordinate space. Subtracts the previous row's rendered
   * height so accumulated flow heights don't push rows further down.
   */
  get rowMarginTop(): number | null {
    if (this.row.topOffset == null || this.prevRowTopOffset == null) return null;
    const diff = (this.row.topOffset - this.prevRowTopOffset) * this.scale;
    if (diff <= 0 && this.prevRowHeight <= 0) return null;
    return Math.round(diff - this.prevRowHeight);
  }
}
