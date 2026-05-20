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
  SEAT_STATUS_MAP,
  SEAT_TYPE_MAP,
  DEFAULT_COLOR_THEME,
  SEAT_SIZE_BY_TYPE,
  DEFAULT_SEAT_TYPE,
} from '../../constants';
import { seatTemplateService, ISeatStyle } from '../../services/seat-template.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'sm-jets-seat',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #seatEl
      [class]="seatClasses"
      [attr.data-seat-number]="data.number || null"
      [style.width.px]="seatWidth"
      [style.height.px]="seatHeight"
      [style.flex-shrink]="0"
      [style.transform]="seatTransform"
      (click)="onClick()"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
    >
      @if (data.type === 'seat') {
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
          [style.transform]="svgScaleTransform"
          [innerHTML]="svgContent"
        ></div>
        @if (showUnavailableCross) {
          <div
            class="jets-seat__cross"
            [class]="'jets-seat__cross ST-' + (data.seatIconType ?? 0)"
            [style.color]="unavailableCrossColor"
            [style.font-size.px]="labelFontSize"
            [style.transform]="counterRotation"
          >
            <svg viewBox="0 0 100 100" width="1.6em" height="1.6em">
              <line
                x1="22"
                y1="22"
                x2="78"
                y2="78"
                stroke="currentColor"
                stroke-width="9"
                stroke-linecap="round"
              />
              <line
                x1="78"
                y1="22"
                x2="22"
                y2="78"
                stroke="currentColor"
                stroke-width="9"
                stroke-linecap="round"
              />
            </svg>
          </div>
        }
        @if (data.passenger && !useSelectedStrokeMode) {
          <div
            class="jets-seat__passenger"
            [style.background-color]="passengerBadgeColor"
            [style.width.px]="badgeSize"
            [style.height.px]="badgeSize"
            [style.font-size.px]="badgeFontSize"
            [style.transform]="counterRotation"
            [style.border]="badgeBorder"
          >
            {{ data.passenger.abbr }}
          </div>
        }
      }
      <!-- aisle/empty: no content -->
    </div>
  `,
  styleUrls: ['./jets-seat.component.scss'],
})
export class JetsSeatComponent implements OnChanges {
  @Input() data!: ISeatData;
  @Input() colorTheme?: IColorTheme;
  /** @deprecated Price labels removed from render; kept for API compat. */
  @Input() showPrice = false;
  @Input() scale = 1;
  @Output() seatClick = new EventEmitter<{ seat: ISeatData; element: HTMLElement }>();
  @Output() seatMouseEnter = new EventEmitter<{ seat: ISeatData; element: HTMLElement }>();
  @Output() seatMouseLeave = new EventEmitter<{ seat: ISeatData; element: HTMLElement }>();

  @ViewChild('seatEl') seatEl!: ElementRef<HTMLElement>;

  svgContent: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    if (this.data?.type === SEAT_TYPE_MAP.seat) {
      const svg = this._buildSvg();
      this.svgContent = this.sanitizer.bypassSecurityTrustHtml(svg);
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
    if (this.data.type === SEAT_TYPE_MAP.aisle) return 1;
    if (this.data.type !== SEAT_TYPE_MAP.seat) return this.data.size;
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

  get badgeBorder(): string {
    return 'none';
  }

  get seatClasses(): string {
    // Rotation is applied via seatTransform (inline style) to avoid conflicts
    // with translate. CSS class rotation would be overridden by inline transform.
    return ['jets-seat', `jets-seat--${this.data.type}`, `jets-seat--${this.data.status}`]
      .filter(Boolean)
      .join(' ');
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
    if (this.data.type !== SEAT_TYPE_MAP.seat) return '';
    const sizeEntry = SEAT_SIZE_BY_TYPE[this.data.seatIconType ?? DEFAULT_SEAT_TYPE];
    if (!sizeEntry) return '';
    const [nw] = sizeEntry;
    if (nw <= 0) return '';
    const s = this.data.size / nw;
    return `scale(${s})`;
  }

  get seatTitle(): string {
    if (this.data.type !== SEAT_TYPE_MAP.seat) return '';
    return [
      this.data.number,
      this.data.price != null ? `${this.data.currency ?? ''} ${this.data.price}`.trim() : null,
    ]
      .filter(Boolean)
      .join(' — ');
  }

  formatPrice(): string {
    if (this.data.price == null) return '';
    const currency = this.data.currency ?? '';
    return currency ? `${currency} ${this.data.price}` : String(this.data.price);
  }

  onClick(): void {
    if (!this._isInteractive()) return;
    this.seatClick.emit({ seat: this.data, element: this.seatEl.nativeElement });
  }

  onMouseEnter(): void {
    if (!this._isInteractive()) return;
    this.seatMouseEnter.emit({ seat: this.data, element: this.seatEl.nativeElement });
  }

  onMouseLeave(): void {
    if (!this._isInteractive()) return;
    this.seatMouseLeave.emit({ seat: this.data, element: this.seatEl.nativeElement });
  }

  private _isInteractive(): boolean {
    return (
      this.data.type === SEAT_TYPE_MAP.seat &&
      (this.data.status === SEAT_STATUS_MAP.available ||
        this.data.status === SEAT_STATUS_MAP.selected ||
        this.data.status === SEAT_STATUS_MAP.preferred ||
        this.data.status === SEAT_STATUS_MAP.extra)
    );
  }

  private _buildSvg(): string {
    const style = this._resolveStyle();
    const classType = this.data.classType ?? 'E';
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
          const cleaned = attrs
            .replace(/\s*\bwidth="[^"]*"/, '')
            .replace(/\s*\bheight="[^"]*"/, '');
          return `<svg${cleaned} width="${nw}" height="${nh}">`;
        });
    }

    return svg;
  }

  private _resolveStyle(): ISeatStyle {
    const theme = this.colorTheme ?? {};
    const def = DEFAULT_COLOR_THEME;

    const force = theme.forceThemeSeatColors === true;

    let fillColor: string;
    switch (this.data.status) {
      case 'available':
        fillColor = force
          ? (theme.seatAvailableColor ?? def.seatAvailableColor)
          : (this.data.color ?? theme.seatAvailableColor ?? def.seatAvailableColor);
        break;
      case 'selected':
        fillColor = theme.seatSelectedStrokeColor
          ? force
            ? (theme.seatAvailableColor ?? def.seatAvailableColor)
            : (this.data.originalColor ??
              this.data.color ??
              theme.seatAvailableColor ??
              def.seatAvailableColor)
          : force
            ? (theme.seatSelectedColor ?? def.seatSelectedColor)
            : (this.data.originalColor ??
              this.data.color ??
              theme.seatAvailableColor ??
              def.seatAvailableColor);
        break;
      case 'preferred':
        fillColor = theme.seatPreferredColor ?? def.seatPreferredColor;
        break;
      case 'extra':
        fillColor = theme.seatExtraColor ?? def.seatExtraColor;
        break;
      default:
        fillColor = theme.seatUnavailableColor ?? def.seatUnavailableColor;
    }

    const uniformUnavailable =
      this.data.status === 'unavailable' && !!theme.seatUnavailableCrossColor;
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
      armrestColor: uniformUnavailable
        ? fillColor
        : (theme.seatArmrestColor ?? theme.armrestColor ?? def.armrestColor),
      backingColor: uniformUnavailable ? fillColor : (backing ?? 'rgb(169, 169, 169)'),
      shellColor: uniformUnavailable ? fillColor : (backing ?? 'rgb(235, 235, 235)'),
      backingStrokeColor: uniformUnavailable
        ? (crossColor ?? fillColor)
        : backing
          ? strokeColor
          : 'rgb(235, 235, 235)',
      backingStrokeWidth: selectedStroke ? 3 : uniformUnavailable ? 1.5 : 1.2,
    };
  }
}
