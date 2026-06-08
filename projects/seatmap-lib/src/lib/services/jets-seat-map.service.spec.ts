import { describe, it, expect, beforeEach } from 'vitest';
import { JetsSeatMapService } from './jets-seat-map.service';
import { JetsSeatMapApiService } from './jets-seat-map-api.service';
import { JetsSeatMapPreparerService } from './jets-seat-map-preparer.service';
import { IDeckData, IPassenger, ISeatData, TSeatAvailability } from '../types';
import { ENTITY_STATUS_MAP, ENTITY_TYPE_MAP } from '../constants';

function makeSeat(overrides: Partial<ISeatData> = {}): ISeatData {
  return {
    id: 'seat-0-0',
    letter: 'A',
    type: ENTITY_TYPE_MAP.seat,
    status: ENTITY_STATUS_MAP.available,
    size: 32,
    number: '1A',
    color: '#4CAF50',
    ...overrides,
  };
}

function makeAisle(id = 'aisle-0-1'): ISeatData {
  return {
    id,
    letter: '',
    type: ENTITY_TYPE_MAP.aisle,
    status: ENTITY_STATUS_MAP.unavailable,
    size: 20,
  };
}

function makeDeck(seats: ISeatData[]): IDeckData {
  return {
    rows: [{ id: 'row-0', seats }],
    number: 1,
  };
}

function makePassenger(overrides: Partial<IPassenger> = {}): IPassenger {
  return { id: 'p1', passengerLabel: 'John Doe', ...overrides };
}

