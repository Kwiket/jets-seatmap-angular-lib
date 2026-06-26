import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ISeatData, IColorTheme } from '../../types';
import {
  ENTITY_STATUS_MAP,
  ENTITY_TYPE_MAP,
  DEFAULT_COLOR_THEME,
  WCAG_COLOR_THEME,
  SEAT_SIZE_BY_TYPE,
  DEFAULT_SEAT_TYPE,
  LOCALES_MAP,
  DEFAULT_LANG,
} from '../../constants';
import { seatTemplateService, ISeatStyle } from '../../services/seat-template.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'sm-jets-seat',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data.type === 'seat') {
      <button
        #seatEl
        type="button"
        role="gridcell"
        [class]="seatClasses"
        [attr.data-seat-number]="data.number || null"
        [attr.aria-label]="ariaLabel || null"
        [attr.aria-selected]="ariaSelected === null || ariaSelected === undefined ? null : ariaSelected"
        [attr.aria-disabled]="ariaDisabled ? 'true' : null"
        [attr.aria-colindex]="colIndex ?? null"
        [attr.aria-rowindex]="rowIndex ?? null"
        [attr.tabindex]="effectiveTabindex"
        [style.width.px]="seatWidth"
        [style.height.px]="seatHeight"
        [style.flex-shrink]="0"
        [style.transform]="seatTransform"
        (click)="onClick($event)"
        (mouseenter)="onMouseEnter($event)"
        (mouseleave)="onMouseLeave($event)"
      >
        @if (!showUnavailableCross) {
          <div
            class="jets-seat__number"
            [class]="'jets-seat__number ST-' + (data.seatIconType ?? 0)"
            [style.font-size.px]="labelFontSize"
            [style.color]="seatLabelColor"
            [style.text-shadow]="seatLabelTextShadow"
            [style.transform]="counterRotation"
          >
            {{ seatLabel }}
          </div>
        }
        <div
          class="jets-seat__svg"
          aria-hidden="true"
          [style.transform]="svgScaleTransform"
          [innerHTML]="svgContent"
        ></div>
        @if (showUnavailableCross) {
          <div
            class="jets-seat__cross"
            aria-hidden="true"
            [class]="'jets-seat__cross ST-' + (data.seatIconType ?? 0)"
            [style.color]="unavailableCrossColor"
            [style.font-size.px]="labelFontSize"
            [style.transform]="counterRotation"
          >
            <svg viewBox="0 0 100 100" width="1.6em" height="1.6em">
              <line x1="22" y1="22" x2="78" y2="78" stroke="currentColor" stroke-width="9" stroke-linecap="round" />
              <line x1="78" y1="22" x2="22" y2="78" stroke="currentColor" stroke-width="9" stroke-linecap="round" />
            </svg>
          </div>
        }
        @if (data.passenger && !useSelectedStrokeMode) {
          <div
            class="jets-seat__passenger"
            aria-hidden="true"
            [style.background-color]="passengerBadgeColor"
            [style.color]="passengerBadgeLabelColor"
            [style.width.px]="badgeSize"
            [style.height.px]="badgeSize"
            [style.font-size.px]="badgeFontSize"
            [style.transform]="counterRotation"
            [style.border]="badgeBorder"
          >
            {{ data.passenger.abbr }}
          </div>
        }
        @if (showPriceLabel) {
          <div
            class="jets-seat__price"
            aria-hidden="true"
            [title]="priceTooltip"
            [style.--seat-scale]="scale"
            [style.max-width.px]="seatWidth"
            [style.transform]="counterRotation"
          >
            <strong class="currency">{{ currencySymbol }}</strong>
            <span class="priceValue">{{ data.price }}</span>
          </div>
        }
      </button>
    } @else {
      <div
        #seatEl
        role="gridcell"
        [class]="seatClasses"
        [attr.data-seat-number]="data.number || null"
        [attr.aria-label]="nonSeatAriaLabel"
        [attr.aria-colindex]="colIndex ?? null"
        [attr.aria-rowindex]="rowIndex ?? null"
        [attr.tabindex]="effectiveTabindex"
        [style.width.px]="seatWidth"
        [style.height.px]="seatHeight"
        [style.flex-shrink]="0"
        [style.transform]="seatTransform"
        (click)="onClick($event)"
        (mouseenter)="onMouseEnter($event)"
        (mouseleave)="onMouseLeave($event)"
      >
        <!-- aisle/empty/index: no interactive content -->
      </div>
    }
  `,
  styleUrls: ['./jets-seat.component.scss'],
})
export class JetsSeatComponent implements OnChanges {
  @Input() data!: ISeatData;
  @Input() colorTheme?: IColorTheme;
  /**
   * Toggle per-seat price overlay. Driven by `config.visibleSeatPriceLabels`
   * from the parent map; the label renders for available seats that have a
   * numeric `price`.
   */
  @Input() showPrice = false;
  /**
   * Global currency string from `config.currencySign`. When set, overrides
   * the per-seat `data.currency` at render time so the same map can be
   * forced to a single currency without mutating data.
   */
  @Input() currencyOverride?: string;
  @Input() scale = 1;

  // ─── A11y plumbing (WCAG commit 5) ──────────────────────────────────
  // Optional inputs the parent grid wires up in commit 6/7. Defaults are
  // chosen so they don't add attributes when unset, keeping the rendered
  // DOM noise-free for the common case.
  /** Accessible name announced by screen readers (e.g. "Seat 12C, Economy, $42"). */
  @Input() ariaLabel?: string;
  /** Tri-state aria-selected. `null`/`undefined` → attribute omitted. */
  @Input() ariaSelected?: boolean | null = null;
  /**
   * When true, renders `aria-disabled="true"` and suppresses click/mouse
   * emissions. We deliberately do NOT use the native `disabled` attribute
   * because it removes focusability, which would break the roving-tabindex
   * grid pattern landing in commits 6/7.
   */
  @Input() ariaDisabled?: boolean;
  /** Roving tabindex managed by the grid in commit 7. Defaults to 0 so a standalone seat stays focusable. */
  @Input() rovingTabindex?: number;
  /** aria-colindex (1-based). Plumbed here; the row/grid wires the real value in commit 6. */
  @Input() colIndex?: number;
  /** aria-rowindex (1-based). Same as above. */
  @Input() rowIndex?: number;
  /**
   * Language tag used to look up localised aria-labels for non-seat cells
   * (aisle / empty / index). Defaults to English; the parent grid propagates
   * the map-level `config.lang` in commit 6.
   */
  @Input() lang: string = DEFAULT_LANG;
  /**
   * When true, fall back to `WCAG_COLOR_THEME` for any colour key the
   * consumer didn't override via `colorTheme`. When false (default) we
   * use `DEFAULT_COLOR_THEME` (= LEGACY palette), preserving pre-WCAG
   * visuals. The parent maps this from `config.wcag.defaultColorTheme`.
   */
  @Input() wcagPalette = false;

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

  @ViewChild('seatEl') seatEl!: ElementRef<HTMLElement>;

  svgContent: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    if (this.data?.type === ENTITY_TYPE_MAP.seat) {
      const svg = this._buildSvg();
      this.svgContent = this.sanitizer.bypassSecurityTrustHtml(svg);
    }
  }

  /**
   * tabindex applied to the rendered root.
   *
   * Seat cells default to `0` so a standalone seat (rendered outside a grid)
   * stays focusable. When the parent grid wires `rovingTabindex` (commit 7),
   * exactly one focused seat keeps `0` and the rest get `-1`.
   *
   * Non-seat cells (aisle / empty / index) are always `-1`: they're reachable
   * via the grid's arrow-key navigation (commit 7) but never via Tab.
   */
  get effectiveTabindex(): number {
    if (this.data?.type === ENTITY_TYPE_MAP.seat) {
      return this.rovingTabindex ?? 0;
    }
    return -1;
  }

  /**
   * Accessible label for non-seat gridcells (aisle / empty / index).
   *
   * Falls back to English literals when the active locale doesn't define the
   * key — see TODO(commit 17 docs) to backfill `aisle` / `empty` for every
   * locale in LOCALES_MAP.
   *
   * For `index` cells we surface the row number (the cell exists purely as a
   * row label in the spatial layout); the type is currently unused by the
   * generator but plumbed through the type system, so we cover it for
   * completeness.
   */
  get nonSeatAriaLabel(): string | null {
    if (!this.data || this.data.type === ENTITY_TYPE_MAP.seat) return null;
    const loc = LOCALES_MAP[this.lang] ?? LOCALES_MAP[DEFAULT_LANG] ?? {};
    // TODO(commit 17 docs): add 'aisle' / 'empty' keys to all locales in LOCALES_MAP.
    switch (this.data.type) {
      case ENTITY_TYPE_MAP.aisle:
        return loc['aisle'] || 'aisle';
      case ENTITY_TYPE_MAP.empty:
        return loc['empty'] || 'empty';
      case ENTITY_TYPE_MAP.index: {
        const rowLabel = loc['row'] || 'Row';
        return this.data.number ? `${rowLabel} ${this.data.number}` : loc['index'] || rowLabel;
      }
      default:
        return null;
    }
  }

  /**
   * Seat width — proportional to native SEAT_SIZE_BY_TYPE width × deck scale.
   * Different seat types (suites, economy) render at proportionally different
   * widths, matching React's native-dimension approach.
   */
  get seatWidth(): number {
    return this.data.size;
  }

  /**
   * Seat height — native height × scale.
   * React sets size.height = SEAT_SIZE_BY_TYPE[type][1] (native, unscaled).
   * Angular pre-scales, so height = nativeH × scale.
   * Must NOT derive from width — width may be widened via Math.max(rowW, seatW).
   */
  get seatHeight(): number {
    if (this.data.type === ENTITY_TYPE_MAP.aisle) return 1;
    if (this.data.type !== ENTITY_TYPE_MAP.seat) return this.data.size;
    const sizeEntry = SEAT_SIZE_BY_TYPE[this.data.seatIconType ?? DEFAULT_SEAT_TYPE];
    if (!sizeEntry) return this.data.size;
    const [, h] = sizeEntry;
    return Math.round(h * this.scale);
  }

  /**
   * Label font size in px — matches React's 30px in unscaled coordinates.
   * React: font-size: 30px, then CSS transform: scale(deckScale) on parent.
   * Angular: pre-scaled, so 30 * scale.
   */
  get labelFontSize(): number {
    return Math.round(30 * this.scale);
  }

  /** Whether the per-seat price pill should render — matches React: any seat with a price when the flag is on. */
  get showPriceLabel(): boolean {
    return this.showPrice && this.data?.type === ENTITY_TYPE_MAP.seat && this.data.price != null;
  }

  /** First-character currency symbol (e.g. '€', '$'). Falls back to '*' like the React reference. */
  get currencySymbol(): string {
    const c = this.resolvedCurrency;
    return c ? c.toString().charAt(0) : '*';
  }

  /** Native tooltip / title — full "{currency}{price}" string. */
  get priceTooltip(): string {
    return `${this.resolvedCurrency}${this.data?.price ?? ''}`;
  }

  /** Config-level override wins over per-seat currency; empty string when neither is set. */
  get resolvedCurrency(): string {
    if (this.currencyOverride != null && this.currencyOverride !== '') {
      return this.currencyOverride;
    }
    return this.data?.currency ?? '';
  }

  get showUnavailableCross(): boolean {
    return this.data.status === 'unavailable' && !!this.colorTheme?.seatUnavailableCrossColor;
  }

  get unavailableCrossColor(): string {
    return this.colorTheme?.seatUnavailableCrossColor ?? '';
  }

  get useSelectedStrokeMode(): boolean {
    return this.data.status === 'selected' && !!this.colorTheme?.seatSelectedStrokeColor;
  }

  get seatLabel(): string {
    if (this.useSelectedStrokeMode && this.data.passenger) {
      return this.data.passenger.abbr ?? '';
    }
    return this.data.number ?? '';
  }

  get seatLabelColor(): string {
    if (this.useSelectedStrokeMode) {
      return this.colorTheme!.seatSelectedStrokeColor!;
    }
    return this.colorTheme?.seatLabelColor ?? DEFAULT_COLOR_THEME.seatLabelColor;
  }

  get seatLabelTextShadow(): string | null {
    return this.colorTheme?.seatLabelTextShadow ?? null;
  }

  get seatLabelColorResolved(): string {
    return this.colorTheme?.seatLabelColor ?? DEFAULT_COLOR_THEME.seatLabelColor;
  }

  get passengerBadgeColor(): string {
    return (
      this.data.passenger?.passengerColor ??
      this.colorTheme?.defaultPassengerBadgeColor ??
      DEFAULT_COLOR_THEME.defaultPassengerBadgeColor
    );
  }

  /** Badge diameter = 80% of seat width (React: PASSENGER_BADGE_SIZE_COEF = 0.8) */
  get badgeSize(): number {
    return Math.min(Math.round(this.data.size * 0.8), 192);
  }

  get badgeFontSize(): number {
    return Math.round(this.badgeSize * 0.28);
  }

  get passengerBadgeLabelColor(): string {
    return this.colorTheme?.defaultPassengerBadgeLabelColor ?? DEFAULT_COLOR_THEME.defaultPassengerBadgeLabelColor;
  }

  get badgeBorder(): string {
    const c = this.colorTheme?.defaultPassengerBadgeBorderColor;
    return c ? `1px solid ${c}` : 'none';
  }

  get seatClasses(): string {
    // Rotation is applied via seatTransform (inline style) to avoid conflicts
    // with translate. CSS class rotation would be overridden by inline transform.
    return ['jets-seat', `jets-seat--${this.data.type}`, `jets-seat--${this.data.status}`].filter(Boolean).join(' ');
  }

  /**
   * Combined CSS transform: translate (offset) + rotate + scale (for se/sw).
   * Must be a single inline transform because CSS classes and inline styles
   * would override each other.
   */
  get seatTransform(): string {
    const parts: string[] = [];

    const dx = Math.round((this.data.leftOffset ?? 0) * this.scale);
    const dy = Math.round((this.data.topOffset ?? 0) * this.scale);
    if (dx || dy) {
      parts.push(`translate(${dx}px, ${dy}px)`);
    }

    const { angleDeg, hasScale } = this._computeRotation();
    if (hasScale) parts.push('scale(0.8)');
    if (angleDeg) parts.push(`rotate(${angleDeg}deg)`);

    return parts.join(' ');
  }

  /** Counter-rotation for label/passenger so text stays readable inside rotated seat. */
  get counterRotation(): string {
    const { angleDeg } = this._computeRotation();
    return angleDeg ? `rotate(${-angleDeg}deg)` : '';
  }

  /** Compute rotation angle (degrees) and optional scale flag from rotation value. */
  private _computeRotation(): { angleDeg: number; hasScale: boolean } {
    let angleDeg = 0;
    let hasScale = false;

    switch (this.data.rotation) {
      case 'nw':
        angleDeg = -20;
        break;
      case 'nw45':
        angleDeg = -45;
        break;
      case 'ne':
        angleDeg = 20;
        break;
      case 'ne45':
        angleDeg = 45;
        break;
      case 's':
        angleDeg = 180;
        break;
      case 'se':
        angleDeg = 160;
        hasScale = true;
        break;
      case 'sw':
        angleDeg = -160;
        hasScale = true;
        break;
    }

    return { angleDeg, hasScale };
  }

  /**
   * CSS transform to scale SVG wrapper from native dims to pre-scaled container.
   * Matches React where SVGs render at native size and CSS transform scales the
   * entire seatmap. Angular pre-scales containers, so we scale per-seat here.
   */
  get svgScaleTransform(): string {
    if (this.data.type !== ENTITY_TYPE_MAP.seat) return '';
    const sizeEntry = SEAT_SIZE_BY_TYPE[this.data.seatIconType ?? DEFAULT_SEAT_TYPE];
    if (!sizeEntry) return '';
    const [nw] = sizeEntry;
    if (nw <= 0) return '';
    const s = this.data.size / nw;
    return `scale(${s})`;
  }

  get seatTitle(): string {
    if (this.data.type !== ENTITY_TYPE_MAP.seat) return '';
    return [this.data.number, this.data.price != null ? `${this.data.currency ?? ''} ${this.data.price}`.trim() : null]
      .filter(Boolean)
      .join(' — ');
  }

  formatPrice(): string {
    if (this.data.price == null) return '';
    const currency = this.data.currency ?? '';
    return currency ? `${currency} ${this.data.price}` : String(this.data.price);
  }

  onClick(event: Event): void {
    // aria-disabled gates the click because we deliberately render a native
    // <button> without the `disabled` attribute (see ariaDisabled docs above).
    if (this.ariaDisabled === true) return;
    if (!this._isInteractive()) return;
    this.seatClick.emit({ seat: this.data, element: this.seatEl.nativeElement, event });
  }

  onMouseEnter(event: Event): void {
    if (this.ariaDisabled === true) return;
    if (!this._isInteractive()) return;
    this.seatMouseEnter.emit({ seat: this.data, element: this.seatEl.nativeElement, event });
  }

  onMouseLeave(event: Event): void {
    if (this.ariaDisabled === true) return;
    if (!this._isInteractive()) return;
    this.seatMouseLeave.emit({ seat: this.data, element: this.seatEl.nativeElement, event });
  }

  private _isInteractive(): boolean {
    return (
      this.data.type === ENTITY_TYPE_MAP.seat &&
      (this.data.status === ENTITY_STATUS_MAP.available ||
        this.data.status === ENTITY_STATUS_MAP.selected ||
        this.data.status === ENTITY_STATUS_MAP.preferred ||
        this.data.status === ENTITY_STATUS_MAP.extra)
    );
  }

  private _buildSvg(): string {
    const classType = this.data.classType ?? 'E';
    const style = this._resolveStyle(classType);
    const iconType = this.data.seatIconType ?? DEFAULT_SEAT_TYPE;
    const seatKey = `${classType}-${iconType}`;
    let svg = seatTemplateService.getSeatIcon(seatKey, style);

    if (!svg) return '';

    // Set SVG width/height to native SEAT_SIZE_BY_TYPE dimensions.
    // React renders SVGs at native size (width/height from SEAT_SIZE_BY_TYPE)
    // inside a native-sized container, then CSS transform: scale() on the
    // seatmap wrapper scales everything down. Content (like armrests) can
    // overflow the container and remain visible.
    //
    // Angular pre-scales containers, so we set native dims on the SVG and
    // use CSS transform on the wrapper (.jets-seat__svg) to scale down.
    // This preserves overflow behavior matching React.
    const sizeEntry = SEAT_SIZE_BY_TYPE[iconType];
    if (sizeEntry) {
      const [nw, nh] = sizeEntry;
      // Strip existing width/height attributes on the <svg> element only
      svg = svg
        .replace(/<svg\s/, match => match) // no-op, just for clarity
        .replace(/<svg([^>]*)>/, (full, attrs) => {
          const cleaned = attrs.replace(/\s*\bwidth="[^"]*"/, '').replace(/\s*\bheight="[^"]*"/, '');
          return `<svg${cleaned} width="${nw}" height="${nh}">`;
        });
    }

    return svg;
  }

  private _resolveStyle(classType: string = this.data.classType ?? 'E'): ISeatStyle {
    const theme = this.colorTheme ?? {};
    const def = this.wcagPalette ? WCAG_COLOR_THEME : DEFAULT_COLOR_THEME;

    // Explicit theme.seatAvailableColor / seatSelectedColor outrank
    // API/score-injected per-seat colours, matching the precedence already
    // applied to the unavailable branch. The legacy `forceThemeSeatColors`
    // flag remains supported as a belt-and-braces alias.
    const force = theme.forceThemeSeatColors === true;
    const availOverride = theme.seatAvailableColor != null;
    const selOverride = theme.seatSelectedColor != null;

    let fillColor: string;
    switch (this.data.status) {
      case 'available': {
        const base =
          force || availOverride
            ? (theme.seatAvailableColor ?? def.seatAvailableColor)
            : (this.data.color ?? def.seatAvailableColor);
        fillColor = base;
        break;
      }
      case 'selected':
        fillColor = theme.seatSelectedStrokeColor
          ? force || availOverride
            ? (theme.seatAvailableColor ?? def.seatAvailableColor)
            : (this.data.originalColor ?? this.data.color ?? theme.seatAvailableColor ?? def.seatAvailableColor)
          : force || selOverride
            ? (theme.seatSelectedColor ?? def.seatSelectedColor)
            : (this.data.originalColor ?? this.data.color ?? theme.seatAvailableColor ?? def.seatAvailableColor);
        break;
      case 'preferred':
        fillColor = theme.seatPreferredColor ?? def.seatPreferredColor;
        break;
      case 'extra':
        fillColor = theme.seatExtraColor ?? def.seatExtraColor;
        break;
      default:
        // notAvailableSeatsColor is the documented public alias (README + demo
        // both use it). Honour it first; seatUnavailableColor stays as the
        // legacy fallback so existing consumers don't regress.
        fillColor = theme.notAvailableSeatsColor ?? theme.seatUnavailableColor ?? def.seatUnavailableColor;
    }

    const uniformUnavailable = this.data.status === 'unavailable' && !!theme.seatUnavailableCrossColor;
    const selectedStroke = this.data.status === 'selected' && theme.seatSelectedStrokeColor;

    const crossColor = theme.seatUnavailableCrossColor;
    const baseStrokeColor = theme.seatStrokeColor ?? def.seatStrokeColor;
    const strokeColor = selectedStroke
      ? theme.seatSelectedStrokeColor!
      : uniformUnavailable
        ? (crossColor ?? fillColor)
        : baseStrokeColor;
    const baseStrokeWidth = theme.seatStrokeWidth ?? def.seatStrokeWidth;
    const backing = theme.seatBackingColor;

    return {
      fillColor,
      strokeColor,
      strokeWidth: selectedStroke ? 3 : uniformUnavailable ? 1.5 : baseStrokeWidth,
      armrestColor: uniformUnavailable ? fillColor : (theme.seatArmrestColor ?? theme.armrestColor ?? def.armrestColor),
      backingColor: uniformUnavailable ? fillColor : (backing ?? 'rgb(169, 169, 169)'),
      shellColor: uniformUnavailable ? fillColor : (backing ?? 'rgb(235, 235, 235)'),
      backingStrokeColor: uniformUnavailable ? (crossColor ?? fillColor) : backing ? strokeColor : 'rgb(235, 235, 235)',
      backingStrokeWidth: selectedStroke ? 3 : uniformUnavailable ? 1.5 : 1.2,
    };
  }
}
