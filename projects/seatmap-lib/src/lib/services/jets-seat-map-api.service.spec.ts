import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { JetsSeatMapApiService } from './jets-seat-map-api.service';
import { SeatmapAuthService } from './seatmap-auth.service';
import { IApiFlightRequest, IConfig } from '../types';

function makeConfig(overrides: Partial<IConfig> = {}): IConfig {
  return {
    width: 350,
    lang: 'EN',
    apiUrl: 'https://api.example.test',
    apiAppId: 'app',
    apiKey: 'secret',
    ...overrides,
  };
}

function makeFlightRequest(overrides: Partial<IApiFlightRequest> = {}): IApiFlightRequest {
  return {
    id: 'flt-1',
    airlineCode: 'AA',
    flightNo: '100',
    departureDate: '2026-06-01',
    departure: 'JFK',
    arrival: 'LAX',
    cabinClass: 'A',
    lang: 'EN',
    units: 'metric',
    ...overrides,
  };
}

const URL = 'https://api.example.test/flight/features/plane/seatmap';

describe('JetsSeatMapApiService', () => {
  let service: JetsSeatMapApiService;
  let httpMock: HttpTestingController;
  let authMock: { getToken: ReturnType<typeof vi.fn>; clearToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authMock = {
      getToken: vi.fn().mockResolvedValue('TKN'),
      clearToken: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        JetsSeatMapApiService,
        { provide: SeatmapAuthService, useValue: authMock },
      ],
    });

    service = TestBed.inject(JetsSeatMapApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should POST to the seatmap endpoint with flight/lang/units/supportedSeatTypesCount in the body', async () => {
    const config = makeConfig();
    const flight = makeFlightRequest();

    const pending = service.getSeatmapData(flight, config);
    // wait for the auth promise to settle before the HTTP layer registers the request
    await Promise.resolve();
    await Promise.resolve();

    const req = httpMock.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.lang).toBe('EN');
    expect(req.request.body.units).toBe('metric');
    expect(req.request.body.flight).toMatchObject({ id: 'flt-1', airlineCode: 'AA' });
    expect(typeof req.request.body.supportedSeatTypesCount).toBe('number');
    expect(req.request.body.supportedSeatTypesCount).toBeGreaterThan(0);

    req.flush({});
    await pending;
  });

  it('should default Authorization scheme to "Bearer"', async () => {
    const pending = service.getSeatmapData(makeFlightRequest(), makeConfig());
    await Promise.resolve();
    await Promise.resolve();
    const req = httpMock.expectOne(URL);
    expect(req.request.headers.get('Authorization')).toBe('Bearer TKN');
    req.flush({});
    await pending;
  });

  it('should honour a custom apiAuthorizationScheme', async () => {
    const pending = service.getSeatmapData(makeFlightRequest(), makeConfig({ apiAuthorizationScheme: 'Token' }));
    await Promise.resolve();
    await Promise.resolve();
    const req = httpMock.expectOne(URL);
    expect(req.request.headers.get('Authorization')).toBe('Token TKN');
    req.flush({});
    await pending;
  });

  it('should merge apiMetadata into the request body at the top level', async () => {
    const pending = service.getSeatmapData(
      makeFlightRequest(),
      makeConfig({ apiMetadata: { traceId: 'X', segment: 'test' } })
    );
    await Promise.resolve();
    await Promise.resolve();
    const req = httpMock.expectOne(URL);
    expect(req.request.body.traceId).toBe('X');
    expect(req.request.body.segment).toBe('test');
    expect(req.request.body.flight).toBeDefined();
    req.flush({});
    await pending;
  });

  it('should resolve apiKey from a function on each request', async () => {
    const keyFn = vi.fn(() => 'dynamic-key');
    const pending = service.getSeatmapData(makeFlightRequest(), makeConfig({ apiKey: keyFn }));
    await Promise.resolve();
    await Promise.resolve();
    const req = httpMock.expectOne(URL);

    expect(keyFn).toHaveBeenCalledTimes(1);
    expect(authMock.getToken).toHaveBeenCalledWith('https://api.example.test', 'app', 'dynamic-key');
    req.flush({});
    await pending;
  });

  it('should clear the cached token and retry once after a 401', async () => {
    authMock.getToken.mockResolvedValueOnce('TKN1').mockResolvedValueOnce('TKN2');

    const pending = service.getSeatmapData(makeFlightRequest(), makeConfig());
    await Promise.resolve();
    await Promise.resolve();

    const first = httpMock.expectOne(URL);
    expect(first.request.headers.get('Authorization')).toBe('Bearer TKN1');
    first.flush({ error: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    // Allow the async retry chain to settle before the next request shows up
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(authMock.clearToken).toHaveBeenCalledWith('https://api.example.test', 'app');

    const second = httpMock.expectOne(URL);
    expect(second.request.headers.get('Authorization')).toBe('Bearer TKN2');
    second.flush({ ok: true });

    await pending;
  });

  it('should merge per-cabin data from an array response', async () => {
    const pending = service.getSeatmapData(makeFlightRequest(), makeConfig());
    await Promise.resolve();
    await Promise.resolve();
    const req = httpMock.expectOne(URL);

    req.flush([
      { decks: [{ rows: [] }] },
      { id: 'plane:E', cabin: { pitch: 30 }, wifi: { exists: true } },
      { id: 'plane:B', cabin: { pitch: 38 } },
    ]);

    const response = await pending;
    expect(response.decks).toBeDefined();
    expect(response.cabinsByClass).toMatchObject({
      E: { pitch: 30 },
      B: { pitch: 38 },
    });
    expect(response.wifi).toMatchObject({ exists: true });
  });

  it('should skip placeholder amenities (exists: null) when merging across classes', async () => {
    const pending = service.getSeatmapData(makeFlightRequest(), makeConfig());
    await Promise.resolve();
    await Promise.resolve();
    const req = httpMock.expectOne(URL);

    req.flush([
      { id: 'plane', decks: [{ rows: [] }] },
      {
        id: 'plane:F',
        cabin: { pitch: 50 },
        power: { summary: 'n/a', exists: null },
        entertainment: { exists: true, summary: 'Free on demand entertainment' },
        wifi: { exists: true, summary: 'Wi-Fi enabled' },
      },
      {
        id: 'plane:B',
        cabin: { pitch: 38 },
        power: {
          summary: 'Power available: AC/USB',
          exists: true,
          type: 'AC/USB',
          powerOutlet: true,
          usbPort: true,
        },
      },
    ]);

    const response = await pending;
    expect(response.power).toMatchObject({
      exists: true,
      powerOutlet: true,
      usbPort: true,
    });
    expect(response.entertainment).toMatchObject({ exists: true });
    expect(response.wifi).toMatchObject({ exists: true });
  });

  it('should strip undefined/empty fields from the flight payload', async () => {
    const flight = makeFlightRequest({
      passengerType: undefined,
      planeCode: '',
      startRow: undefined,
    });
    const pending = service.getSeatmapData(flight, makeConfig());
    await Promise.resolve();
    await Promise.resolve();
    const req = httpMock.expectOne(URL);

    expect(req.request.body.flight.passengerType).toBeUndefined();
    expect(req.request.body.flight.planeCode).toBeUndefined();
    expect(req.request.body.flight.startRow).toBeUndefined();
    expect(req.request.body.flight.id).toBe('flt-1');
    req.flush({});
    await pending;
  });
});
