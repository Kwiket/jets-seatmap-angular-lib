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
      [style.background]="fillColor"
      [style.height.px]="separationHeight"
    ></div>
  `,
  styles: [
    `
      .jets-deck-separator {
        width: 100%;
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
