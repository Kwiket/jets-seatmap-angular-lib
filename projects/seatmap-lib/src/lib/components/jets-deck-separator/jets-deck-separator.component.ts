import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IColorTheme } from '../../types';
import { DEFAULT_COLOR_THEME } from '../../constants';

@Component({
  selector: 'sm-jets-deck-separator',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="jets-deck-separator"
      aria-hidden="true"
      [style.background]="fillColor"
      [style.height.px]="separationHeight"
    ></div>
  `,
  styles: [
    `
      .jets-deck-separator {
        width: 100%;
      }

      /* Windows High Contrast / forced-colors mode.
         The bar uses a parameterised theme background that the browser
         neutralises under forced-colors, leaving an invisible gap between
         decks. Force CanvasText so the separator stays perceivable. */
      @media (forced-colors: active) {
        .jets-deck-separator {
          background: CanvasText !important;
        }
      }
    `,
  ],
})
export class JetsDeckSeparatorComponent {
  @Input() colorTheme?: IColorTheme;

  get fillColor(): string {
    return this.colorTheme?.fuselageFillColor ?? DEFAULT_COLOR_THEME.fuselageFillColor;
  }

  get separationHeight(): number {
    return this.colorTheme?.deckSeparation ?? DEFAULT_COLOR_THEME.deckSeparation;
  }
}
