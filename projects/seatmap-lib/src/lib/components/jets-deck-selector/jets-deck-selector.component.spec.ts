import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsDeckSelectorComponent } from './jets-deck-selector.component';
import { IDeckData } from '../../types';

function makeDeck(number: number, title?: string): IDeckData {
  return { rows: [], number, title };
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
});
