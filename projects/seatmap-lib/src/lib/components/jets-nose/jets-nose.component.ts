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
  template: ` <div class="jets-nose" aria-hidden="true" [style.width.px]="width" [innerHTML]="svgContent"></div> `,
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

  svgContent: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    const style = this._resolveStyle();
    const svg = noseTemplateService.getNoseImage(this.noseType, style);
    this.svgContent = this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  private _resolveStyle(): INoseStyle {
    const t = this.colorTheme ?? {};
    const d = DEFAULT_COLOR_THEME;
    // Hull uses hullColor if provided; falls back to the DEFAULT light hull,
    // so that a dark fuselageFillColor (cabin floor) does NOT darken the nose.
    const hull = t.hullColor ?? d.fuselageFillColor;
    return {
      hullColor: hull,
      straightFillColor: hull,
      outlineColor: t.fuselageStrokeColor ?? d.fuselageStrokeColor,
      strokeWidth: 1.5,
      windowColor: t.fuselageWindowsColor ?? t.fuselageStrokeColor ?? d.fuselageStrokeColor,
    };
  }
}
