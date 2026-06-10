import { Injectable } from '@angular/core';
import {
  IAvailableSeatsData,
  IConfig,
  IDeckData,
  IExistingSeatsLabelsInfo,
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

/**
 * React parity for `passenger.seat` (service.js:44-63). Promotes the Angular
 * internal seat record (numeric `seat.price`, optional `seat.currency`) into
 * the public payload: `seatLabel`, formatted `price` string ("USD 33" / "33"),
 * `priceValue` numeric, and `currency`. Fields that have no source value are
 * omitted entirely — React skips them implicitly via `undefined` keys; we
 * strip the same way so integrators see `{ seatLabel }` instead of
 * `{ seatLabel, price: undefined, ... }`.
 */
function buildPassengerSeat(seat: ISeatData): IPassenger['seat'] {
  const seatLabel = seat.number as string;
  const numericPrice = typeof seat.price === 'number' ? seat.price : undefined;
  const currency = seat.currency;
  const price =
    numericPrice != null ? `${currency ?? ''}${currency ? ' ' : ''}${numericPrice}` : undefined;

  const payload: NonNullable<IPassenger['seat']> = { seatLabel };
  if (price !== undefined) payload.price = price;
  if (currency !== undefined) payload.currency = currency;
  if (numericPrice !== undefined) payload.priceValue = numericPrice;
  return payload;
}

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
    availabilityData?: IAvailableSeatsData;
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

    return {
      content,
      media: apiResponse.media,
      availableCabins,
      availabilityData: apiResponse.availabilityData,
    };
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

          // React parity (service.js:104-119) — entry and wildcard contribute
          // independent additionalProps lists, concatenated entry-first. When
          // only the wildcard matches, just the wildcard's list flows through.
          const mergedAdditional = [...(entry?.additionalProps ?? []), ...(wildcard?.additionalProps ?? [])];
          const additionalProps = mergedAdditional.length
            ? this.preparer.prepareSeatAdditionalProps(mergedAdditional)
            : undefined;

          return {
            ...seat,
            status: ENTITY_STATUS_MAP.available,
            price: source.price,
            currency: source.currency,
            additionalProps,
            // Availability colour wins when set; otherwise preserve the seat's
            // existing colour (e.g. score-based tint) instead of clobbering it
            // to undefined. The earlier `color: source.color` lost the
            // pre-computed colour whenever the availability entry omitted one,
            // which both broke the integrator contract (`color: string`) and
            // forced the renderer back to the theme default.
            //
            // React parity (service.js:108) — availability `color` overrides
            // the prepared score/API colour, but when the availability entry
            // doesn't carry a colour (e.g. a `{ label: '*', price }` wildcard)
            // we fall back to the seat's originalColor so customSeatColorRanges
            // and per-seat API colours survive the availability merge.
            color: source.color ?? seat.originalColor ?? seat.color,
            // React parity (service.js:100-103) — each availability pass
            // replaces the seat's whitelist outright: entry first, wildcard
            // second, then the `['ADT','CHD','INF']` default. The earlier
            // "keep seat.passengerTypes when truthy" branch made the field
            // stick after the first SET AVAILABILITY: a second call with a
            // tighter `onlyForPassengerType` left the seat with the loose
            // prior list, so restriction text and Select-disabled gating
            // both went stale. Stay flat — wrapping in another array is the
            // separate bug locked down by the spec just below this code.
            passengerTypes: source.onlyForPassengerType || wildcard?.onlyForPassengerType || ['ADT', 'CHD', 'INF'],
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

    // React parity (service.js:44-63): `passenger.seat` must mirror the
    // emitted seat shape — formatted `price` string, raw `priceValue`,
    // `currency` and `seatLabel`. React reaches this shape because its
    // `setAvailabilityHandler` already rewrites `seat.price` to a string
    // and stashes `priceValue`/`currency`. Angular keeps the internal
    // `seat.price` numeric (and never sets `priceValue`), so the handler
    // promotes the numeric price into the public payload right here.
    const updatedPassengers = passengers.map(p =>
      p.id === nextPassenger.id ? { ...p, seat: buildPassengerSeat(seat) } : p
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
    // React parity (SeatMap/service.js:198): readOnly passengers never bid for
    // the next free seat — they're considered terminally placed.
    return passengers.find(p => !p.seat && !p.readOnly) ?? null;
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

  /**
   * Split the availability-provided labels into seats that actually exist in
   * the rendered decks and seats that do not. Mirrors React's
   * `compareWithDecksSeatsInfo` and powers the `availabilityApplied` event.
   */
  compareWithDecksSeatsInfo(seatLabels: string[], decks: IDeckData[]): IExistingSeatsLabelsInfo {
    const result: IExistingSeatsLabelsInfo = { existingSeatLabels: [], nonExistingSeatLabels: [] };
    if (!seatLabels?.length || !decks?.length) return result;

    const knownLabels = new Set<string>();
    for (const deck of decks) {
      for (const row of deck.rows ?? []) {
        for (const seat of row.seats ?? []) {
          if (seat.type === ENTITY_TYPE_MAP.seat && seat.number) {
            knownLabels.add(seat.number.toUpperCase());
          }
        }
      }
    }

    for (const raw of seatLabels) {
      const label = String(raw).toUpperCase();
      if (knownLabels.has(label)) {
        result.existingSeatLabels.push(label);
      } else {
        result.nonExistingSeatLabels.push(label);
      }
    }

    return result;
  }
}
