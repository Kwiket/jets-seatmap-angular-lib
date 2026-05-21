import { describe, it, expect, beforeEach } from 'vitest';
import { JetsSeatMapPreparerService } from './jets-seat-map-preparer.service';
import { IApiSeatmapResponse, IConfig } from '../types';
import { ENTITY_STATUS_MAP, ENTITY_TYPE_MAP } from '../constants';

const baseConfig: IConfig = {
  width: 350,
  lang: 'EN',
  apiUrl: '',
  apiAppId: '',
  apiKey: '',
};

describe('JetsSeatMapPreparerService', () => {
  let service: JetsSeatMapPreparerService;

  beforeEach(() => {
    service = new JetsSeatMapPreparerService();
  });

  // ─── prepareContent ─────────────────────────────────────────────────────────

  describe('prepareContent', () => {
    it('should return empty array for empty decks', () => {
      const response: IApiSeatmapResponse = { decks: [] };
      expect(service.prepareContent(response, baseConfig)).toEqual([]);
    });

    it('should return empty array when no decks field', () => {
      const response: IApiSeatmapResponse = {};
      expect(service.prepareContent(response, baseConfig)).toEqual([]);
    });

    it('should prepare new format deck with per-seat data', () => {
      const response: IApiSeatmapResponse = {
        decks: [
          {
            rows: [
              {
                seats: [
                  { letter: 'A', seatNumber: '1A', type: 0, available: true, seatType: 0 },
                  { type: 1 }, // aisle
                  { letter: 'B', seatNumber: '1B', type: 0, available: false, seatType: 0 },
                ],
                topOffset: 100,
                name: '1',
              },
            ],
          },
        ],
      };

      const result = service.prepareContent(response, baseConfig);
      expect(result).toHaveLength(1);
      expect(result[0].rows).toHaveLength(1);

      const seats = result[0].rows[0].seats;
      expect(seats).toHaveLength(3);
      expect(seats[0].type).toBe(ENTITY_TYPE_MAP.seat);
      expect(seats[0].letter).toBe('A');
      expect(seats[0].status).toBe(ENTITY_STATUS_MAP.available);
      expect(seats[1].type).toBe(ENTITY_TYPE_MAP.aisle);
      expect(seats[2].status).toBe(ENTITY_STATUS_MAP.unavailable);
    });

    it('should prepare legacy format deck with seatScheme', () => {
      const response: IApiSeatmapResponse = {
        decks: [
          {
            rows: [
              {
                seatScheme: 'SS-SS',
                seatType: 0,
                number: 1,
                name: '1',
                topOffset: 0,
              },
            ],
          },
        ],
      };

      const result = service.prepareContent(response, baseConfig);
      expect(result).toHaveLength(1);

      const seats = result[0].rows[0].seats;
      expect(seats).toHaveLength(5);
      expect(seats[0].type).toBe(ENTITY_TYPE_MAP.seat);
      expect(seats[1].type).toBe(ENTITY_TYPE_MAP.seat);
      expect(seats[2].type).toBe(ENTITY_TYPE_MAP.aisle);
      expect(seats[3].type).toBe(ENTITY_TYPE_MAP.seat);
      expect(seats[4].type).toBe(ENTITY_TYPE_MAP.seat);
    });

    it('should handle legacy format with empty seats (E)', () => {
      const response: IApiSeatmapResponse = {
        decks: [
          {
            rows: [
              {
                seatScheme: 'SE-ES',
                seatType: 0,
                number: 1,
                name: '1',
              },
            ],
          },
        ],
      };

      const result = service.prepareContent(response, baseConfig);
      const seats = result[0].rows[0].seats;

      expect(seats[0].type).toBe(ENTITY_TYPE_MAP.seat);
      expect(seats[1].type).toBe(ENTITY_TYPE_MAP.empty);
      expect(seats[2].type).toBe(ENTITY_TYPE_MAP.aisle);
      expect(seats[3].type).toBe(ENTITY_TYPE_MAP.empty);
      expect(seats[4].type).toBe(ENTITY_TYPE_MAP.seat);
    });

    it('should resolve decks from seatDetails.decks (legacy nested)', () => {
      const response: IApiSeatmapResponse = {
        seatDetails: {
          decks: [
            {
              rows: [
                {
                  seatScheme: 'SS-SS',
                  seatType: 0,
                  number: 1,
                  name: '1',
                },
              ],
            },
          ],
        },
      };

      const result = service.prepareContent(response, baseConfig);
      expect(result).toHaveLength(1);
      expect(result[0].rows[0].seats).toHaveLength(5);
    });

    it('should build deck extras (exits, bulks, wingsInfo)', () => {
      const response: IApiSeatmapResponse = {
        decks: [
          {
            rows: [{ seats: [{ letter: 'A', seatNumber: '1A', type: 0, seatType: 0 }] }],
            exits: [{ type: 'left', topOffset: 50 }],
            bulks: [{ id: 'b1', type: 1, topOffset: 200, stickerType: 'lavatory' }],
            wingsInfo: { topOffset: 300, height: 400, level: 1 },
          },
        ],
      };

      const result = service.prepareContent(response, baseConfig);
      const extras = result[0].extras!;

      expect(extras.exits).toHaveLength(1);
      expect(extras.exits![0].type).toBe('left');
      expect(extras.bulks).toHaveLength(1);
      expect(extras.bulks![0].stickerType).toBe('lavatory');
      expect(extras.wingsInfo?.topOffset).toBe(300);
    });

    it('should assign cabin titles on class change (new format)', () => {
      const response: IApiSeatmapResponse = {
        decks: [
          {
            rows: [
              {
                seats: [{ letter: 'A', seatNumber: '1A', type: 0, seatType: 0 }],
                classCode: 'B',
                name: '1',
              },
              {
                seats: [{ letter: 'A', seatNumber: '2A', type: 0, seatType: 0 }],
                classCode: 'B',
                name: '2',
              },
              {
                seats: [{ letter: 'A', seatNumber: '10A', type: 0, seatType: 0 }],
                classCode: 'E',
                name: '10',
              },
            ],
          },
        ],
      };

      const result = service.prepareContent(response, baseConfig);
      expect(result[0].rows[0].cabinTitle).toBe('Business class');
      expect(result[0].rows[1].cabinTitle).toBeUndefined();
      expect(result[0].rows[2].cabinTitle).toBe('Economy class');
    });

    it('should extract flight-level amenities from response', () => {
      const response: IApiSeatmapResponse = {
        entertainment: { exists: true, summary: 'Personal screens' },
        wifi: { exists: true },
        power: { exists: true, powerOutlet: true, usbPort: true },
        decks: [
          {
            rows: [
              {
                seats: [{ letter: 'A', seatNumber: '1A', type: 0, seatType: 0, available: true }],
              },
            ],
          },
        ],
      };

      const result = service.prepareContent(response, baseConfig);
      const features = result[0].rows[0].seats[0].features ?? [];
      const titles = features.map(f => f.title);

      expect(titles).toContain('Personal screens');
      expect(titles.some(t => t?.includes('Wi-Fi'))).toBe(true);
      expect(titles.some(t => t?.includes('AC/USB'))).toBe(true);
    });

    it('should handle multiple decks', () => {
      const response: IApiSeatmapResponse = {
        decks: [
          {
            rows: [{ seats: [{ letter: 'A', seatNumber: '1A', type: 0, seatType: 0 }] }],
            number: 1,
            title: 'Upper',
          },
          {
            rows: [{ seats: [{ letter: 'A', seatNumber: '20A', type: 0, seatType: 0 }] }],
            number: 2,
            title: 'Lower',
          },
        ],
      };

      const result = service.prepareContent(response, baseConfig);
      expect(result).toHaveLength(2);
      expect(result[0].number).toBe(1);
      expect(result[1].number).toBe(2);
    });
  });

  // ─── _calculateSeatColorByScore (static) ──────────────────────────────────

  describe('_calculateSeatColorByScore', () => {
    const ranges = [
      { range: [1, 3] as [number, number], color: '#FF0000' },
      { range: [4, 7] as [number, number], color: '#FFFF00' },
      { range: [8, 10] as [number, number], color: '#00FF00' },
    ];

    it('should return color for score within range', () => {
      expect(JetsSeatMapPreparerService._calculateSeatColorByScore(2, ranges)).toBe('#FF0000');
      expect(JetsSeatMapPreparerService._calculateSeatColorByScore(5, ranges)).toBe('#FFFF00');
      expect(JetsSeatMapPreparerService._calculateSeatColorByScore(9, ranges)).toBe('#00FF00');
    });

    it('should return null for score outside all ranges', () => {
      expect(JetsSeatMapPreparerService._calculateSeatColorByScore(0, ranges)).toBeNull();
      expect(JetsSeatMapPreparerService._calculateSeatColorByScore(11, ranges)).toBeNull();
    });

    it('should return null for undefined score', () => {
      expect(JetsSeatMapPreparerService._calculateSeatColorByScore(undefined, ranges)).toBeNull();
    });

    it('should return null for empty ranges', () => {
      expect(JetsSeatMapPreparerService._calculateSeatColorByScore(5, [])).toBeNull();
    });

    it('should return null for undefined ranges', () => {
      expect(JetsSeatMapPreparerService._calculateSeatColorByScore(5, undefined)).toBeNull();
    });

    it('should include boundary values', () => {
      expect(JetsSeatMapPreparerService._calculateSeatColorByScore(1, ranges)).toBe('#FF0000');
      expect(JetsSeatMapPreparerService._calculateSeatColorByScore(3, ranges)).toBe('#FF0000');
      expect(JetsSeatMapPreparerService._calculateSeatColorByScore(10, ranges)).toBe('#00FF00');
    });
  });

  // ─── mergeColorThemeWithConstraints (static) ──────────────────────────────

  describe('mergeColorThemeWithConstraints', () => {
    it('should return empty object for undefined theme', () => {
      expect(JetsSeatMapPreparerService.mergeColorThemeWithConstraints(undefined)).toEqual({});
    });

    it('should clamp fuselageStrokeWidth to 10-18', () => {
      expect(
        JetsSeatMapPreparerService.mergeColorThemeWithConstraints({ fuselageStrokeWidth: 5 })
          .fuselageStrokeWidth,
      ).toBe(10);
      expect(
        JetsSeatMapPreparerService.mergeColorThemeWithConstraints({ fuselageStrokeWidth: 25 })
          .fuselageStrokeWidth,
      ).toBe(18);
      expect(
        JetsSeatMapPreparerService.mergeColorThemeWithConstraints({ fuselageStrokeWidth: 14 })
          .fuselageStrokeWidth,
      ).toBe(14);
    });

    it('should filter invalid customSeatColorRanges', () => {
      const theme = {
        customSeatColorRanges: [
          { range: [1, 5] as [number, number], color: '#FF0000' },
          { range: [1] as any, color: '#00FF00' },
          { range: [1, 5] as [number, number], color: '' },
        ],
      };
      const result = JetsSeatMapPreparerService.mergeColorThemeWithConstraints(theme);
      expect(result.customSeatColorRanges).toHaveLength(1);
      expect(result.customSeatColorRanges![0].color).toBe('#FF0000');
    });

    it('should preserve valid theme properties', () => {
      const theme = { seatAvailableColor: '#123456', floorColor: '#654321' };
      const result = JetsSeatMapPreparerService.mergeColorThemeWithConstraints(theme);
      expect(result.seatAvailableColor).toBe('#123456');
      expect(result.floorColor).toBe('#654321');
    });
  });

  // ─── prepareSeatAdditionalProps ───────────────────────────────────────────

  describe('prepareSeatAdditionalProps', () => {
    it('should return empty array for undefined input', () => {
      expect(service.prepareSeatAdditionalProps(undefined)).toEqual([]);
    });

    it('should return empty array for empty input', () => {
      expect(service.prepareSeatAdditionalProps([])).toEqual([]);
    });

    it('should map additional props to features', () => {
      const props = [
        { type: 'info', icon: 'dot', label: 'Priority boarding', cssClass: 'priority' },
      ];
      const result = service.prepareSeatAdditionalProps(props);
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('Priority boarding');
      expect(result[0].title).toBeNull();
    });
  });
});
