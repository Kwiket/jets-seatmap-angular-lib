import { Injectable } from '@angular/core';
import {
  IConfig,
  IDeckData,
  IFlight,
  IMediaData,
  IPassenger,
  ISeatData,
  ITooltipData,
  TSeatAvailability,
} from '../types';
import { ENTITY_STATUS_MAP, ENTITY_TYPE_MAP } from '../constants';
import { JetsSeatMapApiService } from './jets-seat-map-api.service';
import { JetsSeatMapPreparerService } from './jets-seat-map-preparer.service';
import { getAvailableCabins, filterDeckByCabin } from '../utils/cabin-utils';

@Injectable({ providedIn: 'root' })
export class JetsSeatMapService {
  constructor(
    private apiService: JetsSeatMapApiService,
    private preparer: JetsSeatMapPreparerService
  ) {}

  async getSeatMapData(
    flight: IFlight,
    availability: TSeatAvailability | undefined,
    passengers: IPassenger[] | undefined,
    config: IConfig
  ): Promise<{
    content: IDeckData[];
    media?: IMediaData;
    availableCabins: { code: string; title: string }[];
  }> {
    const apiResponse = await this.apiService.getSeatmapData(
      {
        id: flight.id,
        airlineCode: flight.airlineCode,
        flightNo: flight.flightNo,
        departureDate: flight.departureDate,
        departure: flight.departure,
        arrival: flight.arrival,
        cabinClass: flight.cabinClass,
        passengerType: flight.passengerType,
        planeCode: flight.planeCode,
        startRow: flight.startRow,
        endRow: flight.endRow,
        lang: config.lang,
        units: config.units,
      },
      config
    );

    let content = this.preparer.prepareContent(apiResponse, config);

    // Compute available cabins from full (unfiltered) content
    const availableCabins = getAvailableCabins(content, config.lang);

    // Filter by cabin class if a specific class is requested
    if (flight.cabinClass && flight.cabinClass !== 'A') {
      content = content.map(deck => filterDeckByCabin(deck, flight.cabinClass));
    }

    if (availability?.length) {
      content = this.setAvailabilityHandler(content, availability);
    }

    if (passengers?.length) {
      const withAbbr = this.addAbbrToPassengers(passengers);
      content = this.setPassengersHandler(content, withAbbr);
    }

    return { content, media: apiResponse.media, availableCabins };
  }

  setAvailabilityHandler(content: IDeckData[], availability: TSeatAvailability): IDeckData[] {
    if (!availability?.length) return content;

    const availMap = new Map<string, (typeof availability)[0]>();
    let wildcard: (typeof availability)[0] | undefined;

    for (const a of availability) {
      if (a.label === '*') {
        wildcard = a;
      } else {
        availMap.set(a.label.toUpperCase(), a);
      }
    }

    return content.map(deck => ({
      ...deck,
      rows: deck.rows.map(row => ({
        ...row,
        seats: row.seats.map(seat => {
          if (seat.type !== ENTITY_TYPE_MAP.seat) return seat;

          const seatLabel = seat.number?.toUpperCase();
          const entry = seatLabel ? availMap.get(seatLabel) : undefined;
          const source = entry ?? wildcard;

          if (!source) {
            return { ...seat, status: ENTITY_STATUS_MAP.unavailable };
          }

          return {
            ...seat,
            status: ENTITY_STATUS_MAP.available,
            price: source.price,
            currency: source.currency,
            // Availability colour wins when set; otherwise preserve the seat's
            // existing colour (e.g. score-based tint) instead of clobbering it
            // to undefined. The earlier `color: source.color` lost the
            // pre-computed colour whenever the availability entry omitted one,
            // which both broke the integrator contract (`color: string`) and
            // forced the renderer back to the theme default.
            color: source.color ?? seat.color,
            passengerTypes: seat.passengerTypes?.length
              ? seat.passengerTypes
              : source.onlyForPassengerType
                ? [source.onlyForPassengerType]
                : undefined,
          };
        }),
      })),
    }));
  }

  setPassengersHandler(content: IDeckData[], passengers: IPassenger[]): IDeckData[] {
    if (!passengers?.length) return content;

    const passengerMap = new Map<string, IPassenger>();
    for (const p of passengers) {
      if (p.seat?.seatLabel) {
        passengerMap.set(p.seat.seatLabel.toUpperCase(), p);
      }
    }

    return content.map(deck => ({
      ...deck,
      rows: deck.rows.map(row => ({
        ...row,
        seats: row.seats.map(seat => {
          if (seat.type !== ENTITY_TYPE_MAP.seat || !seat.number) return seat;

          const passenger = passengerMap.get(seat.number.toUpperCase());
          if (!passenger) return seat;

          return { ...seat, status: ENTITY_STATUS_MAP.selected, passenger };
        }),
      })),
    }));
  }

