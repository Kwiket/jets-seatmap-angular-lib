import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsSeatListComponent } from './jets-seat-list.component';
import { IDeckData, ISeatData } from '../../types';
import { ENTITY_STATUS_MAP, ENTITY_TYPE_MAP } from '../../constants';

function makeSeat(overrides: Partial<ISeatData> = {}): ISeatData {
  return {
    id: 'seat',
    letter: 'A',
    type: ENTITY_TYPE_MAP.seat,
    status: ENTITY_STATUS_MAP.available,
    size: 32,
    number: '1A',
    color: '#4CAF50',
    seatIconType: 0,
    price: 10,
    currency: '€',
    ...overrides,
  };
}

function makeContent(): IDeckData[] {
  return [
    {
      rows: [
        { id: 'r1', name: '1', seats: [
          makeSeat({ id: 's-1a', letter: 'A', number: '1A', price: 30 }),
          makeSeat({ id: 's-1b', letter: 'B', number: '1B', price: 10, type: ENTITY_TYPE_MAP.aisle }),
          makeSeat({ id: 's-1c', letter: 'C', number: '1C', price: 20 }),
        ]},
        { id: 'r2', name: '2', seats: [
          makeSeat({ id: 's-2a', letter: 'A', number: '2A', price: 5 }),
        ]},
      ],
      number: 1,
      scale: 1,
    },
  ];
}

describe('JetsSeatListComponent', () => {
  let fixture: ComponentFixture<JetsSeatListComponent>;
  let component: JetsSeatListComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JetsSeatListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsSeatListComponent);
    component = fixture.componentInstance;
    component.content = makeContent();
    fixture.detectChanges();
  });

  it('renders one <tr> per real seat (skips aisle/empty)', () => {
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    // 3 real seats out of 4 (one is aisle)
    expect(rows.length).toBe(3);
  });

  it('renders a semantic table with caption and column headers', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('table caption')).toBeTruthy();
    const headers = root.querySelectorAll('thead th[scope="col"]');
    expect(headers.length).toBeGreaterThanOrEqual(7);
  });

  it('Select click emits seatSelected with the seat', () => {
    const spy = vi.fn();
    component.seatSelected.subscribe(spy);
    fixture.componentRef.setInput('isSelectAvailable', true);
    fixture.detectChanges();
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      'tbody tr button'
    );
    buttons[0].click();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].id).toBe('s-1a');
  });

  it('Unselect click emits seatUnselected when a seat carries a passenger', () => {
    component.content = [
      {
        rows: [{ id: 'r1', name: '1', seats: [
          makeSeat({ id: 's-1a', passenger: { id: 'p1', abbr: 'JD' } }),
        ]}],
        number: 1,
        scale: 1,
      },
    ];
    fixture.detectChanges();
    const spy = vi.fn();
    component.seatUnselected.subscribe(spy);
    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('tbody tr button');
    btn!.click();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].id).toBe('s-1a');
  });

  it('Select button is disabled when isSelectAvailable is false and seat has no passenger', () => {
    fixture.componentRef.setInput('isSelectAvailable', false);
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('tbody tr button');
    expect(btn?.disabled).toBe(true);
  });

  it('sortKey = priceAsc orders rows by price ascending', () => {
    component.sortKey = 'priceAsc';
    fixture.detectChanges();
    const cells = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')
    ).map((tr) => tr.querySelector('td:nth-child(2)')?.textContent?.trim());
    // Real seats: 1A (30), 1C (20), 2A (5). Asc → 2A, 1C, 1A.
    expect(cells).toEqual(['2A', '1C', '1A']);
  });
});
