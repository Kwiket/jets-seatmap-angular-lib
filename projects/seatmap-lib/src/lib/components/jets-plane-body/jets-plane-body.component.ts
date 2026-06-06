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
   * Fuselage width matching the nose SVG outline outer edges.
   * Nose outline path is at x=1.5 .. x=198.5; with stroke-width S (SVG units),
   * the body's outer edges align with the nose's outer stroke edges when we
   * subtract S from the viewBox span. Falls back to 1.5 when no theme override.
   */
  get fuselageWidth(): number {
    const vb = JetsPlaneBodyComponent.NOSE_VIEWBOX_W;
    const themedStroke = this.colorTheme?.fuselageStrokeWidth ?? JetsPlaneBodyComponent.NOSE_STROKE;
    return (this.width * (vb - themedStroke)) / vb;
  }

  /** Border width that matches the nose SVG stroke scaled to rendered size. */
  get scaledStrokeWidth(): number {
    // colorTheme.fuselageStrokeWidth (native SVG units, after the
    // mergeColorThemeWithConstraints clamp to 10-18) wins when set; the
    // 1.5-unit NOSE_STROKE fallback keeps the look stable for consumers
    // who don't theme the value.
    const themed = this.colorTheme?.fuselageStrokeWidth;
    const native = typeof themed === 'number' && themed > 0 ? themed : JetsPlaneBodyComponent.NOSE_STROKE;
    return (native * this.width) / JetsPlaneBodyComponent.NOSE_VIEWBOX_W;
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
