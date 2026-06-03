import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IExitData, IColorTheme } from '../../types';
import { DEFAULT_COLOR_THEME } from '../../constants';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/** React-matching exit arrow SVGs — solid filled arrows, 114×114 viewBox. */
const LEFT_ARROW_SVG = `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 114 114" preserveAspectRatio="xMidYMid meet"><g transform="translate(0,114) scale(0.1,-0.1)" fill="currentColor" stroke="none"><path d="M635 922 c-115 -85 -269 -198 -341 -251 l-132 -96 344 -252 344 -252 0 129 0 129 95 -54 95 -54 0 354 0 354 -95 -54 -94 -53 -3 127 -3 127 -210 -154z"/></g></svg>`;
const RIGHT_ARROW_SVG = `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 114 114" preserveAspectRatio="xMidYMid meet"><g transform="translate(0,114) scale(0.1,-0.1)" fill="currentColor" stroke="none"><path d="M290 950 l0 -129 -95 54 -95 54 0 -354 0 -354 95 54 95 54 0 -129 0 -129 344 252 c334 245 343 252 322 268 -11 9 -166 122 -343 252 l-323 236 0 -129z"/></g></svg>`;

@Component({
  selector: 'sm-jets-deck-exit',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (exit of exits; track $index) {
      <div
        class="jets-exit"
        [class.jets-exit--left]="exit.type === 'left'"
        [class.jets-exit--right]="exit.type === 'right'"
        [style.top.px]="exit.topOffset * scale + topAdjust"
        [style.width.px]="exitSizePx"
        [style.height.px]="exitSizePx"
        [style.color]="exitColor"
      >
        @if (exitIconUrlFor(exit.type); as iconUrl) {
          <img
            class="jets-exit__icon"
            [src]="iconUrl"
            [attr.alt]="exit.type === 'left' ? 'Left exit' : 'Right exit'"
            draggable="false"
          />
        } @else {
          <span class="jets-exit__icon" [innerHTML]="exit.type === 'left' ? leftArrowHtml : rightArrowHtml"></span>
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

      .jets-exit {
        position: absolute;
        pointer-events: none;
        z-index: 1;
      }

      .jets-exit--left {
        left: 0;
      }

      .jets-exit--right {
        right: 0;
      }

      .jets-exit__icon {
        display: block;
        width: 100%;
        height: 100%;
        user-select: none;
      }

      img.jets-exit__icon {
        object-fit: contain;
      }
    `,
  ],
})
export class JetsDeckExitComponent {
  @Input() exits: IExitData[] = [];
  @Input() colorTheme?: IColorTheme;
  @Input() scale = 1;
  /** Extra vertical offset in px to align absolute positioning with flow-positioned rows. */
  @Input() topAdjust = 0;

  leftArrowHtml: SafeHtml = '';
  rightArrowHtml: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer) {
    this.leftArrowHtml = this.sanitizer.bypassSecurityTrustHtml(LEFT_ARROW_SVG);
    this.rightArrowHtml = this.sanitizer.bypassSecurityTrustHtml(RIGHT_ARROW_SVG);
  }

  /** React uses 72px in unscaled coords. Pre-scale for Angular. */
  get exitSizePx(): number {
    return Math.round(72 * this.scale);
  }

  get exitColor(): string {
    return this.colorTheme?.exitColor ?? DEFAULT_COLOR_THEME.exitColor;
  }

  /**
   * Resolve the override icon URL for a given side from `colorTheme`.
   * Empty strings count as "not provided" so a blank config doesn't blank out
   * the bundled arrow.
   */
  exitIconUrlFor(type: 'left' | 'right'): string | null {
    const url = type === 'left' ? this.colorTheme?.exitIconUrlLeft : this.colorTheme?.exitIconUrlRight;
    return url && url.trim().length > 0 ? url : null;
  }
}
