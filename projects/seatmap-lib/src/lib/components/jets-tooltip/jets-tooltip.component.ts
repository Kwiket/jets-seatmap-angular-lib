import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  Output,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { IColorTheme, IPassenger, ISeatData, ISeatFeature, ITooltipData } from '../../types';
import {
  LOCALES_MAP,
  CLASS_CODE_MAP,
  SEAT_MEASUREMENTS_ICONS,
  SEAT_FEATURES_ICONS,
} from '../../constants';

@Component({
  selector: 'sm-jets-tooltip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="jets-tooltip"
      [class.jets-tooltip--below]="!sidePanel && data.openBelow"
      [class.jets-tooltip--side-panel]="sidePanel"
      [style.top.px]="sidePanel ? null : data.top"
      [style.--arrow-left]="sidePanel ? null : data.left + 'px'"
    >
      <div class="jets-tooltip--body">
        <div class="jets-tooltip--content">
          <!-- Header -->
          <div class="jets-tooltip--header">
            <div class="jets-tooltip--header-title">
              <span
                >{{ data.seat.name || data.seat.rowName || getClassType() }}
                {{ data.seat.number }}</span
              >
              @if (data.seat.price != null && data.seat.price > 0) {
                <span class="jets-tooltip--header-price"
                  >{{ data.seat.currency }} {{ data.seat.price }}</span
                >
              }
              @if (data.seat.price === 0) {
                <span class="jets-tooltip--header-price">Free</span>
              }
              @if (!sidePanel) {
                <button class="jets-tooltip--close-btn" (click)="close.emit()" aria-label="Close">
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <line
                      x1="1"
                      y1="1"
                      x2="11"
                      y2="11"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    />
                    <line
                      x1="11"
                      y1="1"
                      x2="1"
                      y2="11"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    />
                  </svg>
                </button>
              }
            </div>
            @if (data.seat.passenger?.passengerLabel) {
              <div class="jets-tooltip--header-passenger">
                {{ data.seat.passenger!.passengerLabel }}
              </div>
            }
          </div>

          <!-- Amenities list -->
          @if (amenities.length) {
            <div class="jets-tooltip--amenities">
              @for (amenity of amenities; track amenity.title) {
                <div
                  class="jets-tooltip--amenity"
                  [class.jets-tooltip--amenity-negative]="amenity.negative"
                >
                  <span
                    class="jets-tooltip--amenity-icon"
                    [innerHTML]="getAmenityIcon(amenity)"
                  ></span>
                  <span class="jets-tooltip--amenity-text">{{ amenity.title }}</span>
                </div>
              }
            </div>
          }

          <!-- Seat dimensions (pitch / width / recline) -->
          @if (dimensions.length) {
            <div class="jets-tooltip--dimensions">
              @for (dim of dimensions; track dim.title) {
                <div class="jets-tooltip--dimension">
                  <div class="jets-tooltip--dim-icon" [innerHTML]="getDimIcon(dim)"></div>
                  <div class="jets-tooltip--dim-label">{{ getDimLabel(dim) }}</div>
                  <div class="jets-tooltip--dim-value">{{ dim.value }}</div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Action buttons -->
        @if (showActions) {
          <div class="jets-tooltip--btns-block">
            <button
              class="jets-btn jets-tooltip--btn jets-cancel-btn"
              [style.color]="colorTheme?.tooltipCancelButtonTextColor || ''"
              [style.background-color]="colorTheme?.tooltipCancelButtonBackgroundColor || ''"
              (click)="close.emit()"
            >
              {{ locale['cancel'] }}
            </button>

            @if (data.seat.passenger) {
              <button
                class="jets-btn jets-tooltip--btn jets-select-btn"
                [style.color]="colorTheme?.tooltipSelectButtonTextColor || ''"
                [style.background-color]="colorTheme?.tooltipSelectButtonBackgroundColor || ''"
                (click)="unselect.emit(data.seat)"
              >
                {{ locale['unselect'] }}
              </button>
            } @else {
              <button
                class="jets-btn jets-tooltip--btn jets-select-btn"
                [style.color]="colorTheme?.tooltipSelectButtonTextColor || ''"
                [style.background-color]="colorTheme?.tooltipSelectButtonBackgroundColor || ''"
                [disabled]="isSelectDisabled()"
                (click)="select.emit(data.seat)"
              >
                {{ locale['select'] }}
              </button>
            }
          </div>
        }
      </div>
    </div>
  `,
  styleUrls: ['./jets-tooltip.component.scss'],
})
export class JetsTooltipComponent {
  private sanitizer = inject(DomSanitizer);

  @Input() data!: ITooltipData;
  @Input() isSelectAvailable = false;
  @Input() showPrice = false;
  @Input() colorTheme?: IColorTheme;
  @Input() sidePanel = false;
  @Input() showActions = true;
  @Output() select = new EventEmitter<ISeatData>();
  @Output() unselect = new EventEmitter<ISeatData>();
  @Output() close = new EventEmitter<void>();

  get locale(): Record<string, string> {
    return LOCALES_MAP[this.data?.lang] || LOCALES_MAP['EN'];
  }

  /** Features that have a numeric/text value (pitch, width, recline) */
  get dimensions(): ISeatFeature[] {
    return (this.data.seat.features || []).filter(f => f.value != null);
  }

  /** Features that are amenities (icon-based, no numeric value) */
  get amenities(): ISeatFeature[] {
    return (this.data.seat.features || []).filter(f => f.value == null);
  }

  getClassType(): string {
    if (!this.data?.seat) return '';
    return this.data.seat.classType || 'Seat';
  }

  getAmenityIcon(amenity: ISeatFeature): SafeHtml {
    const iconKey = amenity.icon || '';
    let svg: string;
    if (amenity.negative) {
      svg = SEAT_FEATURES_ICONS['-'] || '';
    } else if (SEAT_FEATURES_ICONS[iconKey]) {
      svg = SEAT_FEATURES_ICONS[iconKey];
    } else {
      // Default: green checkmark for positive features
      svg = SEAT_FEATURES_ICONS['+'] || '';
    }
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  getDimIcon(dim: ISeatFeature): SafeHtml {
    const key = dim.key || '';
    const svg = SEAT_MEASUREMENTS_ICONS[key] || '';
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  getDimLabel(dim: ISeatFeature): string {
    const loc = this.locale;
    if (dim.key) {
      return loc[dim.key + 'Short'] ?? loc[dim.key] ?? dim.title;
    }
    return dim.title ?? '';
  }

  isSelectDisabled(): boolean {
    if (!this.isSelectAvailable) return true;
    const nextPassenger = this.data.nextPassenger;
    const seat = this.data.seat;
    if (
      nextPassenger?.passengerType &&
      seat.passengerTypes?.length &&
      !seat.passengerTypes.includes(nextPassenger.passengerType)
    ) {
      return true;
    }
    return false;
  }
}
