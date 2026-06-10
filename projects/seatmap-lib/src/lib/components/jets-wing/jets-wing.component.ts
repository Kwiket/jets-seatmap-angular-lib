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
    <div class="jets-wings" [style.top.px]="scaledTop" [style.width.px]="containerWidth" [style.height.px]="wingHeight">
      <!-- Left wing: trapezoid with swept leading (top) and trailing (bottom) edges.
           Inner edge (right=fuselage) runs full height; outer edge (left=wingtip)
           is tapered, producing a real wing silhouette instead of a flat rectangle. -->
      <svg
        class="jets-wing jets-wing--left"
        [attr.width]="wingWidth"
        [attr.height]="wingHeight"
        [attr.viewBox]="'0 0 60 ' + viewBoxHeight"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <path [attr.fill]="hullColor" [attr.stroke]="strokeColor" stroke-width="1.5" [attr.d]="leftWingPath" />
      </svg>

      <!-- Right wing: mirror image of left -->
      <svg
        class="jets-wing jets-wing--right"
        [attr.width]="wingWidth"
        [attr.height]="wingHeight"
        [attr.viewBox]="'0 0 60 ' + viewBoxHeight"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <path [attr.fill]="hullColor" [attr.stroke]="strokeColor" stroke-width="1.5" [attr.d]="rightWingPath" />
      </svg>
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

  /**
   * SVG viewBox height matched to the rendered wing in pixels so 1 viewBox
   * unit ≈ 1 rendered pixel. Without this the path's sweep offset (also in
   * viewBox units) would be stretched by the rectangle's aspect ratio —
   * a 30-unit slope on a 1:45 rectangle would render as ~100 px instead of 30.
   */
  get viewBoxHeight(): number {
    return Math.max(60, this.wingHeight);
  }

  /**
   * Sweep offset in viewBox Y-units. With viewBoxHeight === wingHeight, this
   * is also the slope in rendered pixels — the leading edge slants from
   * inner-top to outer-top by `sweep` px, the trailing edge slants the same
   * amount from outer-bottom to inner-bottom. Capped so very short wings
   * don't collapse to zero visible area on the outer side.
   */
  get sweep(): number {
    // ~tan(30°) * wingWidth gives a natural-looking swept-back wing.
    const sweepNative = Math.round(0.55 * this.wingWidth);
    // Never consume more than 40 % of the wing height per edge so the outer
    // tip still has a recognisable wingtip surface visible.
    const maxSweep = Math.floor(this.viewBoxHeight * 0.4);
    return Math.min(maxSweep, sweepNative);
  }

  /**
   * Path data for the LEFT wing.
   * Coordinate system: x=60 is inner (fuselage edge), x=0 is outer (wingtip).
   * Walk: inner-top → outer-top → outer-bottom → inner-bottom → close.
   * Only the top (leading) edge slopes — the bottom (trailing) edge is
   * straight across, matching the React reference silhouette.
   */
  get leftWingPath(): string {
    const s = this.sweep;
    const h = this.viewBoxHeight;
    return `M60,0 L0,${s} L0,${h} L60,${h} Z`;
  }

  /** Path data for the RIGHT wing — mirrored: x=0 inner, x=60 outer. */
  get rightWingPath(): string {
    const s = this.sweep;
    const h = this.viewBoxHeight;
    return `M0,0 L60,${s} L60,${h} L0,${h} Z`;
  }
}