  selectSeatHandler(
    content: IDeckData[],
    seat: ISeatData,
    passengers: IPassenger[]
  ): { data: IDeckData[]; passengers: IPassenger[] } {
    const nextPassenger = this.getNextPassenger(passengers);
    if (!nextPassenger || !seat.number) return { data: content, passengers };

    // `seat.price` is loose-typed (number on the lib's internal seat record,
    // string on the emitted payload). The passenger record only ever stores
    // the numeric form.
    const numericPrice = typeof seat.price === 'number' ? seat.price : 0;
    const updatedPassengers = passengers.map(p =>
      p.id === nextPassenger.id ? { ...p, seat: { price: numericPrice, seatLabel: seat.number! } } : p
    );

    const data = content.map(deck => ({
      ...deck,
      rows: deck.rows.map(row => ({
        ...row,
        seats: row.seats.map(s =>
          s.number === seat.number ? { ...s, status: ENTITY_STATUS_MAP.selected, passenger: { ...nextPassenger } } : s
        ),
      })),
    }));

    return { data, passengers: updatedPassengers };
  }

  unselectSeatHandler(
    content: IDeckData[],
    seat: ISeatData,
    passengers: IPassenger[]
  ): { data: IDeckData[]; passengers: IPassenger[] } {
    const updatedPassengers = passengers.map(p => {
      if (p.seat?.seatLabel === seat.number) {
        const { seat: _seat, ...rest } = p;
        return rest as IPassenger;
      }
      return p;
    });

    const data = content.map(deck => ({
      ...deck,
      rows: deck.rows.map(row => ({
        ...row,
        seats: row.seats.map(s => {
          if (s.number !== seat.number) return s;
          const { passenger: _p, ...rest } = s;
          return { ...rest, status: ENTITY_STATUS_MAP.available };
        }),
      })),
    }));

    return { data, passengers: updatedPassengers };
  }

  getNextPassenger(passengers: IPassenger[]): IPassenger | null {
    return passengers.find(p => !p.seat) ?? null;
  }

  addAbbrToPassengers(passengers: IPassenger[] | undefined): IPassenger[] {
    if (!passengers?.length) return [];
    return passengers.map((p, index) => ({
      ...p,
      abbr: p.passengerLabel
        ? p.passengerLabel
            .split(' ')
            .map(w => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
        : `P${index + 1}`,
    }));
  }

  calculateTooltipData(
    seat: ISeatData,
    seatElement: HTMLElement,
    mapElement: HTMLElement,
    nextPassenger: IPassenger | null,
    lang: string
  ): ITooltipData {
    const seatRect = seatElement.getBoundingClientRect();
    const mapRect = mapElement.getBoundingClientRect();

    // Determine whether to open tooltip above or below the seat.
    // Use the seat's position in the browser viewport (not the map container)
    // so scrolling the page is accounted for.
    const viewportHeight = window.innerHeight;
    const openBelow = seatRect.top < viewportHeight * 0.35;

    const gap = 12;
    let top: number;
    if (openBelow) {
      // Position below: top = seat bottom edge + gap (relative to map, accounting for scroll)
      top = seatRect.bottom - mapRect.top + mapElement.scrollTop + gap;
    } else {
      // Position above: bottom edge of tooltip aligns just above the seat
      // CSS transform: translateY(-100%) moves tooltip up by its own height
      top = seatRect.top - mapRect.top + mapElement.scrollTop - gap;
    }

    // Calculate the horizontal center of the seat relative to the tooltip's left edge.
    // The tooltip has CSS `left: 8px`, so subtract that offset.
    const arrowLeft = seatRect.left - mapRect.left + seatRect.width / 2 - 8;

    return { seat, top, left: arrowLeft, nextPassenger, lang: lang as any, openBelow };
  }

  collectAvailableSeats(content: IDeckData[]): ISeatData[] {
    const seats: ISeatData[] = [];
    for (const deck of content) {
      for (const row of deck.rows) {
        for (const seat of row.seats) {
          if (seat.type === ENTITY_TYPE_MAP.seat && seat.status === ENTITY_STATUS_MAP.available) {
            seats.push(seat);
          }
        }
      }
    }
    return seats;
  }

  collectAllSeats(content: IDeckData[]): ISeatData[] {
    const seats: ISeatData[] = [];
    for (const deck of content) {
      for (const row of deck.rows) {
        for (const seat of row.seats) {
          if (seat.type === ENTITY_TYPE_MAP.seat) {
            seats.push(seat);
          }
        }
      }
    }
    return seats;
  }

  getDeckIndexBySeatLabel(content: IDeckData[], seatLabel: string): number {
    const label = seatLabel.toUpperCase();
    for (let i = 0; i < content.length; i++) {
      for (const row of content[i].rows) {
        if (row.seats.some(s => s.number?.toUpperCase() === label)) return i;
      }
    }
    return 0;
  }
}
