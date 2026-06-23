import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IColorTheme } from '../../types';
import { noseTemplateService, INoseStyle } from '../../services/nose-template.service';
import { DEFAULT_COLOR_THEME } from '../../constants';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'sm-jets-nose',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <div class="jets-nose" [style.width.px]="width" [style.transform]="noseTransform || null" [innerHTML]="svgContent"></div> `,
  styles: [
    `
      .jets-nose {
        display: block;
        line-height: 0;
        margin-bottom: -16px;
        position: relative;

        ::ng-deep svg {
          width: 100%;
          height: auto;
          display: block;
        }
      }
    `,
  ],
})
export class JetsNoseComponent implements OnChanges {
  @Input() noseType?: string;
  @Input() colorTheme?: IColorTheme;
  @Input() width = 200;
  /** Display scale (mirrors React's `params.scale`); pre-multiplies the SVG
   *  outline so the nose contour matches the CSS body border thickness. */
  @Input() displayScale = 1;
  /** Horizontal cabin layout (whole map is rotated 90deg by the parent). */
  @Input() horizontal = false;
  /** RTL flips the nose direction in horizontal mode (mirrors React). */
  @Input() rightToLeft = false;

  svgContent: SafeHtml = '';

  /** SVG viewBox width — every nose template uses 200. */
  private static readonly SVG_WIDTH = 200;
  /** The nose outline path starts 1.5 viewBox units inside the SVG border
   *  (`M1.5,…`). Combined with the stroke half-width that leaves the outline
   *  centre sitting `1.5 - strokeWidth/2` units short of the fuselage border
   *  centre, so the nose renders slightly narrower than the fuselage and a step
   *  shows at the join. Mirrors React `Nose/index.js` `distanceFromBorder`. */
  private static readonly OUTLINE_INSET = 1.5;

  /** Transform for the nose div:
   *  - `scale()` closes the nose↔fuselage join (outline-inset compensation);
   *  - `rotate(180deg)` in horizontal LTR so the nose points the React way. */
  get noseTransform(): string {
    const rotation = this.horizontal && !this.rightToLeft ? 'rotate(180deg)' : '';
    const scale = this._fuselageJoinScale();
    const scalePart = scale !== 1 ? `scale(${scale})` : '';
    return [rotation, scalePart].filter(Boolean).join(' ');
  }

  /**
   * Scale that pushes the nose outline out so its centre lines up with the
   * fuselage border centre. `effectiveInset` (in viewBox units) is the outline
   * inset minus the stroke half-width; scaling by `200/(200 - 2*inset)` moves
   * the outline out by `inset` units on each side.
   */
  private _fuselageJoinScale(): number {
    const svg = JetsNoseComponent.SVG_WIDTH;
    if (!this.width) return 1;
    const t = this.colorTheme ?? {};
    const themedStroke = (t.fuselageStrokeWidth ?? DEFAULT_COLOR_THEME.fuselageStrokeWidth) * this.displayScale;
    const strokeSvg = themedStroke / (this.width / svg);
    const effectiveInset = JetsNoseComponent.OUTLINE_INSET - strokeSvg * 0.5;
    if (effectiveInset <= 0) return 1;
    return svg / (svg - 2 * effectiveInset);
  }

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    const style = this._resolveStyle();
    const svg = noseTemplateService.getNoseImage(this.noseType, style);
    this.svgContent = this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  private _resolveStyle(): INoseStyle {
    const t = this.colorTheme ?? {};
    const d = DEFAULT_COLOR_THEME;
    const fill = t.fuselageFillColor ?? d.fuselageFillColor;
    const themedStroke = (t.fuselageStrokeWidth ?? d.fuselageStrokeWidth) * this.displayScale;
    return {
      hullColor: fill,
      straightFillColor: fill,
      outlineColor: t.fuselageStrokeColor ?? d.fuselageStrokeColor,
      strokeWidth: themedStroke / (this.width / 200),
      windowColor: t.fuselageWindowsColor ?? t.fuselageStrokeColor ?? d.fuselageStrokeColor,
    };
  }
}
