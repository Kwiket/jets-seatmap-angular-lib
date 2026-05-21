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
});
