import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IBulkData, IColorTheme } from '../../types';
import { DEFAULT_COLOR_THEME } from '../../constants';
import {
  bulkTemplateService,
  BULK_SCALE_BY_ID,
  DEFAULT_BULK_SCALE,
  IBulkStyle,
} from '../../services/bulk-template.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface IBulkView {
  html: SafeHtml;
  stickerHtml: SafeHtml | null;
  bulk: IBulkData;
  top: string;
  left: string;
  right: string;
  width: string;
  height: string;
  transform: string;
  fontSize: string;
  stickerClass: string;
  stickerWrapperHeight: string;
  alignClass: 'left' | 'right' | 'center';
}

/**
 * Ratio of bulk-base path height to viewBox height for each bulk template.
 * Used to calculate sticker wrapper height matching React's DOM-measured approach.
 * React: wrapperH = containerH - renderedBaseH * DEFAULT_SCALE_BULK_COEFF
 * baseRatio = (viewBoxH - baseStartY) / viewBoxH
 */
const BULK_BASE_RATIO: Record<string, number> = {
  '1': 115 / 119,
  '2': 88.5 / 93,
  '3': 119.5 / 133,
  '4': 111.5 / 116,
  '5': 124 / 210,
  '6': 124 / 255,
  '7': 123 / 254,
  '8': 124 / 290,
  '9': 123 / 328,
  '10': 124 / 329,
  '11': 124 / 329,
  '12': 124 / 371,
  '13': 124 / 371,
  '14': 122 / 450,
  '15': 124 / 527,
  '16': 40 / 106,
  '17': 46.2 / 91,
  '18': 126 / 126,
  '19': 76 / 172,
  '20': 109 / 197,
  '21': 122 / 235,
  '22': 177 / 322,
  '23': 157 / 357,
  '24': 137 / 437,
  '25': 162 / 512,
};

@Component({
  selector: 'sm-jets-bulk',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    @for (item of views; track $index) {
      <div
        class="jets-bulk"
        [style.top]="item.top"
        [style.left]="item.left"
        [style.right]="item.right"
        [style.width]="item.width"
        [style.height]="item.height"
        [style.transform]="item.transform"
        [style.font-size]="item.fontSize"
      >
        <div class="jets-bulk__icon" [innerHTML]="item.html"></div>
        @if (item.stickerHtml) {
          <div class="jets-bulk__sticker-wrap" [style.height]="item.stickerWrapperHeight">
            <div [class]="'jets-bulk__sticker ' + item.stickerClass" [innerHTML]="item.stickerHtml"></div>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .jets-bulk {
        position: absolute;
        overflow: hidden;
      }

      .jets-bulk__icon {
        display: block;
        width: 100%;
        height: 100%;
      }

      .jets-bulk__icon ::ng-deep svg {
        display: block;
        width: 100%;
        height: 100%;
      }

      .jets-bulk__sticker-wrap {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        pointer-events: none;
      }

      .jets-bulk__sticker {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      .jets-bulk__sticker--album {
        width: 4em;
        height: 2em;
      }

      .jets-bulk__sticker--portrait {
        width: 2em;
        height: 4em;
      }

      .jets-bulk__sticker ::ng-deep svg {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class JetsBulkComponent implements OnChanges {
  @Input() bulks: IBulkData[] = [];
  @Input() colorTheme?: IColorTheme;
  /**
   * When true, paints both SVG halves of every bulk with `bulkCutColor`,
   * collapsing the pseudo-3D base/cut split into a single uniform fill.
   * The outer contour is preserved.
   */
  @Input() flatBulks = false;
  @Input() scale = 1;
  /** Extra vertical offset in px to align absolute positioning with flow-positioned rows. */
  @Input() topAdjust = 0;

  views: IBulkView[] = [];

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    const bulkStyle = this._resolveBulkStyle();
    this.views = this.bulks.map(bulk => this._buildView(bulk, bulkStyle)).filter((v): v is IBulkView => v !== null);
  }

  private _buildView(bulk: IBulkData, bulkStyle: IBulkStyle): IBulkView | null {
    const svg = bulkTemplateService.getBulkIcon(bulk.id, bulkStyle);
    if (!svg) return null;

    const html = this.sanitizer.bypassSecurityTrustHtml(svg);

    // Sticker overlay
    let stickerHtml: SafeHtml | null = null;
    if (bulk.stickerType) {
      const stickerSvg = bulkTemplateService.getStickerIcon(bulk.stickerType, bulkStyle.stickerColor);
      if (stickerSvg) {
        stickerHtml = this.sanitizer.bypassSecurityTrustHtml(stickerSvg);
      }
    }

    const idStr = String(bulk.id ?? '0');
    const bulkScale = BULK_SCALE_BY_ID[idStr] ?? DEFAULT_BULK_SCALE;
    const w = Math.floor((bulk.width ?? 40) * bulkScale) * this.scale;
    const h = Math.floor((bulk.height ?? 20) * bulkScale) * this.scale;

    const align = bulk.align ?? 'center';
    const xOff = bulk.xOffset ?? 0;

    let left = 'auto';
    let right = 'auto';
    let transform = '';

    if (align === 'left') {
      left = `${Math.max(xOff, 0) * this.scale}px`;
    } else if (align === 'right') {
      right = `${Math.max(xOff, 0) * this.scale}px`;
      transform = 'scaleX(-1)';
    } else {
      // Center-aligned: xOffset is relative to fuselage center
      left = `calc(50% - ${w / 2 - xOff * this.scale}px)`;
    }

    // React: fontSize = max(w, h) / 10, used for em-based sticker sizing
    const FONT_SIZE_COEFF = 10;
    const bulkFontSize = Math.round(Math.max(w, h) / FONT_SIZE_COEFF);

    // React: orientation check — if width > height → album (landscape), else portrait
    const stickerClass = w > h ? 'jets-bulk__sticker--album' : 'jets-bulk__sticker--portrait';

    // React: stickerWrapperHeight = containerH - renderedBaseH * 0.7
    // renderedBaseH = containerH * baseRatio (SVG scales proportionally)
    const baseRatio = BULK_BASE_RATIO[idStr] ?? 0.5;
    const stickerWrapperH = Math.round(h * (1 - baseRatio * bulkScale));

    return {
      html,
      stickerHtml,
      bulk,
      top: `${(bulk.topOffset ?? 0) * this.scale + this.topAdjust}px`,
      left,
      right,
      width: `${w}px`,
      height: `${h}px`,
      transform,
      fontSize: `${bulkFontSize}px`,
      stickerClass,
      stickerWrapperHeight: `${stickerWrapperH}px`,
      alignClass: align,
    };
  }

  private _resolveBulkStyle(): IBulkStyle {
    const theme = this.colorTheme ?? {};
    const cutColor = theme.bulkCutColor ?? DEFAULT_COLOR_THEME.bulkCutColor;
    const baseColor = theme.bulkBaseColor ?? DEFAULT_COLOR_THEME.bulkBaseColor;
    return {
      baseColor: this.flatBulks ? cutColor : baseColor,
      cutColor,
      stickerColor: theme.bulkIconColor ?? DEFAULT_COLOR_THEME.bulkIconColor,
      bulkFloorIconColor: theme.bulkFloorIconColor ?? DEFAULT_COLOR_THEME.bulkFloorIconColor,
    };
  }
}
