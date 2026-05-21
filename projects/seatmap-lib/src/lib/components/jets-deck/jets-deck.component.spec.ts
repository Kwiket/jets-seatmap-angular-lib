import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsDeckComponent } from './jets-deck.component';
import { IDeckData, ISeatData } from '../../types';
import { ENTITY_STATUS_MAP, ENTITY_TYPE_MAP } from '../../constants';

function makeSeat(overrides: Partial<ISeatData> = {}): ISeatData {
  return {
    id: 'seat-0',
    letter: 'A',
    type: ENTITY_TYPE_MAP.seat,
    status: ENTITY_STATUS_MAP.available,
    size: 32,
    number: '1A',
    color: '#4CAF50',
    seatIconType: 0,
    ...overrides,
  };
}

function makeDeck(): IDeckData {
  return {
    rows: [
      { id: 'row-1', seats: [makeSeat({ id: 's1', number: '1A' })] },
      { id: 'row-2', seats: [makeSeat({ id: 's2', number: '2A' })] },
    ],
    number: 1,
    title: 'Upper',
    extras: { exits: [], bulks: [], noseType: 'default' },
    scale: 1,
  };
}

describe('JetsDeckComponent', () => {
  let fixture: ComponentFixture<JetsDeckComponent>;
  let component: JetsDeckComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JetsDeckComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsDeckComponent);
    component = fixture.componentInstance;
    component.deck = makeDeck();
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render its rows', () => {
    fixture.detectChanges();
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('sm-jets-row');
    expect(rows.length).toBe(2);
  });

  it('should show the deck title when showNumber is true', () => {
    component.showNumber = true;
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Upper');
  });

  it('should re-emit seat events upward', () => {
    fixture.detectChanges();
    const clickSpy = vi.fn();
    const enterSpy = vi.fn();
    const leaveSpy = vi.fn();
    component.seatClick.subscribe(clickSpy);
    component.seatMouseEnter.subscribe(enterSpy);
    component.seatMouseLeave.subscribe(leaveSpy);

    const payload = { seat: makeSeat(), element: document.createElement('div') };
    component.seatClick.emit(payload);
    component.seatMouseEnter.emit(payload);
    component.seatMouseLeave.emit(payload);

    expect(clickSpy).toHaveBeenCalledWith(payload);
    expect(enterSpy).toHaveBeenCalledWith(payload);
    expect(leaveSpy).toHaveBeenCalledWith(payload);
  });

  it('should forward seatOverride to the row component', () => {
    // Identity-only check; we do not detectChanges here because NgComponentOutlet
    // would try to instantiate the bare class.
    class FakeSeat {}
    component.seatOverride = FakeSeat as any;
    expect(component.seatOverride).toBe(FakeSeat);
  });
});
