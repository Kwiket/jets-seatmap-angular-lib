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
      <!-- Leading fuselage end. In horizontal LTR the tail leads (mirrors
           React PlaneBody/index.js \`isTailFirst\`); otherwise the nose leads. -->
      @if (isHorizontalLtr) {
        @if (showTail) {
          <sm-jets-tail
            [colorTheme]="colorTheme"
            [width]="width"
            [displayScale]="displayScale"
            [horizontal]="horizontal"
            [rightToLeft]="rightToLeft"
          />
        }
      } @else {
        @if (showNose) {
          <sm-jets-nose
            [noseType]="noseType"
            [colorTheme]="colorTheme"
            [width]="width"
            [displayScale]="displayScale"
            [horizontal]="horizontal"
            [rightToLeft]="rightToLeft"
          />
        }
      }

      <!-- Fuselage wrapper — width & border match nose SVG outline.
           Flipped 180deg in horizontal LTR so the projected decks read the
           right way up after the parent's 90deg rotation. -->
      <div
        class="jets-plane-body__fuselage"
        [style.background-color]="fuselageFill"
        [style.border-color]="fuselageStroke"
        [style.width.px]="fuselageWidth"
        [style.border-left-width.px]="scaledStrokeWidth"
        [style.border-right-width.px]="scaledStrokeWidth"
        [style.transform]="deckWrapperTransform || null"
      >
        <!-- Deck content projected here -->
        <ng-content />
      </div>

      <!-- Trailing fuselage end (nose in horizontal LTR, tail otherwise). -->
      @if (isHorizontalLtr) {
        @if (showNose) {
          <sm-jets-nose
            [noseType]="noseType"
            [colorTheme]="colorTheme"
            [width]="width"
            [displayScale]="displayScale"
            [horizontal]="horizontal"
            [rightToLeft]="rightToLeft"
          />
        }
      } @else {
        @if (showTail) {
          <sm-jets-tail
            [colorTheme]="colorTheme"
            [width]="width"
            [displayScale]="displayScale"
            [horizontal]="horizontal"
            [rightToLeft]="rightToLeft"
          />
        }
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
  /**
   * Display scale (= `config.width / maxDeckWidth`, same formula React uses
   * for its CSS `zoom`/`transform: scale`). React shrinks every CSS px by
   * this factor when rendering — a `fuselageStrokeWidth: 10` paints at
   * ~7.17 px on a typical 558-wide native deck. We pre-scale the body's
   * border-width here so the visual thickness matches.
   */
  @Input() displayScale = 1;
  /** Horizontal cabin layout (whole map is rotated 90deg by the parent). */
  @Input() horizontal = false;
  /** RTL flips the cabin direction in horizontal mode (mirrors React). */
  @Input() rightToLeft = false;

  /** Horizontal left-to-right — the orientation that flips nose/tail/decks.
   *  Mirrors React's `params.isHorizontal && !params.rightToLeft`. */
  get isHorizontalLtr(): boolean {
    return this.horizontal && !this.rightToLeft;
  }

  /** Deck-wrapper transform: flipped 180deg in horizontal LTR so the
   *  projected decks (and nose/tail) stay consistent. Mirrors React
   *  PlaneBody/index.js `decksWrapperStyle.transform`. */
  get deckWrapperTransform(): string {
    return this.isHorizontalLtr ? 'rotate(180deg)' : '';
  }

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
   * `borderLeft: '${fuselageStrokeWidth}px …'` (PlaneBody/index.js:30-34) —
   * the themed value (clamped 10-18 by mergeColorThemeWithConstraints) IS
   * the pixel width; no SVG-unit scaling. When the consumer doesn't set
   * `fuselageStrokeWidth`, React renders no border (`${undefined}px` → invalid
   * CSS → 0), so we return 0 too, otherwise a hidden 1.5-px line creeps in.
   */
  get scaledStrokeWidth(): number {
    const themed = this.colorTheme?.fuselageStrokeWidth;
    const stroke = typeof themed === 'number' && themed > 0 ? themed : 0;
    return stroke * this.displayScale;
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
