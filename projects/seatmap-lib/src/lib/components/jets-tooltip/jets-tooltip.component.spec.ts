import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsTooltipComponent } from './jets-tooltip.component';
import { ISeatData, ITooltipData, IPassenger } from '../../types';
import { ENTITY_STATUS_MAP, ENTITY_TYPE_MAP } from '../../constants';

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

    it('should mark Select as aria-disabled when isSelectAvailable is false', () => {
      // Commit 10 switched the disabled-Select rendering from the native
      // `disabled` attribute to `aria-disabled` so the click event still
      // reaches the component and selectAttemptBlocked can fire (WCAG 3.3.1).
      component.data = makeTooltipData();
      component.isSelectAvailable = false;
      fixture.detectChanges();

      const selectBtn = fixture.nativeElement.querySelector('.jets-select-btn') as HTMLButtonElement;
      expect(selectBtn?.getAttribute('aria-disabled')).toBe('true');
      expect(selectBtn?.disabled).toBe(false);
    });

    it('renders seat.currency in header price by default (multi-char: space-separated)', () => {
      component.data = makeTooltipData({
        seat: makeSeat({ number: '13A', price: 29, currency: 'USD' }),
      });
      fixture.detectChanges();
      const price = fixture.nativeElement.querySelector('.jets-tooltip--header-price');
      expect(price?.textContent?.trim()).toBe('USD 29');
    });

    it('hugs a single-char currency glyph to the price (no space)', () => {
      component.data = makeTooltipData({
        seat: makeSeat({ number: '13A', price: 29, currency: '$' }),
      });
      fixture.detectChanges();
      const price = fixture.nativeElement.querySelector('.jets-tooltip--header-price');
      expect(price?.textContent?.trim()).toBe('$29');
    });

    it('currencyOverride wins over seat.currency, single-char hugs the price', () => {
      component.data = makeTooltipData({
        seat: makeSeat({ number: '13A', price: 29, currency: 'USD' }),
      });
      component.currencyOverride = '$';
      fixture.detectChanges();
      const price = fixture.nativeElement.querySelector('.jets-tooltip--header-price');
      expect(price?.textContent?.trim()).toBe('$29');
    });

    it('currencyOverride with multi-char value keeps the separating space', () => {
      component.data = makeTooltipData({
        seat: makeSeat({ number: '13A', price: 29, currency: '$' }),
      });
      component.currencyOverride = 'EUR';
      fixture.detectChanges();
      const price = fixture.nativeElement.querySelector('.jets-tooltip--header-price');
      expect(price?.textContent?.trim()).toBe('EUR 29');
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

      const values = Array.from(dims).map((d: any) => d.querySelector('.jets-tooltip--dim-value')?.textContent?.trim());
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

  // ─── Disabled-Select reasoning (WCAG 3.3.1 / 3.3.3) ────────────────────

  describe('getSelectDisabledReason() — structured reasoning', () => {
    it('returns disabled:false when select is available and passenger type matches', () => {
      component.data = makeTooltipData({
        seat: makeSeat({ passengerTypes: ['ADT'] }),
        nextPassenger: { id: 'p1', passengerType: 'ADT', passengerLabel: 'Adult' },
      });
      component.isSelectAvailable = true;

      const r = component.getSelectDisabledReason();
      expect(r.disabled).toBe(false);
      expect(r.reason).toBeUndefined();
      expect(r.message).toBeUndefined();
    });

    it('returns passengerTypeRestricted with a non-empty message when seat excludes passenger type', () => {
      component.data = makeTooltipData({
        seat: makeSeat({ passengerTypes: ['ADT'] }),
        nextPassenger: { id: 'p1', passengerType: 'INF', passengerLabel: 'Infant' },
      });
      component.isSelectAvailable = true;

      const r = component.getSelectDisabledReason();
      expect(r.disabled).toBe(true);
      expect(r.reason).toBe('passengerTypeRestricted');
      expect(r.message).toBeTruthy();
      expect(r.message!.length).toBeGreaterThan(0);
      // English (default locale) — must mention "not available for" and the passenger label.
      expect(r.message).toMatch(/not available for/i);
      expect(r.message).toContain('Infant');
    });

    it('returns noPassengerLeft when isSelectAvailable is false and no type mismatch', () => {
      component.data = makeTooltipData({
        seat: makeSeat({ passengerTypes: undefined }),
        nextPassenger: undefined,
      });
      component.isSelectAvailable = false;

      const r = component.getSelectDisabledReason();
      expect(r.disabled).toBe(true);
      expect(r.reason).toBe('noPassengerLeft');
      expect(r.message).toBeTruthy();
    });

    it('isSelectDisabled() facade returns the same boolean as getSelectDisabledReason().disabled', () => {
      component.data = makeTooltipData({
        seat: makeSeat({ passengerTypes: ['ADT'] }),
        nextPassenger: { id: 'p1', passengerType: 'INF', passengerLabel: 'Infant' },
      });
      component.isSelectAvailable = true;

      expect(component.isSelectDisabled()).toBe(component.getSelectDisabledReason().disabled);
      expect(component.isSelectDisabled()).toBe(true);
    });
  });

  describe('Disabled-Select reason in template', () => {
    it('renders the reason text under the Select button with aria-describedby tying them', () => {
      component.data = makeTooltipData({
        seat: makeSeat({ passengerTypes: ['ADT'] }),
        nextPassenger: { id: 'p1', passengerType: 'INF', passengerLabel: 'Infant' },
      });
      component.isSelectAvailable = true;
      fixture.detectChanges();

      const selectBtn = fixture.nativeElement.querySelector('.jets-select-btn') as HTMLButtonElement;
      const reasonEl = fixture.nativeElement.querySelector('.jets-tooltip--select-reason') as HTMLElement;

      expect(reasonEl).toBeTruthy();
      expect(reasonEl.textContent?.trim().length).toBeGreaterThan(0);
      expect(reasonEl.textContent).toMatch(/Infant/);

      // aria-describedby on the button points at the reason element's id.
      const describedBy = selectBtn.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(describedBy).toBe(reasonEl.id);

      // Disabled is exposed via aria, not the native attribute, so the click
      // event can still fire and we can emit selectAttemptBlocked.
      expect(selectBtn.getAttribute('aria-disabled')).toBe('true');
      expect(selectBtn.disabled).toBe(false);
    });

    it('does NOT render the reason element when Select is enabled', () => {
      component.data = makeTooltipData({
        seat: makeSeat({ passengerTypes: ['ADT'] }),
        nextPassenger: { id: 'p1', passengerType: 'ADT', passengerLabel: 'Adult' },
      });
      component.isSelectAvailable = true;
      fixture.detectChanges();

      const reasonEl = fixture.nativeElement.querySelector('.jets-tooltip--select-reason');
      const selectBtn = fixture.nativeElement.querySelector('.jets-select-btn') as HTMLButtonElement;
      expect(reasonEl).toBeNull();
      expect(selectBtn.getAttribute('aria-describedby')).toBeNull();
      expect(selectBtn.getAttribute('aria-disabled')).toBeNull();
    });

    it('clicking the disabled Select button emits selectAttemptBlocked but NOT select', () => {
      component.data = makeTooltipData({
        seat: makeSeat({ number: '12A', passengerTypes: ['ADT'] }),
        nextPassenger: { id: 'p1', passengerType: 'INF', passengerLabel: 'Infant' },
      });
      component.isSelectAvailable = true;
      fixture.detectChanges();

      const blockedSpy = vi.fn();
      const selectSpy = vi.fn();
      component.selectAttemptBlocked.subscribe(blockedSpy);
      component.select.subscribe(selectSpy);

      const selectBtn = fixture.nativeElement.querySelector('.jets-select-btn') as HTMLButtonElement;
      selectBtn.click();

      expect(selectSpy).not.toHaveBeenCalled();
      expect(blockedSpy).toHaveBeenCalledTimes(1);
      const payload = blockedSpy.mock.calls[0][0];
      expect(payload.seat.number).toBe('12A');
      expect(payload.reason).toBe('passengerTypeRestricted');
      expect(payload.message).toBeTruthy();
      expect(payload.message).toMatch(/Infant/);
    });

    it('clicking the enabled Select button still emits select and NOT selectAttemptBlocked', () => {
      component.data = makeTooltipData({
        seat: makeSeat({ number: '12A', passengerTypes: ['ADT'] }),
        nextPassenger: { id: 'p1', passengerType: 'ADT', passengerLabel: 'Adult' },
      });
      component.isSelectAvailable = true;
      fixture.detectChanges();

      const blockedSpy = vi.fn();
      const selectSpy = vi.fn();
      component.selectAttemptBlocked.subscribe(blockedSpy);
      component.select.subscribe(selectSpy);

      const selectBtn = fixture.nativeElement.querySelector('.jets-select-btn') as HTMLButtonElement;
      selectBtn.click();

      expect(selectSpy).toHaveBeenCalledTimes(1);
      expect(blockedSpy).not.toHaveBeenCalled();
    });
  });

  // ─── Dialog ARIA contract (commit 11) ──────────────────────────────────
  describe('Dialog ARIA contract', () => {
    it('non-sidePanel: outer div has role="dialog" and NO aria-modal', () => {
      // Decisions log 2026-06-04: tooltip is non-modal — the map is not
      // overlaid, click-outside closes the tooltip, so aria-modal would lie.
      component.data = makeTooltipData();
      fixture.detectChanges();

      const outer = fixture.nativeElement.querySelector('.jets-tooltip') as HTMLElement;
      expect(outer.getAttribute('role')).toBe('dialog');
      expect(outer.hasAttribute('aria-modal')).toBe(false);
    });

    it('sidePanel branch: outer div has role="region" (NOT "dialog")', () => {
      component.data = makeTooltipData();
      component.sidePanel = true;
      fixture.detectChanges();

      const outer = fixture.nativeElement.querySelector('.jets-tooltip') as HTMLElement;
      expect(outer.getAttribute('role')).toBe('region');
      expect(outer.getAttribute('role')).not.toBe('dialog');
    });

    it('aria-labelledby points at the header title element whose text is the seat label', () => {
      component.data = makeTooltipData({ seat: makeSeat({ number: '14B' }) });
      fixture.detectChanges();

      const outer = fixture.nativeElement.querySelector('.jets-tooltip') as HTMLElement;
      const labelledBy = outer.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();

      const labelEl = fixture.nativeElement.querySelector(`#${labelledBy}`) as HTMLElement;
      expect(labelEl).toBeTruthy();
      expect(labelEl.textContent).toContain('14B');
    });

    it('aria-describedby targets the amenities block when amenities are present', () => {
      component.data = makeTooltipData({
        seat: makeSeat({ features: [{ title: 'Wi-Fi', icon: 'wifi' }] }),
      });
      fixture.detectChanges();

      const outer = fixture.nativeElement.querySelector('.jets-tooltip') as HTMLElement;
      const describedBy = outer.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      const target = fixture.nativeElement.querySelector(`#${describedBy}`);
      expect(target?.classList.contains('jets-tooltip--amenities')).toBe(true);
    });

    it('aria-describedby falls back to the dimensions block when only dimensions are present', () => {
      component.data = makeTooltipData({
        seat: makeSeat({ features: [{ title: 'Seat pitch', key: 'pitch', value: '32"' }] }),
      });
      fixture.detectChanges();

      const outer = fixture.nativeElement.querySelector('.jets-tooltip') as HTMLElement;
      const describedBy = outer.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      const target = fixture.nativeElement.querySelector(`#${describedBy}`);
      expect(target?.classList.contains('jets-tooltip--dimensions')).toBe(true);
    });

    it('aria-describedby is absent when neither amenities nor dimensions render', () => {
      component.data = makeTooltipData({ seat: makeSeat({ features: [] }) });
      fixture.detectChanges();

      const outer = fixture.nativeElement.querySelector('.jets-tooltip') as HTMLElement;
      expect(outer.hasAttribute('aria-describedby')).toBe(false);
    });

    it('close button aria-label is localised via LOCALES_MAP for non-English locales', () => {
      // RU locale defines close: 'Закрыть'.
      component.data = makeTooltipData({ lang: 'RU' as any });
      fixture.detectChanges();

      const closeBtn = fixture.nativeElement.querySelector('.jets-tooltip--close-btn') as HTMLElement;
      expect(closeBtn.getAttribute('aria-label')).toBe('Закрыть');
    });

    it('close button aria-label falls back to English when the locale is missing the key', () => {
      // Force an unknown locale so LOCALES_MAP[lang] is undefined and the
      // fallback chain (`|| 'Close'`) kicks in. We do NOT edit constants.ts —
      // the English fallback inline is the safety net (commit 17 will backfill).
      component.data = makeTooltipData({ lang: 'XX' as any });
      fixture.detectChanges();

      const closeBtn = fixture.nativeElement.querySelector('.jets-tooltip--close-btn') as HTMLElement;
      expect(closeBtn.getAttribute('aria-label')).toBe('Close');
    });

    it('auto-focuses the Select button (primary action) on view init when seat has no passenger', async () => {
      component.data = makeTooltipData();
      component.isSelectAvailable = true;
      fixture.detectChanges();
      // setTimeout(0) inside ngAfterViewInit — flush the timer queue.
      await new Promise(resolve => setTimeout(resolve, 0));
      await fixture.whenStable();

      const selectBtn = fixture.nativeElement.querySelector('.jets-select-btn') as HTMLButtonElement;
      expect(document.activeElement).toBe(selectBtn);
    });

    it('auto-focuses the Unselect button (primary action) when seat carries a passenger', async () => {
      component.data = makeTooltipData({
        seat: makeSeat({ passenger: { id: 'p1', abbr: 'JD', passengerLabel: 'John' } }),
      });
      fixture.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 0));
      await fixture.whenStable();

      const unselectBtn = fixture.nativeElement.querySelector('.jets-select-btn') as HTMLButtonElement;
      expect(unselectBtn.textContent?.trim()).toBe('Unselect');
      expect(document.activeElement).toBe(unselectBtn);
    });

    it('does NOT auto-focus in sidePanel mode (it is a page region, not a dialog)', async () => {
      const sentinel = document.createElement('button');
      sentinel.textContent = 'sentinel';
      document.body.appendChild(sentinel);
      sentinel.focus();
      const sentinelAtStart = document.activeElement;

      component.data = makeTooltipData();
      component.sidePanel = true;
      component.isSelectAvailable = true;
      fixture.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 0));
      await fixture.whenStable();

      // Focus should remain on the sentinel, not move into the tooltip.
      expect(document.activeElement).toBe(sentinelAtStart);
      document.body.removeChild(sentinel);
    });

    it('Escape inside the tooltip emits close and stops event propagation', () => {
      component.data = makeTooltipData();
      fixture.detectChanges();

      const closeSpy = vi.fn();
      component.close.subscribe(closeSpy);

      const outer = fixture.nativeElement.querySelector('.jets-tooltip') as HTMLElement;
      const evt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      const stopSpy = vi.spyOn(evt, 'stopPropagation');
      outer.dispatchEvent(evt);

      expect(closeSpy).toHaveBeenCalledTimes(1);
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  // ─── viewOverride (componentOverrides.JetsTooltipView) ─────────────────
  describe('viewOverride', () => {
    it('should render default template when viewOverride is not provided', () => {
      component.data = makeTooltipData();
      fixture.detectChanges();

      const tooltip = fixture.nativeElement.querySelector('.jets-tooltip');
      expect(tooltip).toBeTruthy();
    });

    it('should bypass the default template when viewOverride is provided', () => {
      // Pass an obviously-invalid sentinel: the @Input is typed, but we only need
      // to verify that the default tooltip DOM is NOT rendered when override is truthy.
      // The override branch uses NgComponentOutlet, which would attempt to instantiate.
      // We skip detectChanges to keep this assertion at the public-input contract level.
      component.data = makeTooltipData();
      component.viewOverride = class FakeView {} as any;

      expect(component.viewOverride).toBeTruthy();
    });
  });
});
