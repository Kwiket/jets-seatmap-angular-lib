import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  Type,
} from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { ISeatData, IRowData, IColorTheme } from '../../types';
import { JetsSeatComponent } from '../jets-seat/jets-seat.component';

@Component({
  selector: 'sm-jets-row',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet, JetsSeatComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="jets-row"
      [class.jets-row--has-offset]="row.topOffset != null"
      [style.margin-top.px]="rowMarginTop"
    >
      <div class="jets-row__seats">
        @for (seat of row.seats; track seat.id) {
          @if (seatOverride) {
            <ng-container
              *ngComponentOutlet="
                seatOverride;
                inputs: {
                  data: seat,
                  colorTheme: colorTheme,
                  showPrice: showPrice,
                  currencyOverride: currencyOverride,
                  scale: scale,
                }
              "
            />
          } @else {
            <sm-jets-seat
              [data]="seat"
              [colorTheme]="colorTheme"
              [showPrice]="showPrice"
              [currencyOverride]="currencyOverride"
              [scale]="scale"
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
  @Input() prevRowTopOffset?: number;
  @Input() prevRowHeight = 0;
  @Input() scale = 1;
  /** Override component for the seat, propagated from componentOverrides.JetsSeat. */
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
