import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IApiFlightRequest, IApiSeatmapResponse, IConfig } from '../types';
import { DEFAULT_AUTHORIZATION_SCHEME, SEAT_SIZE_BY_TYPE } from '../constants';
import { SeatmapAuthService } from './seatmap-auth.service';

@Injectable({ providedIn: 'root' })
export class JetsSeatMapApiService {
  constructor(
    private http: HttpClient,
    private authService: SeatmapAuthService
  ) {}

  async getSeatmapData(flightData: IApiFlightRequest, config: IConfig): Promise<IApiSeatmapResponse> {
    const resolvedKey = typeof config.apiKey === 'function' ? config.apiKey() : config.apiKey;
    const token = await this.authService.getToken(config.apiUrl, config.apiAppId, resolvedKey);
    const scheme = config.apiAuthorizationScheme ?? DEFAULT_AUTHORIZATION_SCHEME;
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `${scheme} ${token}`,
    });

    // API expects { flight: {...}, lang, units, supportedSeatTypesCount, metadata? } — React parity (api.js:64)
    const { lang, units, ...flightFields } = flightData;
    const supportedSeatTypesCount = SEAT_SIZE_BY_TYPE.length - 1; // Exclude zero index
    const body: Record<string, unknown> = {
      flight: this._cleanObject(flightFields),
      lang,
      units,
      supportedSeatTypesCount,
      ...(config.apiMetadata ? { metadata: config.apiMetadata } : {}),
    };

    try {
      return await this._postSeatmap(config.apiUrl, body, headers, flightData.id);
    } catch (err: any) {
      if (err?.status === 401) {
        console.warn('[SeatmapAPI] 401 — clearing cached token and retrying');
        this.authService.clearToken(config.apiUrl, config.apiAppId);
        const newToken = await this.authService.getToken(config.apiUrl, config.apiAppId, resolvedKey);
        const retryHeaders = new HttpHeaders({
          'Content-Type': 'application/json',
          Authorization: `${scheme} ${newToken}`,
        });
        return await this._postSeatmap(config.apiUrl, body, retryHeaders, flightData.id);
      }
      throw err;
    }
  }

  private async _postSeatmap(
    apiUrl: string,
    body: Record<string, unknown>,
    headers: HttpHeaders,
    flightId: string
  ): Promise<IApiSeatmapResponse> {
    const rawResponse = await firstValueFrom(
      this.http.post<IApiSeatmapResponse | IApiSeatmapResponse[]>(`${apiUrl}/flight/features/plane/seatmap`, body, {
        headers,
      })
    );

    let response: IApiSeatmapResponse;

    if (Array.isArray(rawResponse)) {
      // React parity (api.js:80-83): a 200-OK response can still encode a soft
      // failure as `[{id: flightId, error: "..."}, ...]`. The React lib detects
      // the matching item and `throw new Error(item.error)`; the caller catches
      // it and surfaces the message via `seatMapInited({error})`. Without this
      // throw the matching item silently became `response` below (no decks, no
      // seatDetails) and the host app saw `error: undefined` in the payload.
      for (const item of rawResponse) {
        if ((item as { id?: string; error?: string }).id === flightId && (item as { error?: string }).error) {
          throw new Error((item as { error: string }).error);
        }
      }

      // API returns array: first element has seatDetails/decks, remaining have per-cabin-class data
      // (entertainment, wifi, power, cabin measurements keyed by id suffix like ":F", ":B", ":E", ":P")
      response = rawResponse.find(r => r.seatDetails?.decks?.length || r.decks?.length) ?? rawResponse[0];

      const cabinsByClass: Record<string, any> = {};
      for (const item of rawResponse) {
        if (item === response) continue;
        const id = (item as any).id as string | undefined;
        if (!id) continue;
        const classCode = id.split(':').pop()?.toUpperCase();
        if (!classCode || classCode === id.toUpperCase()) continue;

        // Merge flight-level amenities: prefer the first per-class entry where `exists` is
        // truthy, since some classes carry placeholder `{exists: null}` (e.g. First class
        // on a route where only Business/Premium/Economy have power) that would otherwise
        // shadow the real availability from a later class.
        if (!response.entertainment?.exists && item.entertainment?.exists) response.entertainment = item.entertainment;
        if (!response.wifi?.exists && item.wifi?.exists) response.wifi = item.wifi;
        if (!response.power?.exists && item.power?.exists) response.power = item.power;

        // Store per-class cabin measurements
        if (item.cabin) {
          cabinsByClass[classCode] = item.cabin;
          // Also set top-level cabin as fallback if not present
          if (!response.cabin) response.cabin = item.cabin;
        }
      }

      if (Object.keys(cabinsByClass).length > 0) {
        response.cabinsByClass = cabinsByClass;
      }

      // Extract media from any element in the array
      for (const item of rawResponse) {
        const media = (item as any).media;
        if (media && !response.media) {
          response.media = media;
        }
      }

      // Extract the read-only `availabilityData` payload (React parity —
      // api.js:101-104): the API surfaces it as a sibling element with
      // `id: 'availabilityData'`. We strip the marker `id` and keep the rest
      // (`availableSeats`) so consumers see the same shape as the React lib.
      for (const item of rawResponse) {
        if ((item as any).id === 'availabilityData') {
          const { id: _id, ...rest } = item as any;
          response.availabilityData = rest;
          break;
        }
      }
    } else {
      response = rawResponse;
    }

    return response;
  }

  /** Remove undefined/empty-string fields so they don't cause API validation errors */
  private _cleanObject(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== '' && v !== null));
  }

  /** @deprecated Use getSeatmapData */
  async getPlaneFeatures(flightData: IApiFlightRequest, config: IConfig): Promise<IApiSeatmapResponse> {
    return this.getSeatmapData(flightData, config);
  }
}
