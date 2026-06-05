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

  describe('ARIA grid host (commit 6)', () => {
    it('should set role="grid" on the host element', () => {
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).getAttribute('role')).toBe('grid');
    });

    it('should set aria-rowcount to rows.length and aria-colcount to max seats-per-row', () => {
      component.deck = {
        rows: [
          { id: 'r1', seats: [makeSeat({ id: 's1' }), makeSeat({ id: 's2' }), makeSeat({ id: 's3' })] },
          { id: 'r2', seats: [makeSeat({ id: 's4' }), makeSeat({ id: 's5' })] },
          { id: 'r3', seats: [makeSeat({ id: 's6' }), makeSeat({ id: 's7' }), makeSeat({ id: 's8' }), makeSeat({ id: 's9' })] },
        ],
        number: 1,
        scale: 1,
      };
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.getAttribute('aria-rowcount')).toBe('3');
      expect(host.getAttribute('aria-colcount')).toBe('4');
    });

    it('should include the deck title in aria-label', () => {
      fixture.detectChanges();
      const label = (fixture.nativeElement as HTMLElement).getAttribute('aria-label') ?? '';
      expect(label).toContain('Upper');
    });

    it('should pass rowIndex (1-based) to each sm-jets-row', () => {
      component.deck = {
        rows: [
          { id: 'r1', seats: [makeSeat({ id: 's1' })] },
          { id: 'r2', seats: [makeSeat({ id: 's2' })] },
        ],
        number: 1,
        scale: 1,
      };
      fixture.detectChanges();
      const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('sm-jets-row');
      // Each row sets aria-rowindex via host binding in JetsRowComponent (commit 6).
      expect(rows[0].getAttribute('aria-rowindex')).toBe('1');
      expect(rows[1].getAttribute('aria-rowindex')).toBe('2');
    });
  });
});
