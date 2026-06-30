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

    it('uses config.customCabinTitles[code] to override the localized cabin title', () => {
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
                seats: [{ letter: 'A', seatNumber: '10A', type: 0, seatType: 0 }],
                classCode: 'E',
                name: '10',
              },
            ],
          },
        ],
      };

      const result = service.prepareContent(response, {
        ...baseConfig,
        customCabinTitles: { B: 'Biz', E: 'Eco' },
      });
      expect(result[0].rows[0].cabinTitle).toBe('Biz');
      expect(result[0].rows[1].cabinTitle).toBe('Eco');
    });

    it('falls back to the localized label when customCabinTitles is missing the code', () => {
      const response: IApiSeatmapResponse = {
        decks: [
          {
            rows: [
              {
                seats: [{ letter: 'A', seatNumber: '1A', type: 0, seatType: 0 }],
                classCode: 'F',
                name: '1',
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

      const result = service.prepareContent(response, {
        ...baseConfig,
        customCabinTitles: { E: 'Eco' },
      });
      expect(result[0].rows[0].cabinTitle).toBe('First class');
      expect(result[0].rows[1].cabinTitle).toBe('Eco');
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

      // React-parity (data-preparer.js:91-99): `title` holds the localized
      // category label, `value` holds the API's free-form `summary` (or `true`
      // when no summary present). Earlier Angular shape was inverted.
      const audioVideo = features.find(f => f.key === 'audioVideo');
      expect(audioVideo?.title).toBe('Audio and video on demand');
      expect(audioVideo?.value).toBe('Personal screens');

      // React uses `wifi` as the public key (not `wifiEnabled`).
      const wifi = features.find(f => f.key === 'wifi');
      expect(wifi?.title).toBe('Wi-Fi');
      expect(wifi?.value).toBe(true);

      // Combined power + USB → `USB and power plug` (locale['usbPowerPlug']).
      const power = features.find(f => f.key === 'power');
      expect(power?.title).toBe('USB and power plug');
      expect(power?.value).toBe(true);
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

    // ─── Seat colour priority: ranges vs API seat colour ─────────────────
    // Locks in React parity (data-preparer.js:371) — customSeatColorRanges
    // override the API's per-seat colour when (a) the gate flag is on and
    // (b) the score lands in one of the configured bands. Otherwise the
    // API colour is preserved.
    describe('seat colour: customSeatColorRanges vs API color', () => {
      const ranges = [
        { range: [1, 3] as [number, number], color: '#FF0000' },
        { range: [4, 7] as [number, number], color: '#FFFF00' },
        { range: [8, 10] as [number, number], color: '#00FF00' },
      ];
      const configWithRanges: IConfig = {
        ...baseConfig,
        colorTheme: { customSeatColorRanges: ranges },
      };

      it('new format: range colour wins over API seat.color when score matches', () => {
        const response: IApiSeatmapResponse = {
          decks: [
            {
              rows: [
                {
                  seats: [
                    {
                      letter: 'A',
                      seatNumber: '1A',
                      type: 0,
                      seatType: 0,
                      score: 8.4,
                      color: '#6CB64A',
                    } as any,
                  ],
                },
              ],
            },
          ],
        };
        const seat = service.prepareContent(response, configWithRanges)[0].rows[0].seats[0];
        expect(seat.color).toBe('#00FF00');
      });

      it('new format: API seat.color wins when score is out of every range', () => {
        const response: IApiSeatmapResponse = {
          decks: [
            {
              rows: [
                {
                  seats: [
                    {
                      letter: 'A',
                      seatNumber: '1A',
                      type: 0,
                      seatType: 0,
                      score: 11,
                      color: '#6CB64A',
                    } as any,
                  ],
                },
              ],
            },
          ],
        };
        const seat = service.prepareContent(response, configWithRanges)[0].rows[0].seats[0];
        expect(seat.color).toBe('#6CB64A');
      });

      it('new format: class colour fills in when score has no matching range', () => {
        const response: IApiSeatmapResponse = {
          decks: [
            {
              rows: [
                {
                  classCode: 'F',
                  seats: [{ letter: 'A', seatNumber: '1A', type: 0, seatType: 0, score: 11, color: '#6CB64A' } as any],
                },
              ],
            },
          ],
        };
        const seat = service.prepareContent(response, {
          ...baseConfig,
          colorTheme: { customSeatColorRanges: ranges, customSeatColorClasses: { F: '#123456' } },
        })[0].rows[0].seats[0];
        // score 11 is out of every range -> class palette (#123456) wins over API #6CB64A
        expect(seat.color).toBe('#123456');
      });

      it('new format: score range wins over class palette when both match', () => {
        const response: IApiSeatmapResponse = {
          decks: [
            {
              rows: [
                {
                  classCode: 'F',
                  seats: [{ letter: 'A', seatNumber: '1A', type: 0, seatType: 0, score: 2, color: '#6CB64A' } as any],
                },
              ],
            },
          ],
        };
        const seat = service.prepareContent(response, {
          ...baseConfig,
          colorTheme: { customSeatColorRanges: ranges, customSeatColorClasses: { F: '#123456' } },
        })[0].rows[0].seats[0];
        // score 2 in [1,3] -> #FF0000 wins over class palette
        expect(seat.color).toBe('#FF0000');
      });

      it('new format: API seat.color wins when no ranges are configured', () => {
        const response: IApiSeatmapResponse = {
          decks: [
            {
              rows: [
                {
                  seats: [
                    {
                      letter: 'A',
                      seatNumber: '1A',
                      type: 0,
                      seatType: 0,
                      score: 2,
                      color: '#6CB64A',
                    } as any,
                  ],
                },
              ],
            },
          ],
        };
        const seat = service.prepareContent(response, baseConfig)[0].rows[0].seats[0];
        expect(seat.color).toBe('#6CB64A');
      });

      it('legacy format: range colour wins over API seat.color when score matches', () => {
        const response: IApiSeatmapResponse = {
          decks: [
            {
              rows: [
                {
                  seatScheme: 'S',
                  seatType: 0,
                  number: 1,
                  name: '1',
                  // Legacy path reads per-seat data from `apiSeats[]` (line 678).
                  apiSeats: [{ letter: 'A', score: 8.4, color: '#6CB64A', available: true } as any],
                } as any,
              ],
            },
          ],
        };
        const seat = service.prepareContent(response, configWithRanges)[0].rows[0].seats[0];
        expect(seat.color).toBe('#00FF00');
      });

      it('legacy format: class colour fills in when score has no matching range', () => {
        const response: IApiSeatmapResponse = {
          decks: [
            {
              rows: [
                {
                  seatScheme: 'S',
                  seatType: 0,
                  number: 1,
                  name: '1',
                  classCode: 'F',
                  apiSeats: [{ letter: 'A', score: 11, color: '#6CB64A', available: true } as any],
                } as any,
              ],
            },
          ],
        };
        const seat = service.prepareContent(response, {
          ...baseConfig,
          colorTheme: { customSeatColorRanges: ranges, customSeatColorClasses: { F: '#123456' } },
        })[0].rows[0].seats[0];
        // score 11 is out of every range -> class palette (#123456) wins over API #6CB64A
        expect(seat.color).toBe('#123456');
      });

      it('legacy format: score range wins over class palette when both match', () => {
        const response: IApiSeatmapResponse = {
          decks: [
            {
              rows: [
                {
                  seatScheme: 'S',
                  seatType: 0,
                  number: 1,
                  name: '1',
                  classCode: 'F',
                  apiSeats: [{ letter: 'A', score: 2, color: '#6CB64A', available: true } as any],
                } as any,
              ],
            },
          ],
        };
        const seat = service.prepareContent(response, {
          ...baseConfig,
          colorTheme: { customSeatColorRanges: ranges, customSeatColorClasses: { F: '#123456' } },
        })[0].rows[0].seats[0];
        // score 2 in [1,3] -> #FF0000 wins over class palette
        expect(seat.color).toBe('#FF0000');
      });
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

  // ─── _calculateSeatColorByClass (static) ─────────────────────────────────

  describe('_calculateSeatColorByClass', () => {
    it('returns the mapped colour for the seat class (case-insensitive)', () => {
      const map = { F: '#ff0000', E: '#0000ff' };
      expect(JetsSeatMapPreparerService._calculateSeatColorByClass('F', map)).toBe('#ff0000');
      expect(JetsSeatMapPreparerService._calculateSeatColorByClass('e', map)).toBe('#0000ff');
    });

    it('returns null when the class has no mapping', () => {
      expect(JetsSeatMapPreparerService._calculateSeatColorByClass('B', { F: '#ff0000' })).toBeNull();
    });

    it('returns null for missing class code or map', () => {
      expect(JetsSeatMapPreparerService._calculateSeatColorByClass(undefined, { F: '#ff0000' })).toBeNull();
      expect(JetsSeatMapPreparerService._calculateSeatColorByClass('F', undefined)).toBeNull();
    });

    it('returns null for an empty colour string', () => {
      expect(JetsSeatMapPreparerService._calculateSeatColorByClass('F', { F: '' })).toBeNull();
    });
  });

  // ─── mergeColorThemeWithConstraints (static) ──────────────────────────────

  describe('mergeColorThemeWithConstraints', () => {
    it('should return empty object for undefined theme', () => {
      expect(JetsSeatMapPreparerService.mergeColorThemeWithConstraints(undefined)).toEqual({});
    });

    it('should clamp fuselageStrokeWidth to 10-18', () => {
      expect(
        JetsSeatMapPreparerService.mergeColorThemeWithConstraints({ fuselageStrokeWidth: 5 }).fuselageStrokeWidth
      ).toBe(10);
      expect(
        JetsSeatMapPreparerService.mergeColorThemeWithConstraints({ fuselageStrokeWidth: 25 }).fuselageStrokeWidth
      ).toBe(18);
      expect(
        JetsSeatMapPreparerService.mergeColorThemeWithConstraints({ fuselageStrokeWidth: 14 }).fuselageStrokeWidth
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

    it('should filter invalid customSeatColorClasses entries', () => {
      const result = JetsSeatMapPreparerService.mergeColorThemeWithConstraints({
        customSeatColorClasses: { F: '#FF0000', E: '', B: 123 as unknown as string },
      });
      expect(result.customSeatColorClasses).toEqual({ F: '#FF0000' });
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

    it('should map additional props with title="" and uniqId', () => {
      const props = [{ icon: 'dot', label: 'Priority boarding', cssClass: 'priority' }];
      const result = service.prepareSeatAdditionalProps(props);
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('Priority boarding');
      // title is '' (not null) so the tooltip's negative-amenity styling does
      // not fire on integrator-defined rows. React parity.
      expect(result[0].title).toBe('');
      expect(typeof result[0].uniqId).toBe('string');
      expect(result[0].uniqId!.length).toBeGreaterThan(0);
      expect(result[0].cssClass).toBe('priority');
      expect(result[0].icon).toBeTypeOf('string');
      expect(result[0].icon!.length).toBeGreaterThan(0);
    });

    it('should fall back to the dot icon when icon is null', () => {
      const dotResult = service.prepareSeatAdditionalProps([{ icon: null, label: 'Test' }]);
      const fallbackResult = service.prepareSeatAdditionalProps([{ label: 'Test' }]);
      expect(dotResult[0].icon).toBe(fallbackResult[0].icon);
      expect(dotResult[0].icon!.length).toBeGreaterThan(0);
    });

    it('should fall back to empty string for an unknown icon key', () => {
      const result = service.prepareSeatAdditionalProps([{ icon: 'does-not-exist', label: 'Test' }]);
      expect(result[0].icon).toBe('');
    });

    it('should give each item a distinct uniqId', () => {
      const result = service.prepareSeatAdditionalProps([{ label: 'A' }, { label: 'B' }, { label: 'C' }]);
      const ids = result.map(r => r.uniqId);
      expect(new Set(ids).size).toBe(3);
    });
  });

  // ─── Bulk / row overlap resolution ──────────────────────────────────────────
  //
  // The preparer post-processes deck.extras.bulks so a bulk that is physically
  // overlapped by a row above/below gets nudged out of the way. The tests below
  // build minimal API decks and assert the resulting bulk geometry. seatType=0
  // (default) gives a 100×100-unit native seat — easy arithmetic. bulkId='26'
  // has BULK_SCALE_BY_ID=1, so bulk.height equals its native height directly.

  describe('partition / bulk overlap resolution', () => {
    const oneSeatRow = (topOffset: number) => ({
      topOffset,
      seats: [{ letter: 'A', seatNumber: `${topOffset}A`, type: 0, seatType: 0, available: true }],
    });

    it('shifts a bulk down when the row above overlaps its top edge', () => {
      // Row bbox [0, 100], bulk bbox [80, 130]. Row.bottom (100) bites 20 into the bulk.
      // Expected: bulk.topOffset shifts to 100 + 4 (gap) = 104, height shrinks by 24 to 26.
      const response: IApiSeatmapResponse = {
        decks: [
          {
            rows: [oneSeatRow(0)],
            bulks: [{ id: '26', topOffset: 80, height: 50, width: 40 }],
          },
        ],
      };
      const result = service.prepareContent(response, baseConfig);
      const bulks = result[0].extras?.bulks ?? [];
      expect(bulks).toHaveLength(1);
      expect(bulks[0].topOffset).toBe(104);
      expect(bulks[0].height).toBe(26);
    });

    it('shrinks a bulk from below when the row below overlaps its bottom edge', () => {
      // Row bbox [120, 220], bulk bbox [100, 150]. Row.top (120) bites 30 into the bulk's bottom.
      // Expected: bulk.topOffset stays 100, height clamps to (120 - 4) - 100 = 16.
      const response: IApiSeatmapResponse = {
        decks: [
          {
            rows: [oneSeatRow(120)],
            bulks: [{ id: '26', topOffset: 100, height: 50, width: 40 }],
          },
        ],
      };
      const result = service.prepareContent(response, baseConfig);
      const bulks = result[0].extras?.bulks ?? [];
      expect(bulks[0].topOffset).toBe(100);
      expect(bulks[0].height).toBe(16);
    });

    it('silently keeps the original geometry when both rows overlap (degenerate sliver)', () => {
      // Rows [0,100] and [110,210] sandwich a bulk at [80,130]. After top fix bulk is
      // [104,130]; the bottom fix would chop it to height 2 (below MIN_BULK_NATIVE_HEIGHT=8),
      // so the preparer reverts to the input values.
      const response: IApiSeatmapResponse = {
        decks: [
          {
            rows: [oneSeatRow(0), oneSeatRow(110)],
            bulks: [{ id: '26', topOffset: 80, height: 50, width: 40 }],
          },
        ],
      };
      const result = service.prepareContent(response, baseConfig);
      const bulks = result[0].extras?.bulks ?? [];
      expect(bulks[0].topOffset).toBe(80);
      expect(bulks[0].height).toBe(50);
    });

    it('is a no-op when partitionGap = 0, even with a visible overlap', () => {
      // Same overlap as the first test but the consumer opts out — the bulk
      // must come through with its raw API coordinates intact so callers can
      // compare against pre-fix renderings.
      const response: IApiSeatmapResponse = {
        decks: [
          {
            rows: [oneSeatRow(0)],
            bulks: [{ id: '26', topOffset: 80, height: 50, width: 40 }],
          },
        ],
      };
      const result = service.prepareContent(response, { ...baseConfig, partitionGap: 0 });
      const bulks = result[0].extras?.bulks ?? [];
      expect(bulks[0].topOffset).toBe(80);
      expect(bulks[0].height).toBe(50);
    });

    it('leaves a bulk untouched when no row overlaps it', () => {
      // Row [0,100], bulk [200,250] — clean gap of 100 units. Algorithm must not budge.
      const response: IApiSeatmapResponse = {
        decks: [
          {
            rows: [oneSeatRow(0)],
            bulks: [{ id: '26', topOffset: 200, height: 50, width: 40 }],
          },
        ],
      };
      const result = service.prepareContent(response, baseConfig);
      const bulks = result[0].extras?.bulks ?? [];
      expect(bulks[0].topOffset).toBe(200);
      expect(bulks[0].height).toBe(50);
    });

    it('accounts for BULK_SCALE_BY_ID when measuring the bulk native bbox', () => {
      // Default bulk (no id => DEFAULT_BULK_SCALE=0.7). API height=100 → native bbox spans 70.
      // Row [0,100], bulk topOffset=80, native bbox [80, 150]. Row.bottom (100) bites 20.
      // Expected new top = 100 + 4 = 104, native height = 70 - 24 = 46 → API height = 46 / 0.7 ≈ 65.71.
      const response: IApiSeatmapResponse = {
        decks: [
          {
            rows: [oneSeatRow(0)],
            bulks: [{ topOffset: 80, height: 100, width: 40 }],
          },
        ],
      };
      const result = service.prepareContent(response, baseConfig);
      const bulk = result[0].extras?.bulks?.[0];
      expect(bulk?.topOffset).toBe(104);
      // API-space height divides out the same bulkScale that jets-bulk applies at render time,
      // so the rendered pixel height equals the corrected native height.
      expect(bulk?.height).toBeCloseTo(46 / 0.7, 5);
    });

    it('uses the real row bbox (per-seat topOffset) so a staggered Business pod does not falsely shrink the next bulk', () => {
      // Repro: Lufthansa A350 LH470 row 4 — seats 4C/4H sit at topOffset=+45 inside the row, so
      // the row's true bottom extends 45 units past `row.topOffset + max(seatH)`. With the
      // pre-fix bbox (max-seatH only), the bottom is under-reported, the galley bulk just below
      // looks merely lightly grazed, and the preparer shrinks it to ~22% — a sliver that renders
      // as an invisible 11-px strip while the galley sticker still floats above. With the
      // per-seat bbox the algorithm sees an overlap deep enough to trip the safety floor and
      // keeps the bulk in its original geometry.
      const response: IApiSeatmapResponse = {
        decks: [
          {
            rows: [
              {
                topOffset: 1030,
                seatType: 7,
                seats: [
                  { letter: 'A', seatNumber: '4A', topOffset: 0, available: true },
                  { letter: 'C', seatNumber: '4C', topOffset: 45, available: true },
                  { letter: 'D', seatNumber: '4D', topOffset: -172, available: true },
                  { letter: 'H', seatNumber: '4H', topOffset: 45, available: true },
                  { letter: 'K', seatNumber: '4K', topOffset: 0, available: true },
                ],
              },
            ],
            bulks: [{ id: '7', iconType: 'G', topOffset: 1066, height: 308, width: 400, align: 'center' }],
          },
        ],
      };
      const result = service.prepareContent(response, baseConfig);
      const bulk = result[0].extras?.bulks?.[0];
      expect(bulk?.topOffset).toBe(1066);
      expect(bulk?.height).toBe(308);
    });

    it('respects a custom partitionGap larger than the default', () => {
      // Row [0,100], bulk [80,130], gap=20 → new top = 100 + 20 = 120, height = 50 - 40 = 10.
      const response: IApiSeatmapResponse = {
        decks: [
          {
            rows: [oneSeatRow(0)],
            bulks: [{ id: '26', topOffset: 80, height: 50, width: 40 }],
          },
        ],
      };
      const result = service.prepareContent(response, { ...baseConfig, partitionGap: 20 });
      const bulks = result[0].extras?.bulks ?? [];
      expect(bulks[0].topOffset).toBe(120);
      expect(bulks[0].height).toBe(10);
    });
  });
});
