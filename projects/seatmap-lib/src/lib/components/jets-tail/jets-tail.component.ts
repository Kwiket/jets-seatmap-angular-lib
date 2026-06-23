import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IColorTheme } from '../../types';
import { DEFAULT_COLOR_THEME } from '../../constants';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Renders the aircraft tail section using a dedicated tail SVG
 * (distinct from the nose shape).
 */
@Component({
  selector: 'sm-jets-tail',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <div class="jets-tail" [style.width.px]="width" [style.transform]="tailTransform || null" [innerHTML]="svgContent"></div> `,
  styles: [
    `
      .jets-tail {
        display: block;
        line-height: 0;
        margin-top: -16px;

        ::ng-deep svg {
          width: 100%;
          height: auto;
          display: block;
        }
      }
    `,
  ],
})
export class JetsTailComponent implements OnChanges {
  @Input() colorTheme?: IColorTheme;
  @Input() width = 200;
  /** Display scale (mirrors React's `params.scale`); pre-multiplies the SVG
   *  outline so the tail contour matches the CSS body border thickness. */
  @Input() displayScale = 1;
  /** Horizontal cabin layout (whole map is rotated 90deg by the parent). */
  @Input() horizontal = false;
  /** RTL flips the tail direction in horizontal mode (mirrors React). */
  @Input() rightToLeft = false;

  svgContent: SafeHtml = '';

  /** SVG viewBox width — the tail template uses 200. */
  private static readonly SVG_WIDTH = 200;
  /** The tail outline meets the fuselage at viewBox x=1.5..198.5 (`…H1.5V0h197…`),
   *  i.e. inset 1.5 units inside the SVG border, so without compensation it
   *  renders slightly narrower than the fuselage and a step shows at the join.
   *  Mirrors React `Tail/index.js` `distanceFromBorder`. */
  private static readonly OUTLINE_INSET = 1.5;

  /** Transform for the tail div:
   *  - `scale()` closes the tail↔fuselage join (outline-inset compensation);
   *  - `rotate(180deg)` in horizontal LTR so the tail points the React way. */
  get tailTransform(): string {
    const rotation = this.horizontal && !this.rightToLeft ? 'rotate(180deg)' : '';
    const scale = this._fuselageJoinScale();
    const scalePart = scale !== 1 ? `scale(${scale})` : '';
    return [rotation, scalePart].filter(Boolean).join(' ');
  }

  /** Scale that lines the tail outline centre up with the fuselage border
   *  centre (outline inset minus the stroke half-width). See JetsNoseComponent. */
  private _fuselageJoinScale(): number {
    const svg = JetsTailComponent.SVG_WIDTH;
    if (!this.width) return 1;
    const t = this.colorTheme ?? {};
    const themedStroke = (t.fuselageStrokeWidth ?? DEFAULT_COLOR_THEME.fuselageStrokeWidth) * this.displayScale;
    const strokeSvg = themedStroke / (this.width / svg);
    const effectiveInset = JetsTailComponent.OUTLINE_INSET - strokeSvg * 0.5;
    if (effectiveInset <= 0) return 1;
    return svg / (svg - 2 * effectiveInset);
  }

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    const svg = this._buildTailSvg();
    this.svgContent = this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  private _buildTailSvg(): string {
    const t = this.colorTheme ?? {};
    const d = DEFAULT_COLOR_THEME;
    const fillColor = t.fuselageFillColor ?? d.fuselageFillColor;
    const outlineColor = t.fuselageStrokeColor ?? d.fuselageStrokeColor;
    // Stroke is themed in SVG units; mirrors React lib's
    // colorTheme.fuselageStrokeWidth / (innerWidth / SVG_WIDTH) scaling.
    // Pre-multiply by displayScale so visible thickness matches the CSS body
    // border (which also goes through displayScale).
    const themedStroke = (t.fuselageStrokeWidth ?? d.fuselageStrokeWidth) * this.displayScale;
    const strokeWidth = themedStroke / (this.width / 200);

    /* eslint-disable max-len */
    return `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 200 80">
<style type="text/css">
\t.tail-filling-straight{fill:${fillColor};stroke:${outlineColor};stroke-width:${strokeWidth};stroke-miterlimit:10;}
\t.tail-filling{fill:${fillColor};}
\t.tail-outline{fill:none;stroke:${outlineColor};stroke-width:${strokeWidth};stroke-miterlimit:10;}
\t.tail-dotted-line{fill:none;stroke:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:0.9808,5.8847;}
</style>
<path class="tail-filling-straight" d="M2.4,38.5c-0.6-3.5-0.9-7.1-0.9-10.7V0h197v27.4c0,3.8-0.3,7.6-1,11.4c-1.3,7.4-3.9,21.3-7.6,37.5H9.7
\tC6.1,59.8,3.6,45.8,2.4,38.5z"/>
<path class="tail-filling" fill-rule="evenodd" clip-rule="evenodd" d="M9.7,76.3C4.5,52.2,1.5,33.1,1.5,33.1V29H5c0.2,0,0.4-0.1,0.6-0.1c8.7-1.4,32.4-5.4,42-5.5
\tc6.7,0,16.4,3.8,26.1,7.7c9.7,3.8,19.3,7.7,26,7.7c6.4,0,15.7-3.8,25.1-7.6c9.5-3.9,18.9-7.7,25.4-7.7c10,0.1,35.2,4.1,44.2,5.5
\tl0.5,0.1h3.6v4.1c0,0-3.1,19-8.6,43.1H9.7z"/>
<path class="tail-dotted-line" d="M5,29c8.1-1.4,32.7-5.5,42.6-5.6c13.3-0.1,38.8,15.4,52.1,15.4c12.8,0,37.6-15.4,50.5-15.4c10.2,0.1,36.2,4.2,44.7,5.6"/>
<path class="tail-outline" d="M9.7,76.1h180.2"/>
<path class="tail-outline" d="M12.9,76.3H9.7C6.1,59.8,3.6,45.8,2.4,38.5c-0.6-3.5-0.9-7.1-0.9-10.7V0 M186.7,76.3h3.3c3.6-16.2,6.3-30.1,7.6-37.5
\tc0.7-3.8,1-7.5,1-11.4V0"/>
</svg>`;
    /* eslint-enable max-len */
  }
}
