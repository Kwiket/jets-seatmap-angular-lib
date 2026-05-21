import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsRowComponent } from './jets-row.component';
import { IRowData, ISeatData } from '../../types';
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

function makeRow(seats?: ISeatData[]): IRowData {
  return {
    id: 'row-0',
    seats: seats ?? [makeSeat()],
  };
}

describe('JetsRowComponent', () => {
  let fixture: ComponentFixture<JetsRowComponent>;
  let component: JetsRowComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JetsRowComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsRowComponent);
    component = fixture.componentInstance;
    component.row = makeRow();
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render the seat container element', () => {
    fixture.detectChanges();
    const root = (fixture.nativeElement as HTMLElement).querySelector('.jets-row');
    expect(root).toBeTruthy();
  });

  it('should render an sm-jets-seat per seat when no seatOverride is set', () => {
    component.row = makeRow([makeSeat({ id: 'a', number: '1A' }), makeSeat({ id: 'b', number: '1B' })]);
    fixture.detectChanges();
    const seats = (fixture.nativeElement as HTMLElement).querySelectorAll('sm-jets-seat');
    expect(seats.length).toBe(2);
  });

  it('should re-emit seatClick from the inner seat', () => {
    const spy = vi.fn();
    component.seatClick.subscribe(spy);

    const payload = { seat: makeSeat(), element: document.createElement('div'), event: new MouseEvent('click') };
    component.seatClick.emit(payload);

    expect(spy).toHaveBeenCalledWith(payload);
  });

  it('should re-emit seatMouseEnter and seatMouseLeave', () => {
    const enterSpy = vi.fn();
    const leaveSpy = vi.fn();
    component.seatMouseEnter.subscribe(enterSpy);
    component.seatMouseLeave.subscribe(leaveSpy);

    const payload = { seat: makeSeat(), element: document.createElement('div') };
    component.seatMouseEnter.emit(payload);
    component.seatMouseLeave.emit(payload);

    expect(enterSpy).toHaveBeenCalledWith(payload);
    expect(leaveSpy).toHaveBeenCalledWith(payload);
  });
});
