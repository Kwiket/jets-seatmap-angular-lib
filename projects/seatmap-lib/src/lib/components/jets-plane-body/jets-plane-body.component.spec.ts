import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsPlaneBodyComponent } from './jets-plane-body.component';
import { IDeckData } from '../../types';

function makeDeck(): IDeckData {
  return { rows: [], number: 1 };
}

describe('JetsPlaneBodyComponent', () => {
  let fixture: ComponentFixture<JetsPlaneBodyComponent>;
  let component: JetsPlaneBodyComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JetsPlaneBodyComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsPlaneBodyComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    component.decks = [makeDeck()];
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render with visibleFuselage enabled (default)', () => {
    component.decks = [makeDeck()];
    component.visibleFuselage = true;
    fixture.detectChanges();
    expect(component.visibleFuselage).toBe(true);
  });

  it('should respect visibleFuselage=false', () => {
    component.decks = [makeDeck()];
    component.visibleFuselage = false;
    fixture.detectChanges();
    expect(component.visibleFuselage).toBe(false);
  });

  it('should respect visibleNose and visibleTail overrides', () => {
    component.decks = [makeDeck()];
    component.visibleNose = false;
    component.visibleTail = false;
    fixture.detectChanges();
    expect(component.visibleNose).toBe(false);
    expect(component.visibleTail).toBe(false);
  });

  it('should pass noseType through', () => {
    component.decks = [makeDeck()];
    component.noseType = 'by-type';
    fixture.detectChanges();
    expect(component.noseType).toBe('by-type');
  });

  // ─── Horizontal layout (React PlaneBody/index.js parity) ──────────────────
  const fuselageEl = () =>
    fixture.nativeElement.querySelector('.jets-plane-body__fuselage') as HTMLElement;
  // DOM order of the three structural blocks, top→bottom.
  const blockOrder = (): string[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll(
        '.jets-nose, .jets-plane-body__fuselage, .jets-tail'
      )
    ).map(el =>
      (el as HTMLElement).classList.contains('jets-nose')
        ? 'nose'
        : (el as HTMLElement).classList.contains('jets-tail')
          ? 'tail'
          : 'fuselage'
    );

  it('does not rotate the deck wrapper in vertical mode', () => {
    component.decks = [makeDeck()];
    fixture.componentRef.setInput('horizontal', false);
    fixture.detectChanges();
    expect(fuselageEl().style.transform).toBe('');
  });

  it('rotates the deck wrapper 180deg in horizontal LTR', () => {
    component.decks = [makeDeck()];
    fixture.componentRef.setInput('horizontal', true);
    fixture.componentRef.setInput('rightToLeft', false);
    fixture.detectChanges();
    expect(fuselageEl().style.transform).toBe('rotate(180deg)');
  });

  it('does not rotate the deck wrapper in horizontal RTL', () => {
    component.decks = [makeDeck()];
    fixture.componentRef.setInput('horizontal', true);
    fixture.componentRef.setInput('rightToLeft', true);
    fixture.detectChanges();
    expect(fuselageEl().style.transform).toBe('');
  });

  it('passes horizontal/rightToLeft down so the nose flips in horizontal LTR', () => {
    component.decks = [makeDeck()];
    fixture.componentRef.setInput('horizontal', true);
    fixture.componentRef.setInput('rightToLeft', false);
    fixture.detectChanges();
    const nose = fixture.nativeElement.querySelector('.jets-nose') as HTMLElement;
    expect(nose.style.transform).toBe('rotate(180deg)');
  });

  it('renders nose first, tail last in vertical mode', () => {
    component.decks = [makeDeck()];
    fixture.componentRef.setInput('horizontal', false);
    fixture.detectChanges();
    expect(blockOrder()).toEqual(['nose', 'fuselage', 'tail']);
  });

  it('swaps to tail first, nose last in horizontal LTR', () => {
    component.decks = [makeDeck()];
    fixture.componentRef.setInput('horizontal', true);
    fixture.componentRef.setInput('rightToLeft', false);
    fixture.detectChanges();
    expect(blockOrder()).toEqual(['tail', 'fuselage', 'nose']);
  });
});
