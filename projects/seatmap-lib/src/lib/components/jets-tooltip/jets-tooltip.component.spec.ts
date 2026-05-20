import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsTooltipComponent } from './jets-tooltip.component';
import { ISeatData, ITooltipData, IPassenger } from '../../types';
import { SEAT_STATUS_MAP, SEAT_TYPE_MAP } from '../../constants';

function makeSeat(overrides: Partial<ISeatData> = {}): ISeatData {
  return {
    id: 'seat-0-0',
    letter: 'A',
    type: SEAT_TYPE_MAP.seat,
    status: SEAT_STATUS_MAP.available,
    size: 32,
    number: '1A',
    color: '#4CAF50',
    seatIconType: 0,
    features: [],
    ...overrides,
  };
}

function makeTooltipData(overrides: Partial<ITooltipData> = {}): ITooltipData {
  return {
    seat: makeSeat(),
    top: 100,
    left: 50,
    nextPassenger: { id: 'p1', passengerLabel: 'John' },
    lang: 'EN',
    ...overrides,
  };
}

describe('JetsTooltipComponent', () => {
  let fixture: ComponentFixture<JetsTooltipComponent>;
  let component: JetsTooltipComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JetsTooltipComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsTooltipComponent);
    component = fixture.componentInstance;
  });

  // ─── Rendering ─────────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('should create the component', () => {
      component.data = makeTooltipData();
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('should display seat number in header', () => {
      component.data = makeTooltipData({ seat: makeSeat({ number: '14B' }) });
      fixture.detectChanges();

      const header = fixture.nativeElement.querySelector('.jets-tooltip--header-title');
      expect(header?.textContent).toContain('14B');
    });

    it('should position tooltip at correct top offset', () => {
      component.data = makeTooltipData({ top: 200 });
      fixture.detectChanges();

      const tooltip = fixture.nativeElement.querySelector('.jets-tooltip') as HTMLElement;
      expect(tooltip.style.top).toBe('200px');
    });

    it('should show Cancel and Select buttons', () => {
      component.data = makeTooltipData();
      component.isSelectAvailable = true;
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('.jets-btn');
      expect(buttons.length).toBe(2);
      expect(buttons[0].textContent.trim()).toBe('Cancel');
      expect(buttons[1].textContent.trim()).toBe('Select');
    });

    it('should show Unselect button when passenger is assigned', () => {
      component.data = makeTooltipData({
        seat: makeSeat({
          passenger: { id: 'p1', abbr: 'JD', passengerLabel: 'John' },
        }),
      });
      fixture.detectChanges();

      const selectBtn = fixture.nativeElement.querySelector('.jets-select-btn');
      expect(selectBtn?.textContent?.trim()).toBe('Unselect');
    });

    it('should disable Select when isSelectAvailable is false', () => {
      component.data = makeTooltipData();
      component.isSelectAvailable = false;
      fixture.detectChanges();

      const selectBtn = fixture.nativeElement.querySelector(
        '.jets-select-btn',
      ) as HTMLButtonElement;
      expect(selectBtn?.disabled).toBe(true);
    });
  });

  // ─── Amenities ─────────────────────────────────────────────────────────

  describe('Amenities', () => {
    it('should display amenities from seat features', () => {
      component.data = makeTooltipData({
        seat: makeSeat({
          features: [
            { title: 'Wi-Fi enabled', icon: 'wifi' },
            { title: 'Power outlet', icon: 'power' },
          ],
        }),
      });
      fixture.detectChanges();

      const amenities = fixture.nativeElement.querySelectorAll('.jets-tooltip--amenity');
      expect(amenities.length).toBe(2);
    });

    it('should separate amenities from dimensions', () => {
      component.data = makeTooltipData({
        seat: makeSeat({
          features: [
            { title: 'Wi-Fi', icon: 'wifi' },
            { title: 'Seat pitch', value: '32"', key: 'pitch' },
          ],
        }),
      });
      fixture.detectChanges();

      expect(component.amenities).toHaveLength(1);
      expect(component.dimensions).toHaveLength(1);
    });

    it('should mark negative amenities with CSS class', () => {
      component.data = makeTooltipData({
        seat: makeSeat({
          features: [{ title: 'Close to galleys', icon: 'negative', negative: true }],
        }),
      });
      fixture.detectChanges();

      const negative = fixture.nativeElement.querySelector('.jets-tooltip--amenity-negative');
      expect(negative).toBeTruthy();
    });

    it('should show no amenities section when features are empty', () => {
      component.data = makeTooltipData({ seat: makeSeat({ features: [] }) });
      fixture.detectChanges();

      const amenities = fixture.nativeElement.querySelector('.jets-tooltip--amenities');
      expect(amenities).toBeNull();
    });
  });

  // ─── Dimensions ────────────────────────────────────────────────────────

  describe('Dimensions', () => {
    it('should display pitch/width/recline dimensions', () => {
      component.data = makeTooltipData({
        seat: makeSeat({
          features: [
            { title: 'Seat pitch', value: '32"', key: 'pitch' },
            { title: 'Seat width', value: '18"', key: 'width' },
            { title: 'Seat recline', value: '5"', key: 'recline' },
          ],
        }),
      });
      fixture.detectChanges();

      const dims = fixture.nativeElement.querySelectorAll('.jets-tooltip--dimension');
      expect(dims.length).toBe(3);

      const values = Array.from(dims).map((d: any) =>
        d.querySelector('.jets-tooltip--dim-value')?.textContent?.trim(),
      );
      expect(values).toContain('32"');
      expect(values).toContain('18"');
      expect(values).toContain('5"');
    });

    it('should use short label when available', () => {
      component.data = makeTooltipData({
        seat: makeSeat({
          features: [{ title: 'Seat pitch', value: '32"', key: 'pitch' }],
        }),
      });
      // EN locale has 'pitchShort' = 'Pitch'
      const label = component.getDimLabel({ title: 'Seat pitch', key: 'pitch', value: '32"' });
      expect(label).toBe('Pitch');
    });
  });

  // ─── Output events ────────────────────────────────────────────────────

  describe('Output events', () => {
    it('should emit close when Cancel is clicked', () => {
      component.data = makeTooltipData();
      fixture.detectChanges();

      const spy = vi.fn();
      component.close.subscribe(spy);

      const cancelBtn = fixture.nativeElement.querySelector('.jets-cancel-btn') as HTMLElement;
      cancelBtn.click();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should emit select when Select is clicked', () => {
      component.data = makeTooltipData();
      component.isSelectAvailable = true;
      fixture.detectChanges();

      const spy = vi.fn();
      component.select.subscribe(spy);

      const selectBtn = fixture.nativeElement.querySelector('.jets-select-btn') as HTMLElement;
      selectBtn.click();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].number).toBe('1A');
    });

    it('should emit unselect when Unselect is clicked on assigned seat', () => {
      component.data = makeTooltipData({
        seat: makeSeat({
          passenger: { id: 'p1', abbr: 'JD', passengerLabel: 'John' },
        }),
      });
      fixture.detectChanges();

      const spy = vi.fn();
      component.unselect.subscribe(spy);

      const unselectBtn = fixture.nativeElement.querySelector('.jets-select-btn') as HTMLElement;
      unselectBtn.click();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Localization ──────────────────────────────────────────────────────

  describe('Localization', () => {
    it('should show English labels by default', () => {
      component.data = makeTooltipData({ lang: 'EN' });
      fixture.detectChanges();

      const cancelBtn = fixture.nativeElement.querySelector('.jets-cancel-btn');
      expect(cancelBtn?.textContent?.trim()).toBe('Cancel');
    });

    it('should show Russian labels when lang is RU', () => {
      component.data = makeTooltipData({ lang: 'RU' as any });
      fixture.detectChanges();

      const cancelBtn = fixture.nativeElement.querySelector('.jets-cancel-btn');
      expect(cancelBtn?.textContent?.trim()).toBe('Отмена');
    });

    it('should show German labels when lang is DE', () => {
      component.data = makeTooltipData({ lang: 'DE' as any });
      fixture.detectChanges();

      const cancelBtn = fixture.nativeElement.querySelector('.jets-cancel-btn');
      expect(cancelBtn?.textContent?.trim()).toBe('Abbrechen');
    });
  });

  // ─── Passenger type restrictions ───────────────────────────────────────

  describe('Passenger type restrictions', () => {
    it('should disable select when passenger type does not match seat restriction', () => {
      component.data = makeTooltipData({
        seat: makeSeat({ passengerTypes: ['ADT'] }),
        nextPassenger: { id: 'p1', passengerType: 'CHD', passengerLabel: 'Child' },
      });
      component.isSelectAvailable = true;

      expect(component.isSelectDisabled()).toBe(true);
    });

    it('should enable select when passenger type matches', () => {
      component.data = makeTooltipData({
        seat: makeSeat({ passengerTypes: ['ADT'] }),
        nextPassenger: { id: 'p1', passengerType: 'ADT', passengerLabel: 'Adult' },
      });
      component.isSelectAvailable = true;

      expect(component.isSelectDisabled()).toBe(false);
    });

    it('should enable select when seat has no type restrictions', () => {
      component.data = makeTooltipData({
        seat: makeSeat({ passengerTypes: undefined }),
        nextPassenger: { id: 'p1', passengerType: 'CHD', passengerLabel: 'Child' },
      });
      component.isSelectAvailable = true;

      expect(component.isSelectDisabled()).toBe(false);
    });
  });
});
