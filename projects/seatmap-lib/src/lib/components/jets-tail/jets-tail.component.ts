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
  template: ` <div class="jets-tail" [style.width.px]="width" [innerHTML]="svgContent"></div> `,
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

  svgContent: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    const svg = this._buildTailSvg();
    this.svgContent = this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  private _buildTailSvg(): string {
    const t = this.colorTheme ?? {};
    const d = DEFAULT_COLOR_THEME;
    const hullColor = t.hullColor ?? d.fuselageFillColor;
    const outlineColor = t.fuselageStrokeColor ?? d.fuselageStrokeColor;
    const strokeWidth = 1.5;

    /* eslint-disable max-len */
    const scaleY = 0.71;
    const viewBoxHeight = Math.round(340 * scaleY);
    return `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 200 ${viewBoxHeight}">
<style type="text/css">
\t.tail-filling-straight{fill:none;stroke:${outlineColor};stroke-width:${strokeWidth};stroke-miterlimit:10;}
\t.tail-filling{fill:${hullColor};}
\t.tail-outline{fill:none;stroke:${outlineColor};stroke-width:${strokeWidth};stroke-miterlimit:10;}
\t.tail-dotted-line{fill:none;stroke:${outlineColor};stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:0.9808,5.8847;}
</style>
<g transform="scale(1, ${scaleY})">
<path class="tail-filling-straight" d="M1.5,0v17c0,0,13.1,132.9,33.1,193.1c5.5,16.5,37.5,128.3,65.1,128.3s59.6-111.9,65.1-128.3
\tC184.6,149.9,198.5,17,198.5,17V0"/>
<path class="tail-filling" d="M128.8,304.5l69.7,5V158.7c0,0-14.3,2.5-17-22.3"/>
<path class="tail-filling" d="M71.2,304.5l-69.7,5V158.7c0,0,13.8,2.4,16.5-22.4"/>
<path class="tail-filling" d="M197.1,10.9c0,0-34.7-9.2-46.9-9.3c-12.9-0.1-37.7,9.9-50.5,9.9c-13.3,0-38.8-10.2-52.1-10.1
\tC35.8,1.6,3.1,10.9,3.1,10.9L1.5,11v6c0,0,13.1,132.9,33.1,193.1c5.5,16.5,37.5,128.3,65.1,128.3s59.6-111.9,65.1-128.3
\tC184.6,149.9,198.5,17,198.5,17"/>
<path class="tail-outline" d="M71.2,304.5l-69.7,5V158.7c0,0,13.8,2.4,16.5-22.4"/>
<path class="tail-outline" d="M128.8,304.5l69.7,5V158.7c0,0-14.3,2.5-17-22.3"/>
<path class="tail-outline" d="M1.5,10.9V17c0,0,13.1,132.9,33.1,193.1c5.5,16.5,37.5,128.3,65.1,128.3s59.6-111.9,65.1-128.3
\tC184.6,149.9,198.5,17,198.5,17v-6.1"/>
<path class="tail-dotted-line" d="M5.9,10.1C6,10.1,6.2,10,6.3,10"/>
<path class="tail-dotted-line" d="M12,8.4c11-2.9,28.2-7,36.3-7c13.5,0,37.7,10.1,51.2,10.1c13.1,0,36.7-10.2,51.4-9.8c8.8,0.1,29.5,5,39.9,7.6"/>
<path class="tail-dotted-line" d="M193.6,10c0.2,0,0.3,0.1,0.5,0.1"/>
</g>
</svg>`;
    /* eslint-enable max-len */
  }
}
