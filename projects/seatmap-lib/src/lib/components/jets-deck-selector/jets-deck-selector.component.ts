import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IDeckData, IColorTheme } from '../../types';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

const BUTTON_SVG = (stroke: string) => `
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" viewBox="0 0 384.97 384.97">
<g><g>
  <path fill="${stroke}" d="M360.909,0H24.061C10.767,0,0,10.767,0,24.061v336.848c0,13.293,10.767,24.061,24.061,24.061h336.848
    c13.281,0,24.061-10.767,24.061-24.061V24.061C384.97,10.767,374.191,0,360.909,0z M360.909,360.909H24.061V24.061h336.848
    V360.909z"/>
  <path fill="${stroke}" d="M59.935,240.666c0,6.785,5.883,12.151,12.56,11.97h239.92
    c10.671,0.289,16.602-12.872,8.927-20.476l-120.291-119.1c-4.74-4.692-12.403-4.523-17.191,0L63.664,232.065
    C61.379,234.242,59.935,237.274,59.935,240.666z M192.461,138.589l91.021,90.119H101.427L192.461,138.589z"/>
</g></g>
</svg>`;

@Component({
  selector: 'sm-jets-deck-selector',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="jets-deck-selector"
      [style.transform]="iconRotation"
      [style.background]="fillColor"
      [style.height.px]="selectorSize"
      [style.width.px]="selectorSize"
      (click)="onToggle()"
      [innerHTML]="iconSvg"
    ></div>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .jets-deck-selector {
        position: absolute;
        padding: 5px;
        margin: 5px;
        border-radius: 3px;
        z-index: 1000;
        cursor: pointer;
        left: 0;
      }

      /* Windows High Contrast / forced-colors mode.
         The inline SVG icon uses a parameterised fill that the browser
         strips under forced-colors, leaving an invisible clickable area.
         Render the selector as a ButtonFace/ButtonText box so users can
         still see and operate it. Commit 12 will give it real button
         semantics; until then this keeps it visually actionable. */
      @media (forced-colors: active) {
        .jets-deck-selector {
          forced-color-adjust: none;
          background: ButtonFace !important;
          color: ButtonText;
          border: 1px solid ButtonText;
        }

        .jets-deck-selector :is(svg, path) {
          fill: ButtonText;
        }
      }
    `,
  ],
})
export class JetsDeckSelectorComponent implements OnChanges {
  @Input() decks: IDeckData[] = [];
  @Input() activeIndex = 0;
  @Input() lang = 'EN';
  @Input() colorTheme?: IColorTheme;
  @Output() selectDeck = new EventEmitter<number>();

  iconSvg: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    const stroke = this.colorTheme?.deckSelectorStrokeColor ?? 'rgba(50, 50, 50, 0.5)';
    this.iconSvg = this.sanitizer.bypassSecurityTrustHtml(BUTTON_SVG(stroke));
  }

  get fillColor(): string {
    return this.colorTheme?.deckSelectorFillColor ?? '#fff';
  }

  get selectorSize(): number {
    return (this.colorTheme?.deckSelectorSize as number) ?? 25;
  }

  get iconRotation(): string {
    return `rotate(${180 * this.activeIndex}deg)`;
  }

  onToggle(): void {
    if (this.decks.length < 2) return;
    const next = (this.activeIndex + 1) % this.decks.length;
    this.selectDeck.emit(next);
  }
}
