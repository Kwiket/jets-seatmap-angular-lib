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
});
