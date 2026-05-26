import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsSeatComponent } from './jets-seat.component';
import { ISeatData } from '../../types';
import { ENTITY_STATUS_MAP, ENTITY_TYPE_MAP, SEAT_SIZE_BY_TYPE } from '../../constants';

function makeSeat(overrides: Partial<ISeatData> = {}): ISeatData {
  return {
    id: 'seat-0-0',
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

describe('JetsSeatComponent', () => {
  let fixture: ComponentFixture<JetsSeatComponent>;
  let component: JetsSeatComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JetsSeatComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsSeatComponent);
    component = fixture.componentInstance;
  });

  // ─── Rendering with various props ──────────────────────────────────────

  describe('Rendering', () => {
    it('should create the component', () => {
      component.data = makeSeat();
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('should render seat number', () => {
      component.data = makeSeat({ number: '12C' });
      fixture.detectChanges();

      const numberEl = fixture.nativeElement.querySelector('.jets-seat__number');
      expect(numberEl?.textContent?.trim()).toBe('12C');
    });

    it('should render SVG container for seat type', () => {
      component.data = makeSeat();
      // Manually trigger ngOnChanges since TestBed doesn't call it for direct input assignment
      component.ngOnChanges();
      fixture.detectChanges();

      const svgEl = fixture.nativeElement.querySelector('.jets-seat__svg');
      expect(svgEl).toBeTruthy();
      expect(component.svgContent).toBeTruthy();
    });

    it('should not render content for aisle type', () => {
      component.data = makeSeat({ type: ENTITY_TYPE_MAP.aisle, letter: '' });
      fixture.detectChanges();

      const numberEl = fixture.nativeElement.querySelector('.jets-seat__number');
      expect(numberEl).toBeNull();
    });

    it('should not render content for empty type', () => {
      component.data = makeSeat({ type: ENTITY_TYPE_MAP.empty, letter: '' });
      fixture.detectChanges();

      const numberEl = fixture.nativeElement.querySelector('.jets-seat__number');
      expect(numberEl).toBeNull();
    });

    it('should render passenger badge when passenger is assigned', () => {
      component.data = makeSeat({
        status: ENTITY_STATUS_MAP.selected,
        passenger: { id: 'p1', abbr: 'JD', passengerLabel: 'John Doe' },
      });
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.jets-seat__passenger');
      expect(badge).toBeTruthy();
      expect(badge.textContent.trim()).toBe('JD');
    });

    it('should not render passenger badge when no passenger', () => {
      component.data = makeSeat();
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.jets-seat__passenger');
      expect(badge).toBeNull();
    });
  });

  // ─── CSS classes ──────────────────────────────────────────────────────

  describe('CSS classes', () => {
    it('should include seat type class', () => {
      component.data = makeSeat({ type: ENTITY_TYPE_MAP.seat });
      expect(component.seatClasses).toContain('jets-seat--seat');
    });

    it('should include seat status class', () => {
      component.data = makeSeat({ status: ENTITY_STATUS_MAP.available });
      expect(component.seatClasses).toContain('jets-seat--available');
    });

    it('should apply rotation via inline transform when rotation set', () => {
      component.data = makeSeat({ rotation: 'ne' });
      expect(component.seatTransform).toContain('rotate(20deg)');
    });

    it('should not include rotation class when no rotation', () => {
      component.data = makeSeat({ rotation: '' });
      expect(component.seatClasses).not.toContain('jets-seat--r-');
    });

    it('should reflect unavailable status', () => {
      component.data = makeSeat({ status: ENTITY_STATUS_MAP.unavailable });
      expect(component.seatClasses).toContain('jets-seat--unavailable');
    });

    it('should reflect selected status', () => {
      component.data = makeSeat({ status: ENTITY_STATUS_MAP.selected });
      expect(component.seatClasses).toContain('jets-seat--selected');
    });
  });

  // ─── Dimensions ───────────────────────────────────────────────────────

  describe('Dimensions', () => {
    it('should use data.size as width', () => {
      component.data = makeSeat({ size: 48 });
      expect(component.seatWidth).toBe(48);
    });

    it('should calculate height from native height × scale for seat type', () => {
      const [, h] = SEAT_SIZE_BY_TYPE[0]; // [100, 100]
      component.scale = 0.5;
      component.data = makeSeat({ size: 50, seatIconType: 0 });
      expect(component.seatHeight).toBe(Math.round(h * 0.5));
    });

    it('should use height=1 for aisle type', () => {
      component.data = makeSeat({ type: ENTITY_TYPE_MAP.aisle, size: 20 });
      expect(component.seatHeight).toBe(1);
    });

    it('should use data.size for empty type', () => {
      component.data = makeSeat({ type: ENTITY_TYPE_MAP.empty, size: 30 });
      expect(component.seatHeight).toBe(30);
    });

    it('should handle different seat icon types with native height × scale', () => {
      const [, h1] = SEAT_SIZE_BY_TYPE[1]; // [122, 218]
      component.scale = 0.25;
      component.data = makeSeat({ size: 40, seatIconType: 1 });
      expect(component.seatHeight).toBe(Math.round(h1 * 0.25));
    });
  });

  // ─── Click events ─────────────────────────────────────────────────────

  describe('Click events', () => {
    it('should emit seatClick for available seat', () => {
      component.data = makeSeat({ status: ENTITY_STATUS_MAP.available });
      fixture.detectChanges();

      const spy = vi.fn();
      component.seatClick.subscribe(spy);

      const seatEl = fixture.nativeElement.querySelector('.jets-seat');
      seatEl.click();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].seat.number).toBe('1A');
    });

    it('should emit seatClick for selected seat', () => {
      component.data = makeSeat({ status: ENTITY_STATUS_MAP.selected });
      fixture.detectChanges();

      const spy = vi.fn();
      component.seatClick.subscribe(spy);

      fixture.nativeElement.querySelector('.jets-seat').click();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should NOT emit seatClick for unavailable seat', () => {
      component.data = makeSeat({ status: ENTITY_STATUS_MAP.unavailable });
      fixture.detectChanges();

      const spy = vi.fn();
      component.seatClick.subscribe(spy);

      fixture.nativeElement.querySelector('.jets-seat').click();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should NOT emit seatClick for disabled seat', () => {
      component.data = makeSeat({ status: ENTITY_STATUS_MAP.disabled });
      fixture.detectChanges();

      const spy = vi.fn();
      component.seatClick.subscribe(spy);

      fixture.nativeElement.querySelector('.jets-seat').click();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should NOT emit seatClick for aisle', () => {
      component.data = makeSeat({ type: ENTITY_TYPE_MAP.aisle });
      fixture.detectChanges();

      const spy = vi.fn();
      component.seatClick.subscribe(spy);

      fixture.nativeElement.querySelector('.jets-seat').click();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should emit seatClick for preferred seat', () => {
      component.data = makeSeat({ status: ENTITY_STATUS_MAP.preferred });
      fixture.detectChanges();

      const spy = vi.fn();
      component.seatClick.subscribe(spy);

      fixture.nativeElement.querySelector('.jets-seat').click();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should emit seatClick for extra seat', () => {
      component.data = makeSeat({ status: ENTITY_STATUS_MAP.extra });
      fixture.detectChanges();

      const spy = vi.fn();
      component.seatClick.subscribe(spy);

      fixture.nativeElement.querySelector('.jets-seat').click();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Mouse events ─────────────────────────────────────────────────────

  describe('Mouse events', () => {
    it('should emit seatMouseEnter for available seat', () => {
      component.data = makeSeat({ status: ENTITY_STATUS_MAP.available });
      fixture.detectChanges();

      const spy = vi.fn();
      component.seatMouseEnter.subscribe(spy);

      const seatEl = fixture.nativeElement.querySelector('.jets-seat');
      seatEl.dispatchEvent(new MouseEvent('mouseenter'));

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should emit seatMouseLeave for available seat', () => {
      component.data = makeSeat({ status: ENTITY_STATUS_MAP.available });
      fixture.detectChanges();

      const spy = vi.fn();
      component.seatMouseLeave.subscribe(spy);

      const seatEl = fixture.nativeElement.querySelector('.jets-seat');
      seatEl.dispatchEvent(new MouseEvent('mouseleave'));

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should NOT emit mouse events for unavailable seat', () => {
      component.data = makeSeat({ status: ENTITY_STATUS_MAP.unavailable });
      fixture.detectChanges();

      const enterSpy = vi.fn();
      const leaveSpy = vi.fn();
      component.seatMouseEnter.subscribe(enterSpy);
      component.seatMouseLeave.subscribe(leaveSpy);

      const seatEl = fixture.nativeElement.querySelector('.jets-seat');
      seatEl.dispatchEvent(new MouseEvent('mouseenter'));
      seatEl.dispatchEvent(new MouseEvent('mouseleave'));

      expect(enterSpy).not.toHaveBeenCalled();
      expect(leaveSpy).not.toHaveBeenCalled();
    });
  });

  // ─── Title attribute ──────────────────────────────────────────────────

  describe('Title attribute', () => {
    it('should show seat number in title', () => {
      component.data = makeSeat({ number: '5F' });
      expect(component.seatTitle).toContain('5F');
    });

    it('should include price in title when set', () => {
      component.data = makeSeat({ number: '5F', price: 120, currency: 'USD' });
      expect(component.seatTitle).toContain('USD 120');
    });

    it('should return empty title for non-seat types', () => {
      component.data = makeSeat({ type: ENTITY_TYPE_MAP.aisle });
      expect(component.seatTitle).toBe('');
    });
  });

  // ─── Transform ────────────────────────────────────────────────────────

  describe('Transform', () => {
    it('should return empty string when no offsets', () => {
      component.data = makeSeat();
      component.scale = 1;
      expect(component.seatTransform).toBe('');
    });

    it('should apply translate when offsets are set', () => {
      component.data = makeSeat({ leftOffset: 10, topOffset: 20 });
      component.scale = 2;
      expect(component.seatTransform).toBe('translate(20px, 40px)');
    });
  });

  // ─── Price label ──────────────────────────────────────────────────────
  //
  // showPrice (driven by config.visibleSeatPriceLabels) toggles a per-seat
  // overlay. The label renders only for available seats that carry a price.
  // currencyOverride (config.currencySign) wins over the seat's own currency.

  describe('Price label', () => {
    it('renders price + currency when showPrice is true and seat is available with a price', () => {
      component.data = makeSeat({
        status: ENTITY_STATUS_MAP.available,
        price: 42,
        currency: 'USD',
      });
      component.showPrice = true;
      fixture.detectChanges();

      const priceEl = fixture.nativeElement.querySelector('.jets-seat__price');
      expect(priceEl).toBeTruthy();
      expect(priceEl.textContent.replace(/\s+/g, '')).toBe('USD42');
      expect(priceEl.querySelector('.currency')?.textContent).toBe('USD');
    });

    it('does not render when showPrice is false', () => {
      component.data = makeSeat({ status: ENTITY_STATUS_MAP.available, price: 42, currency: 'USD' });
      component.showPrice = false;
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.jets-seat__price')).toBeNull();
    });

    it('does not render when seat has no price', () => {
      component.data = makeSeat({ status: ENTITY_STATUS_MAP.available, currency: 'USD' });
      component.showPrice = true;
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.jets-seat__price')).toBeNull();
    });

    it('does not render for non-available seats', () => {
      component.data = makeSeat({
        status: ENTITY_STATUS_MAP.unavailable,
        price: 42,
        currency: 'USD',
      });
      component.showPrice = true;
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.jets-seat__price')).toBeNull();
    });

    it('currencyOverride wins over seat.currency', () => {
      component.data = makeSeat({
        status: ENTITY_STATUS_MAP.available,
        price: 42,
        currency: 'USD',
      });
      component.showPrice = true;
      component.currencyOverride = '€';
      fixture.detectChanges();

      const currencyEl = fixture.nativeElement.querySelector('.jets-seat__price .currency');
      expect(currencyEl?.textContent).toBe('€');
    });

    it('falls back to empty string when neither override nor seat currency is set', () => {
      component.data = makeSeat({
        status: ENTITY_STATUS_MAP.available,
        price: 42,
        currency: undefined as unknown as string,
      });
      component.showPrice = true;
      fixture.detectChanges();

      const currencyEl = fixture.nativeElement.querySelector('.jets-seat__price .currency');
      expect(currencyEl?.textContent).toBe('');
    });
  });

  // ─── Touch interactions ───────────────────────────────────────────────
  //
  // The seat element binds only (click)/(mouseenter)/(mouseleave). Mobile
  // browsers synthesize a `click` after a short tap, so the user's tap is
  // observed through that synthesized click. These tests verify the component
  // tolerates raw touch events (no listener, no emits, no crash) and that the
  // synthesized click path emits `seatClick` for interactive seats but not for
  // unavailable/disabled ones.

  describe('Touch interactions', () => {
    function dispatchTouchStart(target: Element): boolean {
      // jsdom supports TouchEvent in recent versions; fall back to a generic
      // Event when the constructor is unavailable.
      let evt: Event;
      const TouchEventCtor = (globalThis as unknown as { TouchEvent?: typeof Event }).TouchEvent;
      if (typeof TouchEventCtor === 'function') {
        try {
          evt = new TouchEventCtor('touchstart', { bubbles: true });
        } catch {
          evt = new Event('touchstart', { bubbles: true });
        }
      } else {
        evt = new Event('touchstart', { bubbles: true });
      }
      return target.dispatchEvent(evt);
    }

    it('does not crash or emit on bare touchstart (no touchstart listener wired)', () => {
      component.data = makeSeat({ status: ENTITY_STATUS_MAP.available });
      fixture.detectChanges();

      const clickSpy = vi.fn();
      const enterSpy = vi.fn();
      const leaveSpy = vi.fn();
      component.seatClick.subscribe(clickSpy);
      component.seatMouseEnter.subscribe(enterSpy);
      component.seatMouseLeave.subscribe(leaveSpy);

      const seatEl = fixture.nativeElement.querySelector('.jets-seat') as HTMLElement;

      expect(() => dispatchTouchStart(seatEl)).not.toThrow();

      expect(clickSpy).not.toHaveBeenCalled();
      expect(enterSpy).not.toHaveBeenCalled();
      expect(leaveSpy).not.toHaveBeenCalled();
    });

    it('emits seatClick when a synthesized click follows a tap on an available seat', () => {
      component.data = makeSeat({ status: ENTITY_STATUS_MAP.available });
      fixture.detectChanges();

      const spy = vi.fn();
      component.seatClick.subscribe(spy);

      const seatEl = fixture.nativeElement.querySelector('.jets-seat') as HTMLElement;
      dispatchTouchStart(seatEl);
      seatEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(spy).toHaveBeenCalledTimes(1);
      const payload = spy.mock.calls[0][0];
      expect(payload.seat.number).toBe('1A');
      expect(payload.event).toBeInstanceOf(MouseEvent);
    });

    it('does NOT emit seatClick when tap → click lands on a disabled seat', () => {
      component.data = makeSeat({ status: ENTITY_STATUS_MAP.disabled });
      fixture.detectChanges();

      const spy = vi.fn();
      component.seatClick.subscribe(spy);

      const seatEl = fixture.nativeElement.querySelector('.jets-seat') as HTMLElement;
      dispatchTouchStart(seatEl);
      seatEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(spy).not.toHaveBeenCalled();
    });
  });
});
