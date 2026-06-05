import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  Output,
  Type,
  ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { IColorTheme, IPassenger, ISeatData, ISeatFeature, ITooltipData } from '../../types';
import { LOCALES_MAP, CLASS_CODE_MAP, SEAT_MEASUREMENTS_ICONS, SEAT_FEATURES_ICONS } from '../../constants';

/**
 * Structured "why is Select disabled" payload, surfaced to AT (3.3.1 Error
 * Identification, 3.3.3 Error Suggestion) and to host code that wants to
 * react programmatically (e.g. analytics on blocked attempts).
 *
 * - `disabled: false` — Select is actionable. `reason` and `message` are absent.
 * - `disabled: true, reason: 'noPassengerLeft'` — host has no `nextPassenger`
 *   to assign (or `isSelectAvailable` is false for the broader "nothing to
 *   put here" cases).
 * - `disabled: true, reason: 'passengerTypeRestricted'` — `seat.passengerTypes`
 *   excludes `nextPassenger.passengerType` (e.g. infant on an exit row).
 * - `disabled: true, reason: 'other'` — disabled for an unclassified reason.
 */
export interface ISelectDisabledReason {
  disabled: boolean;
  reason?: 'noPassengerLeft' | 'passengerTypeRestricted' | 'other';
  /** Localised, ready-to-display human-readable explanation. */
  message?: string;
}

/** Counter for per-instance unique DOM ids — avoids `Math.random()` so it's SSR-deterministic. */
let _selectReasonUid = 0;
/**
 * Separate counter for the dialog-related ids (header label / amenities or
 * dimensions description target). Kept distinct from `_selectReasonUid` so
 * the two streams of ids stay independently monotonic and easy to reason
 * about in DOM dumps. Same module-scope pattern as `nextSeatMapInstanceId`.
 */
