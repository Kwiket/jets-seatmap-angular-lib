import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IDeckData, IColorTheme } from '../../types';
import { DEFAULT_COLOR_THEME } from '../../constants';
import { JetsNoseComponent } from '../jets-nose/jets-nose.component';
import { JetsTailComponent } from '../jets-tail/jets-tail.component';
@Component({
  selector: 'sm-jets-plane-body',
  standalone: true,
  imports: [CommonModule, JetsNoseComponent, JetsTailComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="jets-plane-body" [style.width.px]="width" [style.background-color]="bgColor">
      <!-- Nose -->
      @if (showNose) {
        <sm-jets-nose [noseType]="noseType" [colorTheme]="colorTheme" [width]="width" />
      }

      <!-- Fuselage wrapper — width & border match nose SVG outline -->
      <div
        class="jets-plane-body__fuselage"
        [style.background-color]="fuselageFill"
        [style.border-color]="fuselageStroke"
        [style.width.px]="fuselageWidth"
        [style.border-left-width.px]="scaledStrokeWidth"
        [style.border-right-width.px]="scaledStrokeWidth"
      >
        <!-- Deck content projected here -->
        <ng-content />
      </div>

      <!-- Tail -->
      @if (showTail) {
        <sm-jets-tail [colorTheme]="colorTheme" [width]="width" />
      }
    </div>
  `,
  styles: [
    `
      .jets-plane-body {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .jets-plane-body__fuselage {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        border-left-style: solid;
        border-right-style: solid;
        overflow: visible;
        box-sizing: border-box;
      }
    `,
  ],
})
export class JetsPlaneBodyComponent {
  @Input() decks: IDeckData[] = [];
  @Input() colorTheme?: IColorTheme;
  @Input() width = 350;
  @Input() visibleFuselage = true;
  @Input() visibleNose?: boolean;
  @Input() visibleTail?: boolean;
  @Input() noseType?: string;

  get showNose(): boolean {
    return this.visibleNose ?? this.visibleFuselage;
  }

  get showTail(): boolean {
    return this.visibleTail ?? this.visibleFuselage;
  }

  /** Nose SVG viewBox width — all nose templates use 200. */
  private static readonly NOSE_VIEWBOX_W = 200;
  /** Nose SVG outline stroke-width (in SVG units). */
  private static readonly NOSE_STROKE = 1.5;

  /**
   * Fuselage container width = full seatmap width. Matches React's
   * `bodyWidth = config.width` (PlaneBody/index.js). The pixel-wide
   * `border-left`/`border-right` carve the interior via box-sizing: border-box.
   */
  get fuselageWidth(): number {
    return this.width;
  }

  /**
   * Body border width in pixels. Mirrors React's
   * `borderLeft: '${fuselageStrokeWidth}px …'` — the themed value
   * (clamped 10-18 by mergeColorThemeWithConstraints) IS the pixel width;
   * no SVG-unit scaling here. NOSE_STROKE fallback for un-themed consumers.
   */
  get scaledStrokeWidth(): number {
    const themed = this.colorTheme?.fuselageStrokeWidth;
    return typeof themed === 'number' && themed > 0 ? themed : JetsPlaneBodyComponent.NOSE_STROKE;
  }

  get bgColor(): string {
    return this.colorTheme?.seatMapBackgroundColor ?? DEFAULT_COLOR_THEME.seatMapBackgroundColor;
  }

  get fuselageFill(): string {
    return this.colorTheme?.fuselageFillColor ?? DEFAULT_COLOR_THEME.fuselageFillColor;
  }

  get fuselageStroke(): string {
    return this.colorTheme?.fuselageStrokeColor ?? DEFAULT_COLOR_THEME.fuselageStrokeColor;
  }
}
