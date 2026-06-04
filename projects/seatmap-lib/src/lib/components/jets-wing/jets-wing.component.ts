import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IColorTheme, IWingsInfo } from '../../types';
import { DEFAULT_COLOR_THEME } from '../../constants';

@Component({
  selector: 'sm-jets-wing',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="jets-wings"
      aria-hidden="true"
      [style.top.px]="scaledTop"
      [style.width.px]="containerWidth"
      [style.height.px]="wingHeight"
    >
      <!-- Left wing: rectangle body -->
      <svg
        class="jets-wing jets-wing--left"
        [attr.width]="wingWidth"
        [attr.height]="wingHeight"
        viewBox="0 0 60 200"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <path [attr.fill]="hullColor" [attr.stroke]="strokeColor" stroke-width="1.5" d="M60,0 L0,0 L0,200 L60,200 Z" />
      </svg>

      <!-- Left wing-leading (triangular mask at top) -->
      <div
        class="wing-leading wing-leading--left"
        [style.width.px]="wingWidth + 8"
        [style.height.px]="leadingHeight"
        [style.background]="bgColor"
      ></div>

      <!-- Right wing: rectangle body -->
      <svg
        class="jets-wing jets-wing--right"
        [attr.width]="wingWidth"
        [attr.height]="wingHeight"
        viewBox="0 0 60 200"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <path [attr.fill]="hullColor" [attr.stroke]="strokeColor" stroke-width="1.5" d="M0,0 L60,0 L60,200 L0,200 Z" />
      </svg>

      <!-- Right wing-leading (triangular mask at top) -->
      <div
        class="wing-leading wing-leading--right"
        [style.width.px]="wingWidth + 8"
        [style.height.px]="leadingHeight"
        [style.background]="bgColor"
      ></div>
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .jets-wings {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        pointer-events: none;
        z-index: 0;
      }

      .jets-wing {
        position: absolute;
        display: block;
      }

      .jets-wing--left {
        right: 100%;
        margin-right: -1px;
      }

      .jets-wing--right {
        left: 100%;
        margin-left: -1px;
      }

      .wing-leading {
        position: absolute;
        top: -3px;
        overflow: hidden;
        z-index: 1;
        pointer-events: none;
      }

      .wing-leading--left {
        right: 100%;
        margin-right: -4px;
        clip-path: polygon(100% 10%, 0% 100%, 0% 0%);
      }

      .wing-leading--right {
        left: 100%;
        margin-left: -4px;
        clip-path: polygon(100% 0%, 100% 100%, -10% 0%);
      }
    `,
  ],
})
export class JetsWingComponent {
  @Input() wingsInfo?: IWingsInfo;
  @Input() colorTheme?: IColorTheme;
  @Input() bodyWidth = 200;
  @Input() scale = 1;
  @Input() topAdjust = 0;

  get scaledTop(): number {
    return Math.round((this.wingsInfo?.topOffset ?? 0) * this.scale) + this.topAdjust;
  }

  get containerWidth(): number {
    return this.bodyWidth;
  }

  get wingWidth(): number {
    // colorTheme.wingsWidth (native px, scaled by deck scale) wins when set;
    // otherwise fall back to a 6%-of-body heuristic so existing consumers
    // without the theme key keep their current rendering.
    const themed = this.colorTheme?.wingsWidth;
    if (typeof themed === 'number' && themed > 0) {
      return Math.max(10, Math.round(themed * this.scale));
    }
    return Math.max(10, Math.round(this.bodyWidth * 0.06) - 2);
  }

  get wingHeight(): number {
    return Math.round((this.wingsInfo?.height ?? 120) * this.scale);
  }

  get hullColor(): string {
    return this.colorTheme?.fuselageWingsColor ?? this.colorTheme?.hullColor ?? DEFAULT_COLOR_THEME.fuselageWingsColor;
  }

  get strokeColor(): string {
    return this.colorTheme?.fuselageStrokeColor ?? DEFAULT_COLOR_THEME.fuselageStrokeColor;
  }

  /** Height of the wing-leading triangle overlay (matches React's 30px native) */
  get leadingHeight(): number {
    return Math.max(6, Math.round(30 * this.scale));
  }

  /** Background color for the wing-leading mask (hides the wing corner) */
  get bgColor(): string {
    return this.colorTheme?.seatMapBackgroundColor || '#fff';
  }
}
