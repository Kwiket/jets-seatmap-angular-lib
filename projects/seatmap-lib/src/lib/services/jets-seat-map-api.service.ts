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
    private authService: SeatmapAuthService,
  ) {}

  async getSeatmapData(
    flightData: IApiFlightRequest,
    config: IConfig,
  ): Promise<IApiSeatmapResponse> {
    const resolvedKey = typeof config.apiKey === 'function' ? config.apiKey() : config.apiKey;
    const token = await this.authService.getToken(config.apiUrl, config.apiAppId, resolvedKey);
    const scheme = config.apiAuthorizationScheme ?? DEFAULT_AUTHORIZATION_SCHEME;
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `${scheme} ${token}`,
    });

    // API expects { flight: {...}, lang, units, supportedSeatTypesCount, ...metadata } — not flat
    const { lang, units, ...flightFields } = flightData;
    const supportedSeatTypesCount = SEAT_SIZE_BY_TYPE.length - 1; // Exclude zero index
    const body: Record<string, unknown> = {
      flight: this._cleanObject(flightFields),
      lang,
      units,
      supportedSeatTypesCount,
      ...(config.apiMetadata ?? {}),
    };

    console.log('[SeatmapAPI] POST', `${config.apiUrl}/flight/features/plane/seatmap`);
    console.log('[SeatmapAPI] Request body:', JSON.stringify(body, null, 2));

    try {
      return await this._postSeatmap(config.apiUrl, body, headers);
    } catch (err: any) {
      if (err?.status === 401) {
        console.warn('[SeatmapAPI] 401 — clearing cached token and retrying');
        this.authService.clearToken(config.apiUrl, config.apiAppId);
        const newToken = await this.authService.getToken(
          config.apiUrl,
          config.apiAppId,
          resolvedKey,
        );
        const retryHeaders = new HttpHeaders({
          'Content-Type': 'application/json',
          Authorization: `${scheme} ${newToken}`,
        });
        return await this._postSeatmap(config.apiUrl, body, retryHeaders);
      }
      console.error('[SeatmapAPI] Error status:', err?.status);
      console.error('[SeatmapAPI] Error body:', JSON.stringify(err?.error, null, 2));
      throw err;
    }
  }

  private async _postSeatmap(
    apiUrl: string,
    body: Record<string, unknown>,
    headers: HttpHeaders,
  ): Promise<IApiSeatmapResponse> {
    const rawResponse = await firstValueFrom(
      this.http.post<IApiSeatmapResponse | IApiSeatmapResponse[]>(
        `${apiUrl}/flight/features/plane/seatmap`,
        body,
        { headers },
      ),
    );

    let response: IApiSeatmapResponse;

    if (Array.isArray(rawResponse)) {
      // API returns array: first element has seatDetails/decks, remaining have per-cabin-class data
      // (entertainment, wifi, power, cabin measurements keyed by id suffix like ":F", ":B", ":E", ":P")
      response =
        rawResponse.find(r => r.seatDetails?.decks?.length || r.decks?.length) ?? rawResponse[0];

      const cabinsByClass: Record<string, any> = {};
      for (const item of rawResponse) {
        if (item === response) continue;
        const id = (item as any).id as string | undefined;
        if (!id) continue;
        const classCode = id.split(':').pop()?.toUpperCase();
        if (!classCode || classCode === id.toUpperCase()) continue;

        // Merge flight-level amenities from any cabin object (they're consistent across classes)
        if (!response.entertainment && item.entertainment)
          response.entertainment = item.entertainment;
        if (!response.wifi && item.wifi) response.wifi = item.wifi;
        if (!response.power && item.power) response.power = item.power;

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
    } else {
      response = rawResponse;
    }

    console.log('[SeatmapAPI] Response:', JSON.stringify(response, null, 2).slice(0, 1000));
    return response;
  }

  /** Remove undefined/empty-string fields so they don't cause API validation errors */
  private _cleanObject(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== undefined && v !== '' && v !== null),
    );
  }

  /** @deprecated Use getSeatmapData */
  async getPlaneFeatures(
    flightData: IApiFlightRequest,
    config: IConfig,
  ): Promise<IApiSeatmapResponse> {
    return this.getSeatmapData(flightData, config);
  }
}