let _tooltipDialogUid = 0;

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
        [attr.role]="sidePanel ? 'region' : 'dialog'"
        [attr.aria-labelledby]="headerTitleId"
        [attr.aria-describedby]="describedById ?? null"
        (keydown.escape)="onEscapeKey($event)"
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
                <span [id]="headerTitleId"
                  >{{ data.seat.name || data.seat.rowName || getClassType() }} {{ data.seat.number }}</span
                >
                @if (data.seat.price != null && data.seat.price > 0) {
                  <span class="jets-tooltip--header-price"
                    >{{ resolvedCurrency }}{{ currencySeparator }}{{ data.seat.price }}</span
                  >
                }
                @if (data.seat.price === 0) {
                  <span class="jets-tooltip--header-price">Free</span>
                }
                @if (!sidePanel) {
                  <button
                    class="jets-tooltip--close-btn"
                    (click)="close.emit()"
                    [attr.aria-label]="closeLabel"
                  >
                    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
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
              <div
                class="jets-tooltip--amenities"
                [id]="amenitiesId"
                [style.direction]="textDirection"
              >
                @for (amenity of amenities; track amenity.title) {
                  <div class="jets-tooltip--amenity" [class.jets-tooltip--amenity-negative]="amenity.negative">
                    <span
                      class="jets-tooltip--amenity-icon"
                      aria-hidden="true"
                      [innerHTML]="getAmenityIcon(amenity)"
                    ></span>
                    <span class="jets-tooltip--amenity-text">{{ amenity.title }}</span>
                  </div>
                }
              </div>
            }

            <!-- Seat dimensions (pitch / width / recline) -->
            @if (dimensions.length) {
              <div class="jets-tooltip--dimensions" [id]="dimensionsId">
                @for (dim of dimensions; track dim.title) {
                  <div class="jets-tooltip--dimension">
                    <div class="jets-tooltip--dim-icon" aria-hidden="true" [innerHTML]="getDimIcon(dim)"></div>
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
                  #primaryActionBtn
                  class="jets-btn jets-tooltip--btn jets-select-btn"
                  [style.color]="colorTheme?.tooltipSelectButtonTextColor || ''"
                  [style.background-color]="colorTheme?.tooltipSelectButtonBackgroundColor || ''"
                  (click)="unselect.emit(data.seat)"
                >
                  {{ locale['unselect'] }}
                </button>
              } @else {
                @let _reason = getSelectDisabledReason();
                <button
                  #primaryActionBtn
                  class="jets-btn jets-tooltip--btn jets-select-btn"
                  [class.jets-select-btn--aria-disabled]="_reason.disabled"
                  [style.color]="colorTheme?.tooltipSelectButtonTextColor || ''"
                  [style.background-color]="colorTheme?.tooltipSelectButtonBackgroundColor || ''"
                  [attr.aria-disabled]="_reason.disabled ? 'true' : null"
                  [attr.aria-describedby]="_reason.disabled && _reason.message ? selectReasonId : null"
                  (click)="onSelectClick(_reason)"
                >
                  {{ locale['select'] }}
                </button>
              }
            </div>
            @let _bottomReason = data.seat.passenger ? null : getSelectDisabledReason();
            @if (_bottomReason && _bottomReason.disabled && _bottomReason.message) {
              <p
                class="jets-tooltip--select-reason"
                [id]="selectReasonId"
                [style.direction]="textDirection"
              >
                {{ _bottomReason.message }}
              </p>
            }
          }
        </div>
      </div>
    }
  `,
  styleUrls: ['./jets-tooltip.component.scss'],
})
export class JetsTooltipComponent implements AfterViewInit {
  private sanitizer = inject(DomSanitizer);

  /**
   * Primary action button (Select when no passenger, Unselect when seat carries
   * one). Used by `ngAfterViewInit` to move keyboard focus into the dialog so
   * keyboard / AT users land on the most likely action (WCAG 2.4.3 Focus Order).
   * Optional because the actions block is gated behind `showActions` and we
   * must never throw when the host renders the tooltip without action buttons.
   */
  @ViewChild('primaryActionBtn') primaryActionBtnRef?: ElementRef<HTMLButtonElement>;

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
   * Feature keys (e.g. 'nearGalley', 'audioVideo') to omit from the tooltip's
   * amenities/dimensions lists. Mirrors React's `params.hiddenSeatFeatures`.
   */
  @Input() hiddenSeatFeatures: string[] = [];
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
  @Output() select = new EventEmitter<ISeatData>();
  @Output() unselect = new EventEmitter<ISeatData>();
  @Output() close = new EventEmitter<void>();
  /**
   * Fired when the user clicks the Select button while it is disabled (the
   * disabled state is rendered via `aria-disabled` so the click event still
   * reaches us — native `disabled` would swallow it). Host code (the seat
   * map's LiveAnnouncer, commit 9) consumes this to announce the reason via
   * a polite live-region so AT users hear *why* nothing happened.
   */
  @Output() selectAttemptBlocked = new EventEmitter<{
    seat: ISeatData;
    reason: NonNullable<ISelectDisabledReason['reason']>;
    message: string;
  }>();

  /** Stable per-instance id so multiple tooltips on a page don't collide. */
  readonly selectReasonId = `jets-tooltip-select-reason-${++_selectReasonUid}`;

  // ─── Dialog ARIA ids (commit 11) ───────────────────────────────────────
  // The non-sidePanel branch renders as `role="dialog"` (non-modal — see the
  // Decisions log entry 2026-06-04: the map is not overlaid, click-outside
  // closes the tooltip, so `aria-modal="true"` would lie about the contract).
  // The sidePanel branch is rendered inline in the page and uses `role="region"`
  // with the same `aria-labelledby` so AT users get a navigable landmark.
  /** Id of the visible seat label inside the header — target of `aria-labelledby`. */
  readonly _dialogUid = ++_tooltipDialogUid;
  readonly headerTitleId = `jets-tooltip-title-${this._dialogUid}`;
  readonly amenitiesId = `jets-tooltip-amenities-${this._dialogUid}`;
  readonly dimensionsId = `jets-tooltip-dimensions-${this._dialogUid}`;

  /**
   * `aria-describedby` target chosen from whichever descriptive block is
   * actually rendered. Prefers amenities (richer content) and falls back to
   * dimensions; returns `null` when neither is present so we don't dangle a
   * pointer to a missing id (some screen readers warn about that).
   */
  get describedById(): string | null {
    if (this.amenities.length) return this.amenitiesId;
    if (this.dimensions.length) return this.dimensionsId;
    return null;
  }

  /**
   * Localised label for the header close (×) button. Falls back to the English
   * `'Close'` when the active locale is missing the `close` key.
   *
   * TODO(commit 17 docs): if any locale ever drops the `close` key, document
   * the fallback policy here. (constants.ts is owned by another commit — we
   * never edit it from here; the inline English fallback is the safety net.)
   */
  get closeLabel(): string {
    return LOCALES_MAP[this.data?.lang]?.['close'] || 'Close';
  }

  get locale(): Record<string, string> {
    return LOCALES_MAP[this.data?.lang] || LOCALES_MAP['EN'];
  }

  get textDirection(): 'rtl' | 'ltr' {
    return this.rightToLeft ? 'rtl' : 'ltr';
  }

  /** Features that have a numeric/text value (pitch, width, recline) */
  get dimensions(): ISeatFeature[] {
    return (this.data.seat.features || []).filter(f => f.value != null && !this.isFeatureHidden(f));
  }

  /** Features that are amenities (icon-based, no numeric value) */
  get amenities(): ISeatFeature[] {
    return (this.data.seat.features || []).filter(f => f.value == null && !this.isFeatureHidden(f));
  }

  private isFeatureHidden(f: ISeatFeature): boolean {
    return !!f.key && this.hiddenSeatFeatures.includes(f.key);
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

  /**
   * Boolean facade preserved for backwards compatibility: existing templates
   * and `componentOverrides.JetsTooltip` consumers may still call this from
   * their overrides as `[disabled]="isSelectDisabled()"`. New code (and our
   * own template) reads `getSelectDisabledReason()` for the structured shape.
   */
  isSelectDisabled(): boolean {
    return this.getSelectDisabledReason().disabled;
  }

  /**
   * Structured "why disabled" — see {@link ISelectDisabledReason}. Used by
   * the template to render a visible reason under the Select button and to
   * tie it via `aria-describedby` (WCAG 3.3.1 / 3.3.3).
   */
  getSelectDisabledReason(): ISelectDisabledReason {
    const seat = this.data?.seat;
    const nextPassenger = this.data?.nextPassenger;

    // Passenger-type restriction takes priority: even if isSelectAvailable
    // happens to be false alongside, the actionable explanation for the user
    // is "wrong passenger type", not "queue empty".
    if (
      nextPassenger?.passengerType &&
      seat?.passengerTypes?.length &&
      !seat.passengerTypes.includes(nextPassenger.passengerType)
    ) {
      return {
        disabled: true,
        reason: 'passengerTypeRestricted',
        message: this.buildRestrictedPassengerTypeMessage(nextPassenger),
      };
    }

    if (!this.isSelectAvailable) {
      return {
        disabled: true,
        reason: 'noPassengerLeft',
        message: this.buildNoPassengerLeftMessage(),
      };
    }

    return { disabled: false };
  }

  /**
   * Click handler for the Select button. Because the button is rendered with
   * `aria-disabled` (not native `disabled`) so AT can still focus it and the
   * click event still fires, we gate the actual `select.emit()` here and, on
   * a blocked click, emit `selectAttemptBlocked` for the host's LiveAnnouncer.
   */
  onSelectClick(reason: ISelectDisabledReason): void {
    if (reason.disabled) {
      if (reason.reason && reason.message) {
        this.selectAttemptBlocked.emit({
          seat: this.data.seat,
          reason: reason.reason,
          message: reason.message,
        });
      }
      return;
    }
    this.select.emit(this.data.seat);
  }

  /**
   * Builds the localised "not available for {passengerType}" sentence.
   *
   * TODO(commit 17 docs): add 'tooltipSelectRestrictedPassengerType' key
   * across all locales so the message body is fully localisable as one
   * unit (currently we glue locale fragments + English fallback).
   */
  private buildRestrictedPassengerTypeMessage(nextPassenger: IPassenger): string {
    const loc = this.locale;
    // Prefer the human label the host provided (e.g. "Infant"), then the
    // localised passenger-type abbreviation (loc['INF']), then the raw code.
    const passengerLabel =
      nextPassenger.passengerLabel?.trim() ||
      (nextPassenger.passengerType ? loc[nextPassenger.passengerType] : '') ||
      nextPassenger.passengerType ||
      'this passenger';
    // `seatRestrictedFor` is present in every locale (commit 3). English
    // fallback is structurally identical so we never produce broken text.
    const prefix = loc['seatRestrictedFor'] || 'not available for';
    // Sentence case + period: "Not available for infant passengers."
    const sentence = `${prefix} ${passengerLabel}`;
    return this.capitaliseFirst(sentence) + '.';
  }

  /**
   * Builds the localised "no passenger left to seat" sentence. There is no
   * existing locale key for this — leave a TODO so commit 17/docs can add a
   * dedicated key across all locales. For now use an English fallback so the
   * AT user still gets a meaningful explanation.
   *
   * TODO(commit 17 docs): add 'tooltipSelectNoPassengerLeft' key across all
   * locales (constants.ts is owned by commit 4 in parallel — do not touch).
   */
  private buildNoPassengerLeftMessage(): string {
    // English fallback only — no locale key yet. Document the gap above.
    return 'No passenger available to assign to this seat.';
  }

  private capitaliseFirst(s: string): string {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /**
   * On view init, drop keyboard focus on the primary action button so
   * keyboard / AT users land directly on the most likely next action
   * (WCAG 2.4.3 Focus Order). Skipped in `sidePanel` mode — that branch
   * is an inline page region, not a dialog, so auto-focus would steal
   * the cursor mid-scroll. `setTimeout(0)` defers past the current change
   * detection tick so the button is actually painted; `preventScroll`
   * stops the page from jumping when the tooltip is below the fold.
   */
  ngAfterViewInit(): void {
    if (this.sidePanel) return;
    setTimeout(() => {
      try {
        this.primaryActionBtnRef?.nativeElement?.focus({ preventScroll: true });
      } catch {
        /* no-op: jsdom and old browsers may throw on focus options */
      }
    }, 0);
  }

  /**
   * Escape inside the tooltip closes it and stops propagation so the
   * surrounding seat-map's global Escape handler doesn't also fire. This
   * is the in-dialog dismiss path; the seat-map keeps its own handler as
   * a safety net for keyboards that don't deliver the event to the
   * tooltip (e.g. focus parked back on the trigger seat).
   */
  onEscapeKey(event: Event): void {
    this.close.emit();
    event.stopPropagation();
  }
}
