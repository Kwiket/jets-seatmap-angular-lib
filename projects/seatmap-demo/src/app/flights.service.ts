import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { BASE_CONFIG, DEMO_FLIGHTS, DemoFlight } from './flights.data';

interface FlightRow {
  airlineCode: string;
  flightNo: string;
  departureDate: string;
  departure: string;
  arrival: string;
  departureCity: string;
  arrivalCity: string;
}

@Injectable({ providedIn: 'root' })
export class FlightsService {
  private _flights: DemoFlight[] = DEMO_FLIGHTS;
  private _fromSheet = false;

  get flights(): DemoFlight[] {
    return this._flights;
  }

  get isFromSheet(): boolean {
    return this._fromSheet;
  }

  async loadFlights(): Promise<DemoFlight[]> {
    const url = environment.flightsApiUrl;
    console.log('[FlightsService] flightsApiUrl:', url || '(empty — using hardcoded)');
    if (!url) {
      this._flights = DEMO_FLIGHTS;
      this._fromSheet = false;
      console.log('[FlightsService] No API URL, using DEMO_FLIGHTS');
      return this._flights;
    }

    try {
      console.log('[FlightsService] Fetching flights from:', url);
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows: FlightRow[] = await res.json();
      console.log('[FlightsService] Response:', rows.length, 'rows', rows);
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('Empty');

      this._flights = rows.map((row) => this.mapRowToFlight(row));
      this._fromSheet = true;
      console.log('[FlightsService] Loaded', this._flights.length, 'flights from Google Sheet');
      return this._flights;
    } catch (err) {
      console.error('[FlightsService] Failed, falling back to DEMO_FLIGHTS:', err);
      this._flights = DEMO_FLIGHTS;
      this._fromSheet = false;
      return this._flights;
    }
  }

  async refresh(): Promise<DemoFlight[]> {
    return this.loadFlights();
  }

  private mapRowToFlight(row: FlightRow): DemoFlight {
    const key = `${row.airlineCode}${row.flightNo}`.toLowerCase();
    return {
      key,
      label: `${row.airlineCode}${row.flightNo} · ${row.departure} → ${row.arrival}`,
      route: `${row.departureCity} → ${row.arrivalCity}`,
      date: this.formatDate(row.departureDate),
      flight: {
        id: key,
        airlineCode: row.airlineCode,
        flightNo: row.flightNo,
        departureDate: row.departureDate,
        departure: row.departure,
        arrival: row.arrival,
        cabinClass: 'A',
      },
      config: {
        ...BASE_CONFIG,
        width: 400,
      },
      passengers: [
        { id: 'p1', passengerLabel: 'Passenger 1', passengerColor: '#e91e63' },
        { id: 'p2', passengerLabel: 'Passenger 2', passengerColor: '#2196f3' },
      ],
    };
  }

  private formatDate(isoDate: string): string {
    try {
      const d = new Date(isoDate + 'T00:00:00');
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoDate;
    }
  }
}
