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
  template: ` <div class="jets-nose" aria-hidden="true" [style.width.px]="width" [style.transform]="noseTransform || null" [innerHTML]="svgContent"></div> `,
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

  /** In horizontal LTR the nose is flipped 180deg so it points the same way
   *  as the React reference. Mirrors React `Nose/index.js`:
   *  `isHorizontal && !rightToLeft ? 'rotate(180deg)' : ''`. */
  get noseTransform(): string {
    return this.horizontal && !this.rightToLeft ? 'rotate(180deg)' : '';
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