describe('JetsSeatMapService', () => {
  let service: JetsSeatMapService;

  beforeEach(() => {
    const apiService = {} as JetsSeatMapApiService;
    const preparer = new JetsSeatMapPreparerService();
    service = new JetsSeatMapService(apiService, preparer);
  });

  // ─── setAvailabilityHandler ───────────────────────────────────────────────

  describe('setAvailabilityHandler', () => {
    it('should mark seats as available with price when availability matches', () => {
      const seat = makeSeat({ status: ENTITY_STATUS_MAP.unavailable });
      const content = [makeDeck([seat])];
      const availability: TSeatAvailability = [{ label: '1A', price: 50, currency: 'USD' }];

      const result = service.setAvailabilityHandler(content, availability);
      const resultSeat = result[0].rows[0].seats[0];

      expect(resultSeat.status).toBe(ENTITY_STATUS_MAP.available);
      expect(resultSeat.price).toBe(50);
      expect(resultSeat.currency).toBe('USD');
    });

    it('should mark seats unavailable when not in availability list', () => {
      const seat = makeSeat({ number: '2B' });
      const content = [makeDeck([seat])];
      const availability: TSeatAvailability = [{ label: '1A', price: 50, currency: 'USD' }];

      const result = service.setAvailabilityHandler(content, availability);
      expect(result[0].rows[0].seats[0].status).toBe(ENTITY_STATUS_MAP.unavailable);
    });

    it('should apply wildcard availability to all seats', () => {
      const seats = [makeSeat({ number: '1A' }), makeSeat({ number: '1B', id: 'seat-0-1', letter: 'B' })];
      const content = [makeDeck(seats)];
      const availability: TSeatAvailability = [{ label: '*', price: 0, currency: 'EUR' }];

      const result = service.setAvailabilityHandler(content, availability);
      expect(result[0].rows[0].seats[0].status).toBe(ENTITY_STATUS_MAP.available);
      expect(result[0].rows[0].seats[1].status).toBe(ENTITY_STATUS_MAP.available);
      expect(result[0].rows[0].seats[0].currency).toBe('EUR');
    });

    it('should apply seat color from availability', () => {
      const seat = makeSeat();
      const content = [makeDeck([seat])];
      const availability: TSeatAvailability = [{ label: '1A', price: 100, currency: 'USD', color: '#FF0000' }];

      const result = service.setAvailabilityHandler(content, availability);
      expect(result[0].rows[0].seats[0].color).toBe('#FF0000');
    });

    it('should not modify aisle/empty seats', () => {
      const aisle = makeAisle();
      const content = [makeDeck([aisle])];
      const availability: TSeatAvailability = [{ label: '*', price: 0, currency: 'USD' }];

      const result = service.setAvailabilityHandler(content, availability);
      expect(result[0].rows[0].seats[0].type).toBe(ENTITY_TYPE_MAP.aisle);
    });

    it('should return content unchanged for empty availability', () => {
      const content = [makeDeck([makeSeat()])];
      const result = service.setAvailabilityHandler(content, []);
      expect(result).toBe(content);
    });

    it('should be case-insensitive for seat labels', () => {
      const seat = makeSeat({ number: '12A' });
      const content = [makeDeck([seat])];
      const availability: TSeatAvailability = [{ label: '12a', price: 25, currency: 'GBP' }];

      const result = service.setAvailabilityHandler(content, availability);
      expect(result[0].rows[0].seats[0].status).toBe(ENTITY_STATUS_MAP.available);
      expect(result[0].rows[0].seats[0].price).toBe(25);
    });

    // ─── additionalProps wiring (React parity) ──────────────────────────────
    // React's service.js#setAvailabilityHandler concatenates entry+wildcard
    // additionalProps and runs them through prepareSeatAdditionalProps before
    // attaching to the seat. The Angular handler used to ignore the field
    // entirely; these specs lock in the parity.

    it('should attach additionalProps from a matching availability entry', () => {
      const seat = makeSeat();
      const content = [makeDeck([seat])];
      const availability: TSeatAvailability = [
        {
          label: '1A',
          price: 50,
          currency: 'USD',
          additionalProps: [
            { label: 'Priority boarding', icon: null },
            { label: 'Free Wi-Fi', icon: 'wifi' },
          ],
        },
      ];

      const result = service.setAvailabilityHandler(content, availability);
      const props = result[0].rows[0].seats[0].additionalProps;
      expect(props).toHaveLength(2);
      expect(props![0].value).toBe('Priority boarding');
      expect(props![1].value).toBe('Free Wi-Fi');
      // Prepared shape: title='' (not null), uniqId set, icon resolved to SVG.
      expect(props!.every(p => p.title === '')).toBe(true);
      expect(props!.every(p => typeof p.uniqId === 'string' && p.uniqId.length > 0)).toBe(true);
    });

    it('should attach wildcard additionalProps when there is no per-seat entry', () => {
      const seat = makeSeat({ number: '9X' });
      const content = [makeDeck([seat])];
      const availability: TSeatAvailability = [
        {
          label: '*',
          price: 10,
          currency: 'USD',
          additionalProps: [{ label: 'Wildcard prop', icon: null }],
        },
      ];

      const result = service.setAvailabilityHandler(content, availability);
      const props = result[0].rows[0].seats[0].additionalProps;
      expect(props).toHaveLength(1);
      expect(props![0].value).toBe('Wildcard prop');
    });

    it('should concatenate entry then wildcard additionalProps when both are set', () => {
      const seat = makeSeat();
      const content = [makeDeck([seat])];
      const availability: TSeatAvailability = [
        {
          label: '1A',
          price: 50,
          currency: 'USD',
          additionalProps: [{ label: 'Entry prop', icon: null }],
        },
        {
          label: '*',
          price: 10,
          currency: 'USD',
          additionalProps: [{ label: 'Wildcard prop', icon: null }],
        },
      ];

      const result = service.setAvailabilityHandler(content, availability);
      const props = result[0].rows[0].seats[0].additionalProps;
      expect(props).toHaveLength(2);
      expect(props![0].value).toBe('Entry prop');
      expect(props![1].value).toBe('Wildcard prop');
    });

    it('should leave additionalProps undefined when neither entry nor wildcard supplies any', () => {
      const seat = makeSeat();
      const content = [makeDeck([seat])];
      const availability: TSeatAvailability = [{ label: '1A', price: 50, currency: 'USD' }];

      const result = service.setAvailabilityHandler(content, availability);
      expect(result[0].rows[0].seats[0].additionalProps).toBeUndefined();
    });

    // ─── onlyForPassengerType → passengerTypes (flat) ──────────────────────
    // The earlier handler wrapped `source.onlyForPassengerType` in another
    // array, producing `[["ADT","CHD","INF"]]`. The Select button in the
    // built-in tooltip then disabled itself because
    // `passengerTypes.includes(nextPassenger.passengerType)` could never be
    // true against a nested array. Lock in the flat shape so a future
    // regression here surfaces as a unit failure instead of a UI-only
    // "Select grayed out" bug.

    it('should set seat.passengerTypes from availability.onlyForPassengerType as a flat string[]', () => {
      const seat = makeSeat({ number: '20E' });
      const content = [makeDeck([seat])];
      const availability: TSeatAvailability = [
        { label: '20E', price: 33, currency: 'USD', onlyForPassengerType: ['ADT', 'CHD', 'INF'] },
      ];

      const result = service.setAvailabilityHandler(content, availability);
      const out = result[0].rows[0].seats[0];

      expect(out.passengerTypes).toEqual(['ADT', 'CHD', 'INF']);
      // Guard against the legacy `[["ADT","CHD","INF"]]` nesting — every
      // element must be a string, none of them an array.
      expect(out.passengerTypes!.every(v => typeof v === 'string')).toBe(true);
    });

    it('should keep passengerTypes flat after re-running setAvailabilityHandler (idempotent)', () => {
      const seat = makeSeat({ number: '20E' });
      const content = [makeDeck([seat])];
      const availability: TSeatAvailability = [
        { label: '20E', price: 33, currency: 'USD', onlyForPassengerType: ['ADT', 'CHD', 'INF'] },
      ];

      const first = service.setAvailabilityHandler(content, availability);
      const second = service.setAvailabilityHandler(first, availability);
      const out = second[0].rows[0].seats[0];

      expect(out.passengerTypes).toEqual(['ADT', 'CHD', 'INF']);
      expect(out.passengerTypes!.every(v => typeof v === 'string')).toBe(true);
    });

    // Regression for "works only once": a second SET AVAILABILITY must
    // replace `seat.passengerTypes` with the new restriction. The earlier
    // handler preserved the prior whitelist whenever it was truthy, so
    // tightening the rule from ['ADT','CHD','INF'] to ['ADT','CHD'] was
    // silently ignored — the tooltip kept showing no restriction line and
    // the Select-disabled gating against the new whitelist never engaged.
    it('should replace seat.passengerTypes on every run (React parity: service.js:100-103)', () => {
      const seat = makeSeat({ number: '20A' });
      const content = [makeDeck([seat])];
      const first = service.setAvailabilityHandler(content, [
        { label: '20A', price: 33, currency: 'USD', onlyForPassengerType: ['ADT', 'CHD', 'INF'] },
      ]);
      expect(first[0].rows[0].seats[0].passengerTypes).toEqual(['ADT', 'CHD', 'INF']);

      const second = service.setAvailabilityHandler(first, [
        { label: '20A', price: 33, currency: 'USD', onlyForPassengerType: ['ADT', 'CHD'] },
      ]);
      expect(second[0].rows[0].seats[0].passengerTypes).toEqual(['ADT', 'CHD']);
    });

    // React parity (service.js:100-103): when neither the entry nor a
    // wildcard carries `onlyForPassengerType`, the seat falls back to the
    // default ['ADT','CHD','INF']. The earlier handler emitted `undefined`,
    // which made restrictionsLabel and isSelectDisabled diverge from React.
    it('should default passengerTypes to [ADT,CHD,INF] when availability omits it', () => {
      const seat = makeSeat({ number: '20A' });
      const content = [makeDeck([seat])];
      const result = service.setAvailabilityHandler(content, [{ label: '20A', price: 33, currency: 'USD' }]);
      expect(result[0].rows[0].seats[0].passengerTypes).toEqual(['ADT', 'CHD', 'INF']);
    });

    // React parity (service.js:100-103): wildcard `onlyForPassengerType`
    // applies when the entry lacks one — and a later wildcard-only refresh
    // still propagates, just like the named-entry case above.
    it("should fall back to wildcard's onlyForPassengerType when entry has none", () => {
      const seat = makeSeat({ number: '20A' });
      const content = [makeDeck([seat])];
      const result = service.setAvailabilityHandler(content, [
        { label: '20A', price: 33, currency: 'USD' },
        { label: '*', price: 0, currency: 'USD', onlyForPassengerType: ['CHD', 'INF'] },
      ]);
      expect(result[0].rows[0].seats[0].passengerTypes).toEqual(['CHD', 'INF']);
    });
  });

  // ─── setPassengersHandler ─────────────────────────────────────────────────

  describe('setPassengersHandler', () => {
    it('should assign passenger to matching seat', () => {
      const seat = makeSeat({ number: '3C' });
      const content = [makeDeck([seat])];
      const passenger = makePassenger({ seat: { price: 0, seatLabel: '3C' } });

      const result = service.setPassengersHandler(content, [passenger]);
      const resultSeat = result[0].rows[0].seats[0];

      expect(resultSeat.status).toBe(ENTITY_STATUS_MAP.selected);
      expect(resultSeat.passenger).toEqual(passenger);
    });

    it('should not modify seats without matching passenger', () => {
      const seat = makeSeat({ number: '4D' });
      const content = [makeDeck([seat])];
      const passenger = makePassenger({ seat: { price: 0, seatLabel: '5E' } });

      const result = service.setPassengersHandler(content, [passenger]);
      expect(result[0].rows[0].seats[0].status).toBe(ENTITY_STATUS_MAP.available);
      expect(result[0].rows[0].seats[0].passenger).toBeUndefined();
    });

    it('should return content unchanged for empty passengers', () => {
      const content = [makeDeck([makeSeat()])];
      const result = service.setPassengersHandler(content, []);
      expect(result).toBe(content);
    });

    it('should be case-insensitive for seat labels', () => {
      const seat = makeSeat({ number: '1a' });
      const content = [makeDeck([seat])];
      const passenger = makePassenger({ seat: { price: 0, seatLabel: '1A' } });

      const result = service.setPassengersHandler(content, [passenger]);
      expect(result[0].rows[0].seats[0].status).toBe(ENTITY_STATUS_MAP.selected);
    });
  });

  // ─── selectSeatHandler ────────────────────────────────────────────────────

  describe('selectSeatHandler', () => {
    it('should select a seat for the next available passenger', () => {
      const seat = makeSeat({ number: '5A', price: 100 });
      const content = [makeDeck([seat])];
      const passengers = [makePassenger()];

      const result = service.selectSeatHandler(content, seat, passengers);

      expect(result.passengers[0].seat?.seatLabel).toBe('5A');
      expect(result.passengers[0].seat?.price).toBe(100);
      expect(result.data[0].rows[0].seats[0].status).toBe(ENTITY_STATUS_MAP.selected);
    });

    it('should not select if all passengers have seats', () => {
      const seat = makeSeat({ number: '5A' });
      const content = [makeDeck([seat])];
      const passengers = [makePassenger({ seat: { price: 0, seatLabel: '3C' } })];

      const result = service.selectSeatHandler(content, seat, passengers);
      expect(result.data[0].rows[0].seats[0].status).toBe(ENTITY_STATUS_MAP.available);
    });

    it('should handle seat without price', () => {
      const seat = makeSeat({ number: '6B', price: undefined });
      const content = [makeDeck([seat])];
      const passengers = [makePassenger()];

      const result = service.selectSeatHandler(content, seat, passengers);
      expect(result.passengers[0].seat?.price).toBe(0);
    });
  });

  // ─── unselectSeatHandler ──────────────────────────────────────────────────

  describe('unselectSeatHandler', () => {
    it('should unselect a seat and remove assignment from passenger', () => {
      const seat = makeSeat({ number: '7C', status: ENTITY_STATUS_MAP.selected });
      const content = [makeDeck([seat])];
      const passengers = [makePassenger({ seat: { price: 50, seatLabel: '7C' } })];

      const result = service.unselectSeatHandler(content, seat, passengers);

      expect(result.passengers[0].seat).toBeUndefined();
      expect(result.data[0].rows[0].seats[0].status).toBe(ENTITY_STATUS_MAP.available);
      expect(result.data[0].rows[0].seats[0].passenger).toBeUndefined();
    });

    it('should not modify other passengers', () => {
      const seat = makeSeat({ number: '7C', status: ENTITY_STATUS_MAP.selected });
      const content = [makeDeck([seat])];
      const p1 = makePassenger({ id: 'p1', seat: { price: 50, seatLabel: '7C' } });
      const p2 = makePassenger({ id: 'p2', seat: { price: 30, seatLabel: '8D' } });

      const result = service.unselectSeatHandler(content, seat, [p1, p2]);
      expect(result.passengers[0].seat).toBeUndefined();
      expect(result.passengers[1].seat?.seatLabel).toBe('8D');
    });
  });

  // ─── getNextPassenger ─────────────────────────────────────────────────────

  describe('getNextPassenger', () => {
    it('should return the first passenger without a seat', () => {
      const p1 = makePassenger({ id: 'p1', seat: { price: 0, seatLabel: '1A' } });
      const p2 = makePassenger({ id: 'p2' });

      expect(service.getNextPassenger([p1, p2])?.id).toBe('p2');
    });

    it('should return null when all passengers have seats', () => {
      const p1 = makePassenger({ id: 'p1', seat: { price: 0, seatLabel: '1A' } });
      expect(service.getNextPassenger([p1])).toBeNull();
    });

    it('should return null for empty passengers array', () => {
      expect(service.getNextPassenger([])).toBeNull();
    });

    it('should skip readOnly passengers and pick the next regular one (React parity)', () => {
      // React parity: service.js:198 — `!passenger.seat?.seatLabel && !passenger.readOnly`.
      const p1 = makePassenger({ id: 'p1', seat: { price: 0, seatLabel: '1A' } });
      const p2 = makePassenger({ id: 'p2', readOnly: true });
      const p3 = makePassenger({ id: 'p3' });

      expect(service.getNextPassenger([p1, p2, p3])?.id).toBe('p3');
    });

    it('should return null when the only seatless passenger is readOnly', () => {
      const p1 = makePassenger({ id: 'p1', seat: { price: 0, seatLabel: '1A' } });
      const p2 = makePassenger({ id: 'p2', readOnly: true });

      expect(service.getNextPassenger([p1, p2])).toBeNull();
    });
  });

  // ─── addAbbrToPassengers ──────────────────────────────────────────────────

  describe('addAbbrToPassengers', () => {
    it('should generate abbreviation from passenger label', () => {
      const result = service.addAbbrToPassengers([makePassenger({ passengerLabel: 'John Doe' })]);
      expect(result[0].abbr).toBe('JD');
    });

    it('should fall back to P{index} when no label', () => {
      const result = service.addAbbrToPassengers([makePassenger({ passengerLabel: undefined })]);
      expect(result[0].abbr).toBe('P1');
    });

    it('should truncate abbreviation to 2 characters', () => {
      const result = service.addAbbrToPassengers([makePassenger({ passengerLabel: 'Anna Maria Smith' })]);
      expect(result[0].abbr).toBe('AM');
    });

    it('should return empty array for undefined input', () => {
      expect(service.addAbbrToPassengers(undefined)).toEqual([]);
    });

    it('should return empty array for empty array input', () => {
      expect(service.addAbbrToPassengers([])).toEqual([]);
    });
  });

  // ─── collectAvailableSeats ────────────────────────────────────────────────

  describe('collectAvailableSeats', () => {
    it('should return only available seat-type items', () => {
      const available = makeSeat({ status: ENTITY_STATUS_MAP.available });
      const unavailable = makeSeat({ id: 'seat-0-1', status: ENTITY_STATUS_MAP.unavailable });
      const aisle = makeAisle();

      const result = service.collectAvailableSeats([makeDeck([available, aisle, unavailable])]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('seat-0-0');
    });

    it('should return empty array for no available seats', () => {
      const seat = makeSeat({ status: ENTITY_STATUS_MAP.unavailable });
      expect(service.collectAvailableSeats([makeDeck([seat])])).toEqual([]);
    });

    it('should collect across multiple decks', () => {
      const s1 = makeSeat({ id: 's1', number: '1A' });
      const s2 = makeSeat({ id: 's2', number: '10A' });
      const content = [makeDeck([s1]), makeDeck([s2])];

      expect(service.collectAvailableSeats(content)).toHaveLength(2);
    });
  });

  // ─── getDeckIndexBySeatLabel ──────────────────────────────────────────────

  describe('getDeckIndexBySeatLabel', () => {
    it('should find correct deck index for a seat', () => {
      const deck0 = makeDeck([makeSeat({ number: '1A' })]);
      const deck1 = makeDeck([makeSeat({ number: '20A' })]);

      expect(service.getDeckIndexBySeatLabel([deck0, deck1], '20A')).toBe(1);
    });

    it('should return 0 when seat is not found', () => {
      const content = [makeDeck([makeSeat({ number: '1A' })])];
      expect(service.getDeckIndexBySeatLabel(content, '99Z')).toBe(0);
    });

    it('should be case-insensitive', () => {
      const content = [makeDeck([makeSeat({ number: '5B' })])];
      expect(service.getDeckIndexBySeatLabel(content, '5b')).toBe(0);
    });
  });

  // ─── compareWithDecksSeatsInfo ────────────────────────────────────────────

  describe('compareWithDecksSeatsInfo', () => {
    it('should split labels into existing and non-existing buckets', () => {
      const content = [makeDeck([makeSeat({ number: '1A' }), makeSeat({ number: '1B', id: 's2', letter: 'B' })])];
      const result = service.compareWithDecksSeatsInfo(['1A', '1B', '99Z'], content);
      expect(result).toEqual({
        existingSeatLabels: ['1A', '1B'],
        nonExistingSeatLabels: ['99Z'],
      });
    });

    it('should be case-insensitive and uppercase the labels in the result', () => {
      const content = [makeDeck([makeSeat({ number: '1A' })])];
      const result = service.compareWithDecksSeatsInfo(['1a', 'zz'], content);
      expect(result.existingSeatLabels).toEqual(['1A']);
      expect(result.nonExistingSeatLabels).toEqual(['ZZ']);
    });

    it('should ignore non-seat entities (aisles, bulks) when matching', () => {
      const content = [makeDeck([makeAisle('aisle-0'), makeSeat({ number: '1A' })])];
      const result = service.compareWithDecksSeatsInfo(['1A'], content);
      expect(result.existingSeatLabels).toEqual(['1A']);
      expect(result.nonExistingSeatLabels).toEqual([]);
    });

    it('should return empty buckets when no labels are provided', () => {
      const content = [makeDeck([makeSeat({ number: '1A' })])];
      expect(service.compareWithDecksSeatsInfo([], content)).toEqual({
        existingSeatLabels: [],
        nonExistingSeatLabels: [],
      });
    });

    it('should return empty buckets when decks are empty', () => {
      expect(service.compareWithDecksSeatsInfo(['1A'], [])).toEqual({
        existingSeatLabels: [],
        nonExistingSeatLabels: [],
      });
    });
  });
});
