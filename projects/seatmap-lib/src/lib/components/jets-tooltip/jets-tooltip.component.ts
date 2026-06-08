import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, Output, Type } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { IColorTheme, IPassenger, ISeatData, ISeatFeature, ITooltipData } from '../../types';
import { LOCALES_MAP } from '../../constants';

@Component({
  selector: 'sm-jets-tooltip',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (viewOverride) {
      <ng-container
        *ngComponentOutlet="
          viewOverride;
          inputs: {
            data: data,
            isSelectAvailable: isSelectAvailable,
            showActions: showActions,
            showPrice: showPrice,
            colorTheme: colorTheme,
            sidePanel: sidePanel,
            rightToLeft: rightToLeft,
            hiddenSeatFeatures: hiddenSeatFeatures,
          }
        "
      />
    } @else {
      <div
        class="jets-tooltip"
        [class.jets-tooltip--below]="!sidePanel && data.openBelow"
        [class.jets-tooltip--side-panel]="sidePanel"
        [style.top.px]="sidePanel ? null : data.top"
        [style.--arrow-left]="sidePanel ? null : data.left + 'px'"
        [style.font-family]="colorTheme?.fontFamily || null"
        [style.--tooltip-bg]="colorTheme?.tooltipBackgroundColor || null"
        [style.--tooltip-border]="colorTheme?.tooltipBorderColor || null"
        [style.--tooltip-font]="colorTheme?.tooltipFontColor || null"
        [style.--tooltip-header]="colorTheme?.tooltipHeaderColor || null"
        [style.--tooltip-icon]="colorTheme?.tooltipIconColor || null"
        [style.--tooltip-icon-border]="colorTheme?.tooltipIconBorderColor || null"
        [style.--tooltip-icon-bg]="colorTheme?.tooltipIconBackgroundColor || null"
      >
        <div class="jets-tooltip--body">
          <div class="jets-tooltip--content">
            <!-- Header -->
            <div class="jets-tooltip--header" [style.direction]="textDirection">
              <div class="jets-tooltip--header-title">
                <span>{{ data.seat.name || data.seat.rowName || getClassType() }} {{ data.seat.number }}</span>
                @if (hasNumericPrice() && getNumericPrice() > 0) {
                  <span class="jets-tooltip--header-price"
                    >{{ resolvedCurrency }}{{ currencySeparator }}{{ getNumericPrice() }}</span
                  >
                }
                @if (getNumericPrice() === 0) {
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
              <div class="jets-tooltip--amenities" [style.direction]="textDirection">
                @for (amenity of amenities; track amenity.uniqId || amenity.key) {
                  <div class="jets-tooltip--amenity" [class.jets-tooltip--amenity-negative]="amenity.title === null">
                    <span class="jets-tooltip--amenity-icon" [innerHTML]="safeSvg(amenity.icon)"></span>
                    <span class="jets-tooltip--amenity-text">{{ amenity.title || amenity.value }}</span>
                  </div>
                }
              </div>
            }

            <!-- Seat dimensions (pitch / width / recline) -->
            @if (dimensions.length) {
              <div class="jets-tooltip--dimensions">
                @for (dim of dimensions; track dim.uniqId || dim.key) {
                  <div class="jets-tooltip--dimension">
                    <div class="jets-tooltip--dim-icon" [innerHTML]="safeSvg(dim.icon)"></div>
                    <div class="jets-tooltip--dim-label">{{ dim.title }}</div>
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
    }
  `,
  styleUrls: ['./jets-tooltip.component.scss'],
})
export class JetsTooltipComponent {
  private sanitizer = inject(DomSanitizer);

  /**
   * Optional override for the tooltip view (presentational layer). When provided,
   * the override component receives `data`, `isSelectAvailable`, `showActions`,
   * `showPrice`, `colorTheme`, `sidePanel` as inputs. Mirrors React's
   * componentOverrides.JetsTooltipView.
   */
  @Input() viewOverride?: Type<unknown> | null;

  @Input() data!: ITooltipData;
  @Input() isSelectAvailable = false;
  @Input() showPrice = false;
  @Input() colorTheme?: IColorTheme;
  @Input() sidePanel = false;
  @Input() showActions = true;
  @Input() rightToLeft = false;
  /**
   * Global currency override (from `config.currencySign`). When set, the
   * tooltip header shows this string instead of the per-seat `data.seat.currency`,
   * mirroring the behaviour of the per-seat price pill.
   */
  @Input() currencyOverride?: string;

  /** Config-level override wins over per-seat currency; falls back to the seat's own currency. */
  get resolvedCurrency(): string {
    if (this.currencyOverride != null && this.currencyOverride !== '') {
      return this.currencyOverride;
    }
    return this.data?.seat?.currency ?? '';
  }

  /**
   * Typographic rule for the header price: single-char currency glyphs
   * (`$`, `€`, `£`, `¥`) hug the digits, multi-char codes (`USD`, `EUR`)
   * keep a separating space.
   */
  get currencySeparator(): string {
    return this.resolvedCurrency.length > 1 ? ' ' : '';
  }

  /**
   * Feature keys (e.g. 'nearGalley', 'audioVideo') to omit from the tooltip's
   * amenities/dimensions lists. Mirrors React's `params.hiddenSeatFeatures`.
   */
  @Input() hiddenSeatFeatures: string[] = [];
  @Output() select = new EventEmitter<ISeatData>();
  @Output() unselect = new EventEmitter<ISeatData>();
  @Output() close = new EventEmitter<void>();

  get locale(): Record<string, string> {
    return LOCALES_MAP[this.data?.lang] || LOCALES_MAP['EN'];
  }

  get textDirection(): 'rtl' | 'ltr' {
    return this.rightToLeft ? 'rtl' : 'ltr';
  }

  /** Seat dimensions (pitch, width, recline) — comes pre-split from the preparer. */
  get dimensions(): ISeatFeature[] {
    return (this.data.seat.measurements || []).filter(f => !this.isFeatureHidden(f));
  }

  /**
   * Cap on the combined `features + additionalProps` list rendered in the
   * tooltip. Mirrors React's `DEFAULT_FEATURES_RENDER_LIMIT`
   * (`jets-seatmap-react-lib-pub/src/common/constants.js:123`).
   */
  private static readonly FEATURES_RENDER_LIMIT = 12;

  /**
   * Amenities (audioVideo, power, wifi, nearGalley, …) — comes pre-split from
   * the preparer. Integrator-defined `availability.additionalProps` are
   * appended after the API amenities, matching React's
   * `TooltipGlobal.js#finalListOfFeatures`. `hiddenSeatFeatures` filters API
   * features only — React does not apply it to additionalProps either.
   */
  get amenities(): ISeatFeature[] {
    const features = (this.data.seat.features ?? []).filter(f => !this.isFeatureHidden(f));
    const additional = this.data.seat.additionalProps ?? [];
    return [...features, ...additional].slice(0, JetsTooltipComponent.FEATURES_RENDER_LIMIT);
  }

  private isFeatureHidden(f: ISeatFeature): boolean {
    return !!f.key && this.hiddenSeatFeatures.includes(f.key);
  }

  /**
   * `ISeatData.price` is loose-typed (`number | string`) because the public
   * emit payload replaces it with a formatted string. Internally — inside the
   * built-in tooltip — only the numeric form is meaningful.
   */
  hasNumericPrice(): boolean {
    return typeof this.data?.seat?.price === 'number';
  }
  getNumericPrice(): number {
    const p = this.data?.seat?.price;
    return typeof p === 'number' ? p : NaN;
  }

  /** `icon` field already holds a full SVG string — wrap it for `[innerHTML]`. */
  safeSvg(svg: string | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg ?? '');
  }

  getClassType(): string {
    if (!this.data?.seat) return '';
    return this.data.seat.classType || 'Seat';
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
