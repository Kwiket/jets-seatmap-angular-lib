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
    it('renders a pill with the first currency character + price for a priced seat', () => {
      component.data = makeSeat({
        status: ENTITY_STATUS_MAP.available,
        price: 42,
        currency: 'USD',
      });
      component.showPrice = true;
      fixture.detectChanges();

      const priceEl = fixture.nativeElement.querySelector('.jets-seat__price');
      expect(priceEl).toBeTruthy();
      // Matches React SeatPriceLabel: first char of currency in <strong>, price in <span>.
      expect(priceEl.querySelector('.currency')?.textContent).toBe('U');
      expect(priceEl.querySelector('.priceValue')?.textContent).toBe('42');
      expect(priceEl.getAttribute('title')).toBe('USD42');
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

    it('renders for non-available priced seats too (matches React)', () => {
      // React's showSeatPriceLabel is `price && config.visibleSeatPriceLabels` —
      // status is not part of the gate, so unavailable/selected/preferred all
      // show the pill when they carry a price.
      component.data = makeSeat({
        status: ENTITY_STATUS_MAP.unavailable,
        price: 42,
        currency: 'USD',
      });
      component.showPrice = true;
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.jets-seat__price')).toBeTruthy();
    });

    it('currencyOverride wins over seat.currency (first char only)', () => {
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

    it('falls back to "*" placeholder when neither override nor seat currency is set', () => {
      component.data = makeSeat({
        status: ENTITY_STATUS_MAP.available,
        price: 42,
        currency: undefined as unknown as string,
      });
      component.showPrice = true;
      fixture.detectChanges();

      const currencyEl = fixture.nativeElement.querySelector('.jets-seat__price .currency');
      expect(currencyEl?.textContent).toBe('*');
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

  // ─── ARIA semantics (commit 5) ────────────────────────────────────────
  //
  // Commit 5 makes every seat a real <button> so screen readers identify it
  // correctly and keyboard activation (Enter/Space) works natively. Non-seat
  // cells (aisle/empty/index) stay as <div> because they aren't interactive.

  describe('ARIA semantics', () => {
    it('renders a <button> for seat cells and a <div> for aisle/empty cells', () => {
      component.data = makeSeat({ type: ENTITY_TYPE_MAP.seat });
      fixture.detectChanges();
      let root = fixture.nativeElement.querySelector('.jets-seat');
      expect(root?.tagName).toBe('BUTTON');
      expect(root.getAttribute('type')).toBe('button');

      // Re-mount with a non-interactive cell.
      fixture = TestBed.createComponent(JetsSeatComponent);
      component = fixture.componentInstance;
      component.data = makeSeat({ type: ENTITY_TYPE_MAP.aisle, letter: '' });
      fixture.detectChanges();
      root = fixture.nativeElement.querySelector('.jets-seat');
      expect(root?.tagName).toBe('DIV');
    });

    it('preserves the .jets-seat class on the button (regression guard)', () => {
      component.data = makeSeat();
      fixture.detectChanges();
      const root = fixture.nativeElement.querySelector('button.jets-seat');
      expect(root).toBeTruthy();
    });

    it('preserves data-seat-number on the button (regression guard for _jumpToSeat)', () => {
      component.data = makeSeat({ number: '7C' });
      fixture.detectChanges();
      const root = fixture.nativeElement.querySelector('button.jets-seat');
      expect(root?.getAttribute('data-seat-number')).toBe('7C');
    });

    it('reflects ariaLabel input as the aria-label attribute', () => {
      component.data = makeSeat();
      component.ariaLabel = 'Seat 1A, Economy, available';
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('button.jets-seat');
      expect(btn.getAttribute('aria-label')).toBe('Seat 1A, Economy, available');
    });

    it('omits aria-label when the input is empty/undefined', () => {
      component.data = makeSeat();
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('button.jets-seat');
      expect(btn.hasAttribute('aria-label')).toBe(false);
    });

    it('reflects ariaSelected when explicitly set (true / false), omits when null', () => {
      // OnPush change-detection: use setInput so the binding re-evaluates
      // on subsequent value changes.
      fixture.componentRef.setInput('data', makeSeat());
      fixture.componentRef.setInput('ariaSelected', true);
      fixture.detectChanges();
      let btn = fixture.nativeElement.querySelector('button.jets-seat');
      expect(btn.getAttribute('aria-selected')).toBe('true');

      fixture.componentRef.setInput('ariaSelected', false);
      fixture.detectChanges();
      btn = fixture.nativeElement.querySelector('button.jets-seat');
      expect(btn.getAttribute('aria-selected')).toBe('false');

      fixture.componentRef.setInput('ariaSelected', null);
      fixture.detectChanges();
      btn = fixture.nativeElement.querySelector('button.jets-seat');
      expect(btn.hasAttribute('aria-selected')).toBe(false);
    });

    it('reflects ariaDisabled as aria-disabled="true" and never sets native disabled', () => {
      component.data = makeSeat();
      component.ariaDisabled = true;
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('button.jets-seat') as HTMLButtonElement;
      expect(btn.getAttribute('aria-disabled')).toBe('true');
      // Critical: native `disabled` removes focusability and would break the
      // grid roving tabindex landing in commits 6/7.
      expect(btn.hasAttribute('disabled')).toBe(false);
      expect(btn.disabled).toBe(false);
    });

    it('defaults tabindex to 0 and honours rovingTabindex when supplied', () => {
      fixture.componentRef.setInput('data', makeSeat());
      fixture.detectChanges();
      let btn = fixture.nativeElement.querySelector('button.jets-seat');
      expect(btn.getAttribute('tabindex')).toBe('0');

      fixture.componentRef.setInput('rovingTabindex', -1);
      fixture.detectChanges();
      btn = fixture.nativeElement.querySelector('button.jets-seat');
      expect(btn.getAttribute('tabindex')).toBe('-1');
    });

    it('reflects colIndex/rowIndex as aria-colindex/aria-rowindex when set', () => {
      component.data = makeSeat();
      component.colIndex = 3;
      component.rowIndex = 5;
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('button.jets-seat');
      expect(btn.getAttribute('aria-colindex')).toBe('3');
      expect(btn.getAttribute('aria-rowindex')).toBe('5');
    });

    it('omits aria-colindex / aria-rowindex when not supplied', () => {
      component.data = makeSeat();
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('button.jets-seat');
      expect(btn.hasAttribute('aria-colindex')).toBe(false);
      expect(btn.hasAttribute('aria-rowindex')).toBe(false);
    });

    it('does NOT emit seatClick when ariaDisabled=true even on an otherwise interactive seat', () => {
      component.data = makeSeat({ status: ENTITY_STATUS_MAP.available });
      component.ariaDisabled = true;
      fixture.detectChanges();

      const spy = vi.fn();
      component.seatClick.subscribe(spy);

      const btn = fixture.nativeElement.querySelector('button.jets-seat') as HTMLButtonElement;
      btn.click();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does NOT emit mouse events when ariaDisabled=true', () => {
      component.data = makeSeat({ status: ENTITY_STATUS_MAP.available });
      component.ariaDisabled = true;
      fixture.detectChanges();

      const enterSpy = vi.fn();
      const leaveSpy = vi.fn();
      component.seatMouseEnter.subscribe(enterSpy);
      component.seatMouseLeave.subscribe(leaveSpy);

      const btn = fixture.nativeElement.querySelector('button.jets-seat') as HTMLButtonElement;
      btn.dispatchEvent(new MouseEvent('mouseenter'));
      btn.dispatchEvent(new MouseEvent('mouseleave'));

      expect(enterSpy).not.toHaveBeenCalled();
      expect(leaveSpy).not.toHaveBeenCalled();
    });
  });

  // ─── colorfulSeatsByClass ─────────────────────────────────────────────
  //
  // When the flag is off, every available seat picks up the same theme
  // colour regardless of cabin class. When on, the per-class HSL tint
  // (or seatClassTints override) makes F / B / P / E visibly distinct.

  describe('colorfulSeatsByClass', () => {
    const THEME = { seatAvailableColor: '#888888', forceThemeSeatColors: true };

    function styleFor(
      classType: string,
      status: ISeatData['status'] = ENTITY_STATUS_MAP.available
    ): { fillColor: string } {
      component.colorTheme = THEME;
      component.data = makeSeat({ status, color: undefined, classType });
      // Access the private method to assert the colour decision directly,
      // without depending on which SVG template the seat-template-service
      // happens to pick for a given (class, iconType) pair.
      return (component as unknown as { _resolveStyle(c: string): { fillColor: string } })._resolveStyle(classType);
    }

    it('default (off) — economy and first share the same fill', () => {
      component.colorfulSeatsByClass = false;
      expect(styleFor('E').fillColor).toBe('#888888');
      expect(styleFor('F').fillColor).toBe('#888888');
    });

    it('on — economy renders a lighter tint, first a darker one', () => {
      component.colorfulSeatsByClass = true;
      const economy = styleFor('E').fillColor;
      const first = styleFor('F').fillColor;
      expect(economy).not.toBe('#888888');
      expect(first).not.toBe('#888888');
      expect(economy).not.toBe(first);
    });

    it('on — seatClassTints override beats the algorithmic tint', () => {
      component.colorfulSeatsByClass = true;
      component.colorTheme = { ...THEME, seatClassTints: { B: '#ff0000' } };
      component.data = makeSeat({
        status: ENTITY_STATUS_MAP.available,
        color: undefined,
        classType: 'B',
      });
      const style = (component as unknown as { _resolveStyle(c: string): { fillColor: string } })._resolveStyle('B');
      expect(style.fillColor).toBe('#ff0000');
    });

    it('on — unavailable seats are not tinted', () => {
      component.colorfulSeatsByClass = true;
      component.colorTheme = { ...THEME, seatUnavailableColor: '#cccccc' };
      component.data = makeSeat({
        status: ENTITY_STATUS_MAP.unavailable,
        color: undefined,
        classType: 'F',
      });
      const style = (component as unknown as { _resolveStyle(c: string): { fillColor: string } })._resolveStyle('F');
      expect(style.fillColor).toBe('#cccccc');
    });
  });

  // ─── Grid cell semantics (commit 6) ─────────────────────────────────────

  describe('Grid cell semantics (commit 6)', () => {
    it('sets role="gridcell" on the seat button', () => {
      component.data = makeSeat();
      fixture.detectChanges();
      const btn = (fixture.nativeElement as HTMLElement).querySelector('button.jets-seat');
      expect(btn?.getAttribute('role')).toBe('gridcell');
    });

    it('sets role="gridcell" on aisle / empty cells (div branch)', () => {
      component.data = makeSeat({ type: ENTITY_TYPE_MAP.aisle, number: undefined });
      fixture.detectChanges();
      const div = (fixture.nativeElement as HTMLElement).querySelector('div.jets-seat');
      expect(div?.getAttribute('role')).toBe('gridcell');
    });

    it('aisle gets localised aria-label (English fallback)', () => {
      component.data = makeSeat({ type: ENTITY_TYPE_MAP.aisle, number: undefined });
      fixture.detectChanges();
      const div = (fixture.nativeElement as HTMLElement).querySelector('div.jets-seat');
      expect(div?.getAttribute('aria-label')).toBe('aisle');
    });

    it('empty gets localised aria-label (English fallback)', () => {
      component.data = makeSeat({ type: ENTITY_TYPE_MAP.empty, number: undefined });
      fixture.detectChanges();
      const div = (fixture.nativeElement as HTMLElement).querySelector('div.jets-seat');
      expect(div?.getAttribute('aria-label')).toBe('empty');
    });

    it('index cell surfaces "Row {number}" when number is present', () => {
      component.data = makeSeat({ type: ENTITY_TYPE_MAP.index, number: '14' });
      fixture.detectChanges();
      const div = (fixture.nativeElement as HTMLElement).querySelector('div.jets-seat');
      expect(div?.getAttribute('aria-label')).toBe('Row 14');
    });

    it('non-seat cells have tabindex="-1" by default (reachable via arrow nav, not Tab)', () => {
      component.data = makeSeat({ type: ENTITY_TYPE_MAP.aisle });
      fixture.detectChanges();
      const div = (fixture.nativeElement as HTMLElement).querySelector('div.jets-seat');
      expect(div?.getAttribute('tabindex')).toBe('-1');
    });

    it('seat cells default to tabindex="0" (focusable via Tab); rovingTabindex input overrides', () => {
      component.data = makeSeat();
      fixture.detectChanges();
      let btn = (fixture.nativeElement as HTMLElement).querySelector('button.jets-seat');
      expect(btn?.getAttribute('tabindex')).toBe('0');

      // OnPush requires setInput to mark the view dirty.
      fixture.componentRef.setInput('rovingTabindex', -1);
      fixture.detectChanges();
      btn = (fixture.nativeElement as HTMLElement).querySelector('button.jets-seat');
      expect(btn?.getAttribute('tabindex')).toBe('-1');
    });
  });
});
