import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const JWT_TOKEN_KEY = 'jetsJwtToken';
const TOKEN_EXPIRATION_BUFFER_MS = 300000; // 5 minutes

interface IStoredToken {
  value: string;
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class SeatmapAuthService {
  constructor(private http: HttpClient) {}

  async getToken(apiUrl: string, apiAppId: string, apiKey: string): Promise<string> {
    const stored = this._getStoredToken(apiUrl, apiAppId);
    if (stored) return stored;

    const resolvedKey = typeof apiKey === 'function' ? (apiKey as () => string)() : apiKey;
    const headers = new HttpHeaders({ Authorization: `Bearer ${resolvedKey}` });
    const response = await firstValueFrom(
      this.http.get<{ accessToken: string }>(`${apiUrl}/auth?appId=${apiAppId}`, { headers }),
    );

    if (!response?.accessToken) {
      throw new Error('Failed to obtain access token from seatmaps API');
    }

    this._saveToken(apiUrl, apiAppId, response.accessToken);
    return response.accessToken;
  }

  private _getStoredToken(apiUrl: string, apiAppId: string): string | null {
    try {
      const key = this._storageKey(apiUrl, apiAppId);
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const stored: IStoredToken = JSON.parse(raw);
      if (Date.now() >= stored.expiresAt) {
        localStorage.removeItem(key);
        return null;
      }
      return stored.value;
    } catch {
      return null;
    }
  }

  private _saveToken(apiUrl: string, apiAppId: string, token: string): void {
    try {
      const { exp } = this._parseJwt(token);
      const expiresAt = exp * 1000 - TOKEN_EXPIRATION_BUFFER_MS;
      const stored: IStoredToken = { value: token, expiresAt };
      localStorage.setItem(this._storageKey(apiUrl, apiAppId), JSON.stringify(stored));
    } catch {
      // If JWT parsing fails, store with 1h TTL fallback
      const stored: IStoredToken = { value: token, expiresAt: Date.now() + 3600000 };
      localStorage.setItem(this._storageKey(apiUrl, apiAppId), JSON.stringify(stored));
    }
  }

  private _parseJwt(token: string): { exp: number } {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  }

  private _storageKey(apiUrl: string, apiAppId: string): string {
    return `${JWT_TOKEN_KEY}_${apiAppId}`;
  }

  clearToken(apiUrl: string, apiAppId: string): void {
    localStorage.removeItem(this._storageKey(apiUrl, apiAppId));
  }
}
