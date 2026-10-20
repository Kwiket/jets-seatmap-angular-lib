import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import * as publicApi from '../public-api';
import { JetsSeatMapPreparerService } from './services/jets-seat-map-preparer.service';
import { JetsSeatComponent } from './components/jets-seat/jets-seat.component';
import { IApiSeatmapResponse, IColorTheme, IConfig, ISeatData } from './types';
import {
  BW_COLOR_THEME,
  CABINS_DIFF_COLOR_THEME,
  DARK_COLOR_THEME,
  ENTITY_STATUS_MAP,
  ENTITY_TYPE_MAP,
  LIGHT_BLUE_COLOR_THEME,
  LOPA_COLOR_THEME,
} from './constants';

const baseConfig: IConfig = {
  width: 350,
  lang: 'EN',
  apiUrl: '',
  apiAppId: '',
  apiKey: '',
};

const PRESETS: Record<string, IColorTheme> = {
  BW_COLOR_THEME,
  LIGHT_BLUE_COLOR_THEME,
  DARK_COLOR_THEME,
  LOPA_COLOR_THEME,
  CABINS_DIFF_COLOR_THEME,
};

/** One row per cabin class, each seat carrying an API colour the theme should replace. */
function responseWithClasses(classes: string[]): IApiSeatmapResponse {
  return {
    decks: [
      {
        rows: classes.map((classCode, i) => ({
          classCode,
          seats: [{ letter: 'A', seatNumber: `${i + 1}A`, type: 0, seatType: 0, score: 5, color: '#6CB64A' } as any],
        })),
      },
    ],
  };
}

function seatWithColor(color: string | undefined): ISeatData {
  return {
    id: 'seat-0-0',
    letter: 'A',
    type: ENTITY_TYPE_MAP.seat,
    status: ENTITY_STATUS_MAP.available,
    size: 32,
    number: '1A',
    color,
    seatIconType: 0,
  };
}

describe('Preset color themes', () => {
  it('are exported from the public API', () => {
    for (const [name, theme] of Object.entries(PRESETS)) {
      expect((publicApi as Record<string, unknown>)[name]).toBe(theme);
    }
  });

  it('every preset prepares a seat map', () => {
    const service = new JetsSeatMapPreparerService();
    for (const theme of Object.values(PRESETS)) {
      const decks = service.prepareContent(responseWithClasses(['E']), { ...baseConfig, colorTheme: theme });
      expect(decks[0].rows[0].seats[0]).toBeTruthy();
    }
  });

  describe('CABINS_DIFF_COLOR_THEME', () => {
    it('leaves seatAvailableColor unset so the class palette is not overridden', () => {
      expect(CABINS_DIFF_COLOR_THEME.seatAvailableColor).toBeUndefined();
      expect(CABINS_DIFF_COLOR_THEME.forceThemeSeatColors).not.toBe(true);
    });

    it('colours each cabin class from its palette instead of the API colour', () => {
      const service = new JetsSeatMapPreparerService();
      const decks = service.prepareContent(responseWithClasses(['F', 'B', 'P', 'E']), {
        ...baseConfig,
        colorTheme: CABINS_DIFF_COLOR_THEME,
      });
      const colors = decks[0].rows.map(r => r.seats[0].color);
      const palette = CABINS_DIFF_COLOR_THEME.customSeatColorClasses!;
      expect(colors).toEqual([palette.F, palette.B, palette.P, palette.E]);
    });
  });

  describe('seat fill', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({ imports: [JetsSeatComponent] }).compileComponents();
    });

    function fillFor(theme: IColorTheme, color: string): string {
      const fixture = TestBed.createComponent(JetsSeatComponent);
      fixture.componentInstance.data = seatWithColor(color);
      fixture.componentInstance.colorTheme = theme;
      return (fixture.componentInstance as any)._resolveStyle().fillColor;
    }

    it('CabinsDiff paints an available seat in the colour its class resolved to', () => {
      const business = CABINS_DIFF_COLOR_THEME.customSeatColorClasses!.B!;
      expect(fillFor(CABINS_DIFF_COLOR_THEME, business)).toBe(business);
    });

    it('the other presets paint every available seat in their own seatAvailableColor', () => {
      for (const theme of [BW_COLOR_THEME, LIGHT_BLUE_COLOR_THEME, DARK_COLOR_THEME, LOPA_COLOR_THEME]) {
        expect(fillFor(theme, '#6CB64A')).toBe(theme.seatAvailableColor);
      }
    });
  });
});
