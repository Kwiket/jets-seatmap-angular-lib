import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsDeckSelectorComponent } from './jets-deck-selector.component';
import { IDeckData } from '../../types';

function makeDeck(number: number, title?: string): IDeckData {
  return { rows: [], number, title };
}

/**
 * Wait one macrotask + flush change detection. The component schedules a
 * setTimeout(0) after arrow-key navigation to focus the next tab; tests
 * need to await that tick before asserting on focus / selectDeck order.
 */
async function flushMicroAndMacro(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  fixture.detectChanges();
}

describe('JetsDeckSelectorComponent', () => {
  let fixture: ComponentFixture<JetsDeckSelectorComponent>;
  let component: JetsDeckSelectorComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JetsDeckSelectorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsDeckSelectorComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    component.decks = [makeDeck(1), makeDeck(2)];
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render with multi-deck input', () => {
    component.decks = [makeDeck(1, 'Upper'), makeDeck(2, 'Lower')];
    component.activeIndex = 0;
    fixture.detectChanges();
    expect(component.decks).toHaveLength(2);
  });

  it('should emit selectDeck event when emitted programmatically', () => {
    component.decks = [makeDeck(1), makeDeck(2)];
    fixture.detectChanges();

    const spy = vi.fn();
    component.selectDeck.subscribe(spy);
    component.selectDeck.emit(1);

    expect(spy).toHaveBeenCalledWith(1);
  });

  it('should respect activeIndex changes', () => {
    component.decks = [makeDeck(1), makeDeck(2)];
    component.activeIndex = 1;
    fixture.detectChanges();
    expect(component.activeIndex).toBe(1);
  });

  // ─── N=2: role=switch semantics ─────────────────────────────────────────
  describe('N=2 (switch mode)', () => {
    beforeEach(() => {
      component.decks = [makeDeck(1, 'Lower'), makeDeck(2, 'Upper')];
      component.activeIndex = 0;
      fixture.detectChanges();
    });

    it('renders a <button role="switch"> with aria-checked reflecting activeIndex', () => {
      const btn0 = fixture.nativeElement.querySelector('button[role="switch"]') as HTMLButtonElement;
      expect(btn0).toBeTruthy();
      expect(btn0.getAttribute('aria-checked')).toBe('false');

      // Use componentRef.setInput so OnPush picks up the @Input change
      // (Angular 21 requires this for input mutations in tests).
      fixture.componentRef.setInput('activeIndex', 1);
      fixture.detectChanges();
      const btn1 = fixture.nativeElement.querySelector('button[role="switch"]') as HTMLButtonElement;
      expect(btn1.getAttribute('aria-checked')).toBe('true');
    });

    it('exposes an aria-label that names the other deck', () => {
      const btn = fixture.nativeElement.querySelector('button[role="switch"]') as HTMLButtonElement;
      const label = btn.getAttribute('aria-label') || '';
      // Switch is visible while activeIndex=0 → label should reference the
      // OTHER deck (Upper).
      expect(label).toContain('Upper');
    });

    it('emits selectDeck with the next index on click', () => {
      const spy = vi.fn();
      component.selectDeck.subscribe(spy);
      const btn = fixture.nativeElement.querySelector('button[role="switch"]') as HTMLButtonElement;
      btn.click();
      expect(spy).toHaveBeenCalledWith(1);
    });

    it('emits selectDeck on Enter key', () => {
      const spy = vi.fn();
      component.selectDeck.subscribe(spy);
      const btn = fixture.nativeElement.querySelector('button[role="switch"]') as HTMLButtonElement;
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(spy).toHaveBeenCalledWith(1);
    });

    it('emits selectDeck on Space key and prevents default scroll', () => {
      const spy = vi.fn();
      component.selectDeck.subscribe(spy);
      const btn = fixture.nativeElement.querySelector('button[role="switch"]') as HTMLButtonElement;
      const ev = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      btn.dispatchEvent(ev);
      expect(spy).toHaveBeenCalledWith(1);
      expect(ev.defaultPrevented).toBe(true);
    });
  });

  // ─── N>=3: role=tablist semantics ───────────────────────────────────────
  describe('N>=3 (tablist mode)', () => {
    beforeEach(() => {
      component.decks = [makeDeck(1, 'Main'), makeDeck(2, 'Upper'), makeDeck(3, 'Cargo')];
      component.activeIndex = 0;
      fixture.detectChanges();
    });

    it('renders a <div role="tablist"> with one role=tab button per deck', () => {
      const tablist = fixture.nativeElement.querySelector('[role="tablist"]') as HTMLElement;
      expect(tablist).toBeTruthy();
      const tabs = tablist.querySelectorAll('button[role="tab"]');
      expect(tabs).toHaveLength(3);
    });

    it('marks only the active tab with aria-selected="true" and roving tabindex=0', () => {
      const tabs = fixture.nativeElement.querySelectorAll('button[role="tab"]') as NodeListOf<HTMLButtonElement>;
      expect(tabs[0].getAttribute('aria-selected')).toBe('true');
      expect(tabs[0].getAttribute('tabindex')).toBe('0');
      expect(tabs[1].getAttribute('aria-selected')).toBe('false');
      expect(tabs[1].getAttribute('tabindex')).toBe('-1');
    });

    it('exposes aria-controls on each tab pointing at the matching deck-panel id', () => {
      const tabs = fixture.nativeElement.querySelectorAll('button[role="tab"]') as NodeListOf<HTMLButtonElement>;
      const base = component.deckPanelIdBase;
      tabs.forEach((t, i) => {
        expect(t.getAttribute('aria-controls')).toBe(`${base}-${i}`);
      });
    });

    it('emits selectDeck with next index on ArrowRight', async () => {
      const spy = vi.fn();
      component.selectDeck.subscribe(spy);
      const tabs = fixture.nativeElement.querySelectorAll('button[role="tab"]') as NodeListOf<HTMLButtonElement>;
      tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      expect(spy).toHaveBeenCalledWith(1);
    });

    it('emits selectDeck with previous index on ArrowLeft (wraps to last)', () => {
      const spy = vi.fn();
      component.selectDeck.subscribe(spy);
      const tabs = fixture.nativeElement.querySelectorAll('button[role="tab"]') as NodeListOf<HTMLButtonElement>;
      tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
      expect(spy).toHaveBeenCalledWith(2); // wraps from 0 → last (2)
    });

    it('emits selectDeck with 0 on Home', () => {
      component.activeIndex = 2;
      fixture.detectChanges();
      const spy = vi.fn();
      component.selectDeck.subscribe(spy);
      const tabs = fixture.nativeElement.querySelectorAll('button[role="tab"]') as NodeListOf<HTMLButtonElement>;
      tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
      expect(spy).toHaveBeenCalledWith(0);
    });

    it('emits selectDeck with last index on End', () => {
      const spy = vi.fn();
      component.selectDeck.subscribe(spy);
      const tabs = fixture.nativeElement.querySelectorAll('button[role="tab"]') as NodeListOf<HTMLButtonElement>;
      tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
      expect(spy).toHaveBeenCalledWith(2);
    });

    it('moves DOM focus to the new tab after arrow-key navigation', async () => {
      const tabs = fixture.nativeElement.querySelectorAll('button[role="tab"]') as NodeListOf<HTMLButtonElement>;
      // Manually flip activeIndex (caller would do this on selectDeck) so the
      // roving tabindex is correct on the target before focus.
      component.selectDeck.subscribe((i: number) => {
        component.activeIndex = i;
        fixture.detectChanges();
      });
      tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      await flushMicroAndMacro(fixture);
      const refreshed = fixture.nativeElement.querySelectorAll('button[role="tab"]') as NodeListOf<HTMLButtonElement>;
      expect(document.activeElement).toBe(refreshed[1]);
    });

    it('click on a non-active tab emits selectDeck with its index', () => {
      const spy = vi.fn();
      component.selectDeck.subscribe(spy);
      const tabs = fixture.nativeElement.querySelectorAll('button[role="tab"]') as NodeListOf<HTMLButtonElement>;
      tabs[2].click();
      expect(spy).toHaveBeenCalledWith(2);
    });

    it('click on the active tab does NOT emit selectDeck', () => {
      const spy = vi.fn();
      component.selectDeck.subscribe(spy);
      const tabs = fixture.nativeElement.querySelectorAll('button[role="tab"]') as NodeListOf<HTMLButtonElement>;
      tabs[0].click();
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
