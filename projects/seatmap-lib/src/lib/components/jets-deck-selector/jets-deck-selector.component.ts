import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IDeckData, IColorTheme } from '../../types';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LOCALES_MAP } from '../../constants';

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
    <!-- N = 2: toggle switch -->
    @if (decks.length === 2) {
      <button
        type="button"
        class="jets-deck-selector jets-deck-selector--switch"
        role="switch"
        [attr.aria-checked]="activeIndex !== 0 ? 'true' : 'false'"
        [attr.aria-label]="toggleLabel"
        [style.transform]="iconRotation"
        [style.background]="fillColor"
        [style.height.px]="selectorSize"
        [style.width.px]="selectorSize"
        (click)="onToggle()"
        (keydown.enter)="onToggle(); $event.preventDefault()"
        (keydown.space)="onToggle(); $event.preventDefault()"
        [innerHTML]="iconSvg"
      ></button>
    } @else if (decks.length >= 3) {
      <!-- N >= 3: tablist -->
      <div
        class="jets-deck-selector jets-deck-selector--tablist"
        role="tablist"
        [attr.aria-label]="tablistLabel"
      >
        @for (deck of decks; track deck.number; let i = $index) {
          <button
            #tabBtn
            type="button"
            class="jets-deck-selector__tab"
            role="tab"
            [attr.aria-selected]="i === activeIndex ? 'true' : 'false'"
            [attr.tabindex]="i === activeIndex ? 0 : -1"
            [attr.aria-controls]="deckPanelId(i)"
            [attr.aria-label]="deckTabLabel(deck, i)"
            [style.background]="fillColor"
            [style.height.px]="selectorSize"
            [style.width.px]="selectorSize"
            (click)="onTabClick(i)"
            (keydown.arrowLeft)="onTabKey($event, i, -1)"
            (keydown.arrowRight)="onTabKey($event, i, +1)"
            (keydown.home)="onTabKey($event, i, 'first')"
            (keydown.end)="onTabKey($event, i, 'last')"
            [innerHTML]="iconSvg"
          ></button>
        }
      </div>
    }
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
        /* Reset button defaults so switch and tab buttons look identical to
           the legacy <div> selector. */
        border: 0;
        background: none;
        font: inherit;
        color: inherit;
        line-height: 0;
      }

      .jets-deck-selector--tablist {
        position: absolute;
        display: flex;
        flex-direction: row;
        gap: 4px;
        padding: 0;
        margin: 5px;
        background: none;
        left: 0;
      }

      .jets-deck-selector__tab {
        position: relative;
        padding: 5px;
        margin: 0;
        border: 0;
        border-radius: 3px;
        cursor: pointer;
        line-height: 0;
      }

      .jets-deck-selector__tab[aria-selected='true'] {
        outline: 2px solid currentColor;
        outline-offset: -2px;
      }

      .jets-deck-selector:focus-visible,
      .jets-deck-selector__tab:focus-visible {
        outline: 2px solid #0277bd;
        outline-offset: 2px;
      }

      /* Windows High Contrast / forced-colors mode.
         The inline SVG icon uses a parameterised fill that the browser
         strips under forced-colors, leaving an invisible clickable area.
         Render the selector as a ButtonFace/ButtonText box so users can
         still see and operate it. */
      @media (forced-colors: active) {
        .jets-deck-selector,
        .jets-deck-selector__tab {
          forced-color-adjust: none;
          background: ButtonFace !important;
          color: ButtonText;
          border: 1px solid ButtonText;
        }

        .jets-deck-selector :is(svg, path),
        .jets-deck-selector__tab :is(svg, path) {
          fill: ButtonText;
        }

        .jets-deck-selector__tab[aria-selected='true'] {
          outline: 2px solid Highlight;
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
  /**
   * Base ID for the deck panel(s) the tablist controls (N>=3 only).
   * The consumer is expected to put a matching `id` on the deck-panel wrapper
   * so AT users get the role=tab → role=tabpanel relationship.
   */
  @Input() deckPanelIdBase = 'jets-deck-panel';
  @Output() selectDeck = new EventEmitter<number>();

  @ViewChildren('tabBtn') tabButtons?: QueryList<ElementRef<HTMLButtonElement>>;

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

  /**
   * Visual rotation cue for the N=2 toggle. The N>=3 tablist branch renders
   * its own non-rotating tab buttons (visual identity for tablist is
   * `aria-selected` outline), so iconRotation only applies in switch mode.
   */
  get iconRotation(): string {
    return `rotate(${180 * this.activeIndex}deg)`;
  }

  // ─── Localisation helpers ────────────────────────────────────────────────
  private get locale(): Record<string, string> {
    return LOCALES_MAP[this.lang] || LOCALES_MAP['EN'] || {};
  }

  /**
   * Label for the N=2 switch. Describes the action of flipping decks rather
   * than the current state, which is conveyed by aria-checked.
   * TODO(commit 17 docs): add 'switchDeck' / 'showDeck' keys to all locales;
   * for now we fall back to English plus the localised "deck" word.
   */
  get toggleLabel(): string {
    const deckWord = this.locale['deck'] || 'Deck';
    const otherIndex = this.activeIndex === 0 ? 1 : 0;
    const other = this.decks[otherIndex];
    const otherTitle = other?.title || `${deckWord} ${other?.number ?? otherIndex + 1}`;
    // TODO(commit 17 docs): add 'switchToDeck' to LOCALES_MAP for full i18n.
    const showWord = this.locale['switchToDeck'] || 'Switch to';
    return `${showWord} ${otherTitle}`;
  }

  /**
   * aria-label for the tablist wrapper.
   * TODO(commit 17 docs): add 'deckSelector' / 'tablistLabel' locale key.
   */
  get tablistLabel(): string {
    return this.locale['deckSelector'] || 'Deck selector';
  }

  /**
   * Per-tab aria-label. Uses the deck's own title when present, otherwise
   * "Deck N" using the localised "deck" word.
   */
  deckTabLabel(deck: IDeckData, index: number): string {
    const deckWord = this.locale['deck'] || 'Deck';
    return deck.title || `${deckWord} ${deck.number ?? index + 1}`;
  }

  /** Stable id used by aria-controls and matched by the seat-map deck panel. */
  deckPanelId(index: number): string {
    return `${this.deckPanelIdBase}-${index}`;
  }

  onToggle(): void {
    if (this.decks.length < 2) return;
    const next = (this.activeIndex + 1) % this.decks.length;
    this.selectDeck.emit(next);
  }

  /** Tab-click handler — only emits when the clicked tab differs. */
  onTabClick(index: number): void {
    if (index === this.activeIndex) return;
    this.selectDeck.emit(index);
  }

  /**
   * Keyboard navigation inside the tablist. Supports ArrowLeft/ArrowRight
   * (relative) and Home/End (jump). Emits `selectDeck` for the target tab
   * and moves DOM focus to it (roving tabindex pattern).
   */
  onTabKey(event: Event, currentIndex: number, direction: -1 | 1 | 'first' | 'last'): void {
    event.preventDefault();
    const n = this.decks.length;
    if (n < 2) return;
    let next: number;
    if (direction === 'first') next = 0;
    else if (direction === 'last') next = n - 1;
    else next = (currentIndex + direction + n) % n;
    this.selectDeck.emit(next);
    // Move focus after the host re-renders with the new activeIndex.
    setTimeout(() => {
      const btn = this.tabButtons?.toArray()[next]?.nativeElement;
      btn?.focus();
    }, 0);
  }
}
