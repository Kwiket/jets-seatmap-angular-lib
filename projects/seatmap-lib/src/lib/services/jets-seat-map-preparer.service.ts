import { Injectable } from '@angular/core';
import {
  IApiCabin,
  IApiDeck,
  IApiRow,
  IApiSeat,
  IApiSeatLegacy,
  IApiSeatmapResponse,
  IBulkData,
  IConfig,
  IDeckData,
  IDeckExtras,
  IExitData,
  IRowData,
  ISeatData,
  ISeatFeature,
  TSeatStatus,
  TSeatType,
  IWingsInfo,
} from '../types';
import {
  API_SEAT_TYPE_MAP,
  DEFAULT_SEAT_SIZE,
  FEATURE_ICONS,
  LOCALES_MAP,
  SEAT_FEATURES_ICONS,
  SEAT_LETTERS,
  SEAT_MEASUREMENTS_ICONS,
  SEAT_SCHEME_MAP,
  SEAT_SIZE_BY_TYPE,
  DEFAULT_SEAT_TYPE,
  ENTITY_STATUS_MAP,
  ENTITY_TYPE_MAP,
} from '../constants';

/**
 * Per-item identifier for prepared feature/measurement entries.
 * Mirrors React's `Utils.generateId()` — used as a stable `track by` key when
 * consumers loop over `seat.features` / `seat.measurements`.
 */
function genFeatureId(): string {
  return '_' + Math.random().toString(36).substring(2, 9);
}

@Injectable({ providedIn: 'root' })
export class JetsSeatMapPreparerService {
  prepareContent(apiResponse: IApiSeatmapResponse, config: IConfig): IDeckData[] {
    // Resolve decks from either format
    const decks = apiResponse.decks ?? apiResponse.seatDetails?.decks ?? [];
    if (!decks.length) return [];

    const cabin = apiResponse.cabin ?? {};
    const cabinsByClass = apiResponse.cabinsByClass ?? {};
    const noseType = apiResponse.plane?.noseType;

    // Collect flight-level amenities (entertainment, wifi, power)
    const flightAmenities = this._buildFlightAmenities(apiResponse, config.lang);

    // Two-pass approach (matches React): compute nativeDeckWidth for ALL decks first,
    // then use the WIDEST deck to derive a single global scale for all decks.
    const nativeDeckWidths = decks.map(d => this._computeNativeDeckWidth(d.rows));
    const globalNativeDeckWidth = Math.max(...nativeDeckWidths, 1);

    // Compute sideSpace: native-coordinate margin for wings/cabin titles (matches React)
    const hasWings = decks.some(d => d.wingsInfo?.height != null);
    const wingsW = config.visibleWings !== false && hasWings ? (config.colorTheme?.wingsWidth ?? 30) : 0;
    const cabinTitlesW = config.visibleCabinTitles !== false ? (config.colorTheme?.cabinTitlesWidth ?? 80) : 0;
    const sideSpace = Math.max(wingsW, cabinTitlesW);

    // Detect format: new (per-seat topOffset) vs legacy (seatScheme strings)
    const isNewFormat = this._isNewApiFormat(decks);
    if (isNewFormat) {
      return decks.map((deck, i) =>
        this._prepareDeckNew(deck, i, config, noseType, flightAmenities, globalNativeDeckWidth, sideSpace)
      );
    } else {
      const biggestRowSize = this._getBiggestRowSizeLegacy(decks);
      return decks.map((deck, i) =>
        this._prepareDeckLegacy(
          deck,
          i,
          cabin,
          config,
          biggestRowSize,
          noseType,
          flightAmenities,
          globalNativeDeckWidth,
          sideSpace,
          cabinsByClass
        )
      );
    }
  }

  // ─── Format detection ───────────────────────────────────────────────────────

  private _isNewApiFormat(decks: IApiDeck[]): boolean {
    for (const deck of decks) {
      for (const row of deck.rows) {
        // Prefer seatScheme-based (legacy) path even when seats[] is also present —
        // some APIs return both; seatScheme is authoritative for aisle/empty layout.
        if (row.seatScheme) return false;
        if (row.seats?.length) return true;
      }
    }
    return false;
  }

  // ─── New API format ─────────────────────────────────────────────────────────

  private _prepareDeckNew(
    deck: IApiDeck,
    deckIndex: number,
    config: IConfig,
    noseType?: string,
    flightAmenities: ISeatFeature[] = [],
    globalNativeDeckWidth?: number,
    sideSpace = 0
  ): IDeckData {
    const rows = deck.rows ?? [];

    const fuselageStrokeWidth = config.colorTheme?.fuselageStrokeWidth ?? 12;
    const nativeDeckWidth = this._computeNativeDeckWidth(rows);
    // Use global (widest) deck width for scale — matches React's single global scale
    const scaleBase = globalNativeDeckWidth ?? nativeDeckWidth;
    const { scale, deckWidth } = this._computeDeckScale(scaleBase, config.width, fuselageStrokeWidth, sideSpace);

    // Row area width = this deck's OWN native width × global scale.
    // Narrower decks (e.g. A380 upper) get proportionally narrower rows.
    const rowAreaWidth = nativeDeckWidth * scale;

    // Build rendered rows — group by cabin class for headers
    let lastCabinClass = '';

    const renderedRows: IRowData[] = [];

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const cabinClass = row.classCode ?? row.cabinClass ?? '';

      const classChanged = cabinClass && cabinClass !== lastCabinClass;

      // Use localized cabin class label (matches React: always "Business class" etc.).
      // `config.customCabinTitles[code]` lets callers override per cabin code.
      const cabinTitle = classChanged
        ? (config.customCabinTitles?.[cabinClass.toUpperCase()] ?? this._resolveCabinLabel(cabinClass, config.lang))
        : undefined;

      if (cabinClass) lastCabinClass = cabinClass;

      const rendered = this._prepareRowNew(
        row,
        ri,
        scale,
        rowAreaWidth,
        cabinTitle,
        config.lang,
        config.colorTheme,
        flightAmenities,
        config.units,
        config.colorfulSeatsByScore ?? true
      );
      if (classChanged) rendered.cabinClassCode = cabinClass.toUpperCase();
      // Always propagate cabinClassCode for cabin filtering
      if (cabinClass && !rendered.cabinClassCode) rendered.cabinClassCode = cabinClass.toUpperCase();
      // Only keep name in row data when it's a numeric row identifier
      if (rendered.name && !/^\d/.test(rendered.name)) {
        rendered.name = undefined;
      }
      renderedRows.push(rendered);
    }

    const extras = this._buildExtras(deck, noseType);

    return {
      rows: renderedRows,
      number: deck.number ?? deckIndex + 1,
      title: deck.title,
      extras,
      scale,
      deckWidth,
      nativeDeckWidth,
      biggestSeatRowWidth: this._computeBiggestSeatRowWidth(rows),
    };
  }

  private _getMaxSeatsInRowNew(rows: IApiRow[]): number {
    let max = 0;
    for (const row of rows) {
      const count = row.seats?.filter(s => this._apiSeatType(s) !== ENTITY_TYPE_MAP.aisle).length ?? 0;
      if (count > max) max = count;
    }
    return max || 6;
  }

  private _prepareRowNew(
    row: IApiRow,
    rowIndex: number,
    scale: number,
    containerWidth: number,
    cabinTitle?: string,
    lang = 'EN',
    colorTheme?: import('../types').IColorTheme,
    flightAmenities: ISeatFeature[] = [],
    units?: string,
    colorfulSeatsByScore = true
  ): IRowData {
    const seats = row.seats ?? [];
    // Row-level seatType fallback (matches React's _rowSeatType)
    const rowSeatType = row.seatType ?? DEFAULT_SEAT_TYPE;

    // Pre-compute per-seat native widths and aisle count for proportional sizing
    let totalNativeSeatWidth = 0;
    let aisleCount = 0;
    const seatNativeWidths: number[] = [];
    for (const s of seats) {
      const type = this._apiSeatType(s);
      if (type === ENTITY_TYPE_MAP.aisle) {
        aisleCount++;
        seatNativeWidths.push(0);
      } else {
        // Use || to match React: seatType=0 means "use row default"
        const st = s.seatType || rowSeatType || DEFAULT_SEAT_TYPE;
        const [nw] = SEAT_SIZE_BY_TYPE[st] ?? [100, 100];
        totalNativeSeatWidth += nw;
        seatNativeWidths.push(nw);
      }
    }

    const totalSeatRendered = Math.round(totalNativeSeatWidth * scale);
    const remaining = containerWidth - totalSeatRendered;
    // Cap aisle width at row-level seat width (matching React)
    const [rowNativeW] = SEAT_SIZE_BY_TYPE[rowSeatType] ?? [100, 100];
    const renderedRowW = Math.round(rowNativeW * scale);
    const aisleSize =
      aisleCount > 0 ? Math.max(1, Math.min(Math.round(remaining / aisleCount), renderedRowW)) : renderedRowW;

    let letterIdx = 0;
    let seatIdx = 0;

    const renderedSeats: ISeatData[] = seats.map((s, i) => {
      const type = this._apiSeatType(s);
      const nw = seatNativeWidths[i];
      const renderedSize = nw > 0 ? Math.max(Math.round(nw * scale), 8) : aisleSize;

      if (type === ENTITY_TYPE_MAP.aisle) {
        return {
          id: `aisle-${rowIndex}-${i}`,
          letter: '',
          type: ENTITY_TYPE_MAP.aisle,
          status: ENTITY_STATUS_MAP.unavailable as TSeatStatus,
          size: aisleSize,
          leftOffset: s.leftOffset,
          topOffset: s.topOffset,
        };
      }
      if (type === ENTITY_TYPE_MAP.empty) {
        return {
          id: `empty-${rowIndex}-${i}`,
          letter: '',
          type: ENTITY_TYPE_MAP.empty,
          status: ENTITY_STATUS_MAP.unavailable as TSeatStatus,
          size: renderedSize,
          leftOffset: s.leftOffset,
          topOffset: s.topOffset,
        };
      }

      const letter = s.letter ?? SEAT_LETTERS[letterIdx++] ?? String(++seatIdx);
      const seatNumber = s.seatNumber ?? `${rowIndex + 1}${letter}`;
      // Per-seat seatType overrides row default; use || to match React (seatType=0 means "use row default")
      const rawSeatType = typeof s.type === 'number' ? s.type : s.seatType;
      const seatIconType = rawSeatType || rowSeatType || DEFAULT_SEAT_TYPE;
      const { features: seatFeatures, measurements } = this._prepareSeatFeaturesNew(s, lang, units);
      // Merge flight-level amenities with per-seat amenities, dedup by feature key
      // (icon is now an SVG string — comparing icons no longer makes sense).
      // Measurements stay in their own array, mirroring React's shape.
      const flightKeys = new Set(flightAmenities.map(a => a.key).filter(Boolean));
      const seatAmenities = seatFeatures.filter(f => !f.key || !flightKeys.has(f.key));
      const features = [...flightAmenities, ...seatAmenities];
      // React parity (data-preparer.js:371): score-range colour wins over the
      // API's `seat.color`. The customSeatColorRanges contract is "the theme
      // overrides whatever the seat ships with for this score band" — so the
      // matcher comes first; if it returns null (no ranges configured, gate
      // off, score missing/out of band), we fall back to the per-seat API
      // colour.
      const seatColor =
        JetsSeatMapPreparerService._calculateSeatColorByScore(
          s.score,
          colorTheme?.customSeatColorRanges,
          colorfulSeatsByScore
        ) ??
        s.color ??
        undefined;

      const classCode = (row.classCode ?? row.cabinClass ?? s.classType ?? 'E').toUpperCase();
      return {
        id: `seat-${rowIndex}-${i}`,
        uniqId: genFeatureId(),
        letter,
        type: ENTITY_TYPE_MAP.seat,
        status:
          s.available === false
            ? (ENTITY_STATUS_MAP.unavailable as TSeatStatus)
            : (ENTITY_STATUS_MAP.available as TSeatStatus),
        size: renderedSize,
        number: seatNumber,
        color: seatColor,
        originalColor: seatColor,
        score: s.score,
        rotation: this._mapRotation(s.rotation),
        classCode,
        classType: classCode,
        // React's composite identifier: `${classCode}-${seatIconType}` (e.g. 'B-13').
        seatType: `${classCode}-${seatIconType}`,
        seatIconType,
        features,
        measurements,
        passengerTypes: s.passengerTypes,
        leftOffset: s.leftOffset,
        topOffset: s.topOffset,
      };
    });

    return {
      id: `row-${rowIndex}`,
      seats: renderedSeats,
      topOffset: row.topOffset,
      name: row.name,
      cabinTitle,
    };
  }

  private _apiSeatType(seat: IApiSeat): TSeatType {
    const rawType = seat.type;
    if (typeof rawType === 'number') {
      return API_SEAT_TYPE_MAP[rawType] ?? ENTITY_TYPE_MAP.seat;
    }
    if (typeof rawType === 'string') {
      return SEAT_SCHEME_MAP[rawType] ?? ENTITY_TYPE_MAP.seat;
    }
    // Infer from letter: no letter = aisle/empty
    if (!seat.letter && !seat.seatNumber) return ENTITY_TYPE_MAP.empty;
    return ENTITY_TYPE_MAP.seat;
  }

  /**
   * Convert a measurement value from cm to inches if units === 'imperials'.
   * Handles strings like "81 cm", "81-86 cm", numbers, and "°" (degrees are never converted).
   */
  private _convertUnit(value: string | number, units?: string): string | number {
    if (units !== 'imperials') return value;
    const str = String(value);
    // Don't convert degrees
    if (str.includes('°')) return value;
    // Replace "cm" with inches conversion: parse numbers, convert, replace unit
    if (/\d\s*cm/i.test(str)) {
      return str.replace(/(\d+(?:\.\d+)?)\s*cm/gi, (_, num) => {
        const inches = Math.round((parseFloat(num) / 2.54) * 10) / 10;
        const display = inches % 1 === 0 ? inches.toFixed(0) : inches.toFixed(1);
        return `${display}"`;
      });
    }
    // Pure number — assume cm, convert to inches
    if (typeof value === 'number') {
      const inches = Math.round((value / 2.54) * 10) / 10;
      return inches % 1 === 0 ? `${inches.toFixed(0)}"` : `${inches.toFixed(1)}"`;
    }
    // String with just a number (no "cm" suffix) — try converting
    const numMatch = str.match(/^(\d+(?:\.\d+)?)\s*$/);
    if (numMatch) {
      const inches = Math.round((parseFloat(numMatch[1]) / 2.54) * 10) / 10;
      const display = inches % 1 === 0 ? inches.toFixed(0) : inches.toFixed(1);
      return `${display}"`;
    }
    return value;
  }

  private _prepareSeatFeaturesNew(
    seat: IApiSeat,
    lang = 'EN',
    units?: string
  ): { features: ISeatFeature[]; measurements: ISeatFeature[] } {
    const locale = LOCALES_MAP[lang] ?? LOCALES_MAP['EN'];
    const features: ISeatFeature[] = [];
    const measurements: ISeatFeature[] = [];

    // Measurements (pitch/width/recline) live in their own array, mirroring
    // React's `seat.measurements`. They may arrive on the seat object at the
    // top level or nested under `features`.
    const pitch = seat.pitch ?? seat.features?.pitch;
    const width = seat.width ?? seat.features?.width;
    const recline = seat.recline ?? seat.features?.recline;

    if (pitch != null)
      measurements.push({
        key: 'pitch',
        icon: SEAT_MEASUREMENTS_ICONS['pitch'] ?? '',
        title: locale['pitchShort'] ?? locale['pitch'] ?? 'Pitch',
        uniqId: genFeatureId(),
        value: this._convertUnit(pitch, units),
      });
    if (width != null)
      measurements.push({
        key: 'width',
        icon: SEAT_MEASUREMENTS_ICONS['width'] ?? '',
        title: locale['widthShort'] ?? locale['width'] ?? 'Width',
        uniqId: genFeatureId(),
        value: this._convertUnit(width, units),
      });
    if (recline != null)
      measurements.push({
        key: 'recline',
        icon: SEAT_MEASUREMENTS_ICONS['recline'] ?? '',
        title: locale['reclineShort'] ?? locale['recline'] ?? 'Recline',
        uniqId: genFeatureId(),
        value: this._convertUnit(recline, units),
      });

    const f = seat.features;
    if (!f) return { features, measurements };

    // Helper: React treats any truthy value (true, '+', '-') as feature present.
    const has = (v: unknown): boolean => v === true || v === '+' || v === '-';
    // Positive amenity: short localized title, raw API value, icon by key (SVG).
    const pushPositive = (key: string, apiValue: unknown, opts: { iconKey?: string; titleKey?: string } = {}) => {
      const iconKey = opts.iconKey ?? key;
      features.push({
        key,
        icon: SEAT_FEATURES_ICONS[iconKey] ?? SEAT_FEATURES_ICONS['+'] ?? '',
        title: locale[opts.titleKey ?? key] ?? key,
        uniqId: genFeatureId(),
        value: typeof apiValue === 'string' && apiValue !== '+' && apiValue !== '-' ? apiValue : true,
      });
    };
    // Negative amenity: title null, localized phrase moves into `value`,
    // icon is the React "minus" glyph.
    const pushNegative = (key: string) => {
      features.push({
        key,
        icon: SEAT_FEATURES_ICONS['-'] ?? '',
        title: null,
        uniqId: genFeatureId(),
        value: locale[key] ?? key,
      });
    };

    if (has(f.audioVideo)) pushPositive('audioVideo', f.audioVideo);

    // Combine power + USB into single amenity when both present.
    const hasPower = has(f.powerOutlet);
    const hasUsb = has(f.usbPort);
    if (hasPower && hasUsb) {
      pushPositive('powerOutlet', f.powerOutlet, { iconKey: 'power', titleKey: 'usbPowerPlug' });
    } else if (hasPower) {
      pushPositive('powerOutlet', f.powerOutlet, { iconKey: 'power', titleKey: 'powerPlug' });
    } else if (hasUsb) {
      pushPositive('usbPort', f.usbPort, { iconKey: 'usb', titleKey: 'usbPlug' });
    }

    // React uses `wifi` as the public feature key (not `wifiEnabled`) — see
    // jets-seatmap-react-lib-pub/src/common/data-preparer.js:99. The raw API
    // field is still `wifiEnabled`; only the emitted key/locale lookup change.
    if (has(f.wifiEnabled)) pushPositive('wifi', f.wifiEnabled, { iconKey: 'wifi' });
    if (has(f.bluetooth)) pushPositive('bluetooth', f.bluetooth);
    if (has(f.extraLegroom)) pushPositive('extraLegroom', f.extraLegroom);

    if (has(f.restrictedLegroom)) pushNegative('restrictedLegroom');
    if (has(f.nearGalley)) pushNegative('nearGalley');
    if (has(f.nearLavatory)) pushNegative('nearLavatory');
    if (has((f as Record<string, unknown>)['nearStairs'])) pushNegative('nearStairs');
    if (has(f.noFloorStorage)) pushNegative('noFloorStorage');
    if (has((f as Record<string, unknown>)['noOverheadStorage'])) pushNegative('noOverheadStorage');
    if (has(f.getColdByExit)) pushNegative('getColdByExit');
    if (has(f.misalignedWindow)) pushNegative('misalignedWindow');
    if (has(f.wingInWindow)) pushNegative('wingInWindow');
    if (has(f.limitedRecline)) pushNegative('limitedRecline');
    if (has(f.trayTableInArmrest)) pushNegative('trayTableInArmrest');

    return { features, measurements };
  }

  // ─── Deck extras ────────────────────────────────────────────────────────────

  private _buildExtras(deck: IApiDeck, noseType?: string): IDeckExtras {
    const exits: IExitData[] = (deck.exits ?? []).map(e => ({
      type: e.type,
      topOffset: e.topOffset,
    }));

    const bulks: IBulkData[] = (deck.bulks ?? []).map(b => ({
      id: b.id,
      type: b.type,
      width: b.width,
      height: b.height,
      xOffset: b.xOffset,
      topOffset: b.topOffset,
      align: b.align,
      stickerType: (b.iconType ?? b.stickerType ?? '').toLowerCase(),
    }));

    const wi = deck.wingsInfo;
    const wingsInfo: IWingsInfo | undefined = wi
      ? { topOffset: wi.topOffset, height: wi.height, level: wi.level }
      : undefined;

    return { exits, bulks, wingsInfo, noseType };
  }

  // ─── Legacy API format (seatScheme strings) ─────────────────────────────────

  private _getBiggestRowSizeLegacy(decks: IApiDeck[]): number {
    let max = 0;
    for (const deck of decks) {
      for (const row of deck.rows) {
        const sz = (row.seatScheme ?? '').length;
        if (sz > max) max = sz;
      }
    }
    return max;
  }

  private _prepareDeckLegacy(
    deck: IApiDeck,
    deckIndex: number,
    cabin: IApiCabin,
    config: IConfig,
    _biggestRowSize: number,
    noseType?: string,
    flightAmenities: ISeatFeature[] = [],
    globalNativeDeckWidth?: number,
    sideSpace = 0,
    cabinsByClass: Record<string, IApiCabin> = {}
  ): IDeckData {
    const fuselageStrokeWidth = config.colorTheme?.fuselageStrokeWidth ?? 12;
    const nativeDeckWidth = this._computeNativeDeckWidth(deck.rows);
    // Use global (widest) deck width for scale — matches React's single global scale
    const scaleBase = globalNativeDeckWidth ?? nativeDeckWidth;
    const { scale, deckWidth } = this._computeDeckScale(scaleBase, config.width, fuselageStrokeWidth, sideSpace);

    // Row area width = this deck's OWN native width × global scale.
    // Narrower decks (e.g. A380 upper) get proportionally narrower rows.
    const rowAreaWidth = nativeDeckWidth * scale;

    const preparedRows: IRowData[] = [];

    let lastCabinClass = '';

    for (let ri = 0; ri < deck.rows.length; ri++) {
      const row = deck.rows[ri];
      const cabinClass = row.classCode ?? row.cabinClass ?? '';

      const classChanged = cabinClass && cabinClass !== lastCabinClass;

      // Use localized cabin class label (matches React: always "Business class" etc.).
      // `config.customCabinTitles[code]` lets callers override per cabin code.
      const cabinTitle = classChanged
        ? (config.customCabinTitles?.[cabinClass.toUpperCase()] ?? this._resolveCabinLabel(cabinClass, config.lang))
        : undefined;

      if (cabinClass) lastCabinClass = cabinClass;

      // Use per-class cabin measurements if available, fall back to top-level cabin
      const rowClassCode = (row.classCode ?? row.cabinClass ?? '').toUpperCase();
      const rowCabin = cabinsByClass[rowClassCode] ?? cabin;

      const rendered = this._prepareRowLegacy(
        row,
        ri,
        rowCabin,
        config,
        scale,
        rowAreaWidth,
        cabinTitle,
        flightAmenities
      );
      if (classChanged) rendered.cabinClassCode = cabinClass.toUpperCase();
      // Always propagate cabinClassCode for cabin filtering
      if (cabinClass && !rendered.cabinClassCode) rendered.cabinClassCode = cabinClass.toUpperCase();
      if (rendered.name && !/^\d/.test(rendered.name)) {
        rendered.name = undefined;
      }
      preparedRows.push(rendered);
    }

    return {
      rows: preparedRows,
      number: deck.number ?? deckIndex + 1,
      extras: this._buildExtras(deck, noseType),
      scale,
      deckWidth,
      nativeDeckWidth,
      biggestSeatRowWidth: this._computeBiggestSeatRowWidth(deck.rows),
    };
  }

  private _prepareRowLegacy(
    row: IApiRow,
    rowIndex: number,
    cabin: IApiCabin,
    config: IConfig,
    scale: number,
    containerWidth: number,
    cabinTitle?: string,
    flightAmenities: ISeatFeature[] = []
  ): IRowData {
    const scheme = row.seatScheme ?? '';
    const legacySeats: IApiSeatLegacy[] = row.apiSeats ?? [];

    // Build letter → enriched seat data from rows.seats[] (present in hybrid API format)
    const newSeatsByLetter = new Map<string, IApiSeat>();
    for (const s of row.seats ?? []) {
      if (s.letter) newSeatsByLetter.set(s.letter, s);
    }

    // Use actual row number from API (may be non-sequential, e.g. 1-12, 14, 15, 18…)
    const rowNum = row.number ?? rowIndex + 1;

    // Row-level seat type and native width (used for aisles and as baseline)
    const rowSeatType = typeof row.seatType === 'number' ? row.seatType : DEFAULT_SEAT_TYPE;
    const [nativeRowW] = SEAT_SIZE_BY_TYPE[rowSeatType] ?? [100, 100];

    // Compute aisle width to fill remaining horizontal space
    // React caps aisles at seat width: Math.min(targetAisleWidth, width)
    const seatCount = (scheme.match(/[SE]/g) ?? []).length;
    const aisleCount = (scheme.match(/-/g) ?? []).length;
    const totalSeatWidth = seatCount * Math.round(nativeRowW * scale);
    const remaining = containerWidth - totalSeatWidth;
    const renderedSeatW = Math.round(nativeRowW * scale);
    const aisleSize =
      aisleCount > 0 ? Math.max(1, Math.min(Math.round(remaining / aisleCount), renderedSeatW)) : renderedSeatW;

    let seatIdx = 0;
    let letterIdx = 0;

    const seats: ISeatData[] = scheme.split('').map((char, i) => {
      const type: TSeatType = SEAT_SCHEME_MAP[char] ?? ENTITY_TYPE_MAP.seat;

      if (type === ENTITY_TYPE_MAP.aisle) {
        return {
          id: `aisle-${rowIndex}-${i}`,
          letter: '',
          type,
          status: ENTITY_STATUS_MAP.unavailable as TSeatStatus,
          size: aisleSize,
        };
      }
      if (type === ENTITY_TYPE_MAP.empty) {
        return {
          id: `empty-${rowIndex}-${i}`,
          letter: '',
          type,
          status: ENTITY_STATUS_MAP.unavailable as TSeatStatus,
          size: Math.max(Math.round(nativeRowW * scale), 8),
        };
      }

      // Use actual API letter if present; fall back to sequential scheme assignment
      const apiSeatBySlot = (row.seats ?? [])[seatIdx];
      const fallbackLetter = SEAT_LETTERS[letterIdx++] ?? String(letterIdx);
      const letter = apiSeatBySlot?.letter ?? fallbackLetter;
      const newSeat = newSeatsByLetter.get(letter);
      const legacy = legacySeats[seatIdx++];
      const seatNumber = legacy?.number ?? newSeat?.seatNumber ?? `${rowNum}${letter}`;

      // Per-seat seatType overrides row default; use || to match React (seatType=0 means "use row default")
      const seatIconTypeResolved = newSeat?.seatType || rowSeatType;
      const [nativeSeatW] = SEAT_SIZE_BY_TYPE[seatIconTypeResolved] ?? [100, 100];
      const perSeatRenderedSize = Math.max(Math.round(Math.max(nativeRowW, nativeSeatW) * scale), 8);

      const { features: seatFeatures, measurements } = this._prepareSeatFeaturesLegacy(
        cabin,
        legacy,
        config.lang,
        newSeat,
        config.units
      );
      // Merge flight-level amenities with per-seat amenities, dedup by feature key.
      // Measurements stay in their own array (React-aligned shape).
      const flightKeys = new Set(flightAmenities.map(a => a.key).filter(Boolean));
      const seatAmenities = seatFeatures.filter(f => !f.key || !flightKeys.has(f.key));
      const features = [...flightAmenities, ...seatAmenities];
      // Legacy API seats may have extra fields (color, score, available) beyond IApiSeatLegacy
      const legacyAny = legacy as any;
      const seatScore = newSeat?.score ?? legacyAny?.score;
      const seatApiColor = newSeat?.color ?? legacyAny?.color;
      const seatAvailable = newSeat?.available ?? legacyAny?.available;
      // React parity — see new-format path above for the rationale.
      const seatColor =
        JetsSeatMapPreparerService._calculateSeatColorByScore(
          seatScore,
          config.colorTheme?.customSeatColorRanges,
          config.colorfulSeatsByScore ?? true
        ) ??
        seatApiColor ??
        undefined;

      const classCode = (row.classCode ?? row.cabinClass ?? newSeat?.classType ?? 'E').toUpperCase();
      return {
        id: `seat-${rowIndex}-${i}`,
        uniqId: genFeatureId(),
        letter,
        type: ENTITY_TYPE_MAP.seat,
        status:
          seatAvailable === false
            ? (ENTITY_STATUS_MAP.unavailable as TSeatStatus)
            : (ENTITY_STATUS_MAP.available as TSeatStatus),
        size: perSeatRenderedSize,
        number: seatNumber,
        color: seatColor,
        originalColor: seatColor,
        score: seatScore,
        rotation: this._mapRotation(newSeat?.rotation),
        classCode,
        classType: classCode,
        // React's composite identifier: `${classCode}-${seatIconType}` (e.g. 'B-13').
        seatType: `${classCode}-${seatIconTypeResolved}`,
        seatIconType: seatIconTypeResolved,
        features,
        measurements,
        passengerTypes: legacy?.passengerTypes ?? newSeat?.passengerTypes,
        rowName: row.name,
        name: newSeat?.name,
        cabinTitle,
        topOffset: newSeat?.topOffset,
        leftOffset: newSeat?.leftOffset,
      };
    });

    return {
      id: `row-${rowIndex}`,
      seats,
      topOffset: row.topOffset,
      name: row.name,
      cabinTitle,
    };
  }

  private _prepareSeatFeaturesLegacy(
    cabin: IApiCabin,
    seat: IApiSeatLegacy | undefined,
    lang: string,
    newSeat?: IApiSeat,
    units?: string
  ): { features: ISeatFeature[]; measurements: ISeatFeature[] } {
    const locale = LOCALES_MAP[lang] ?? LOCALES_MAP['EN'];
    const features: ISeatFeature[] = [];
    const measurements: ISeatFeature[] = [];

    // Pitch/width/recline: prefer seat-level values (new API), fall back to cabin level.
    // Land them in the `measurements` array — same shape React emits.
    const seatFeatureKeys = Object.keys(newSeat?.features ?? {});
    const noReclineKeys = ['doNotRecline', 'limitedRecline', 'prereclinedSeat'];
    const isSeatWithoutRecline = seatFeatureKeys.some(k => noReclineKeys.includes(k));

    const pitch = newSeat?.pitch ?? newSeat?.features?.pitch ?? cabin.pitch;
    const width = newSeat?.width ?? newSeat?.features?.width ?? cabin.width;
    const rawRecline = newSeat?.recline ?? newSeat?.features?.recline ?? cabin.recline;
    const recline = isSeatWithoutRecline ? '- -' : rawRecline;

    if (pitch != null)
      measurements.push({
        key: 'pitch',
        icon: SEAT_MEASUREMENTS_ICONS['pitch'] ?? '',
        title: locale['pitchShort'] ?? locale['pitch'] ?? 'Pitch',
        uniqId: genFeatureId(),
        value: this._convertUnit(pitch, units),
      });
    if (width != null)
      measurements.push({
        key: 'width',
        icon: SEAT_MEASUREMENTS_ICONS['width'] ?? '',
        title: locale['widthShort'] ?? locale['width'] ?? 'Width',
        uniqId: genFeatureId(),
        value: this._convertUnit(width, units),
      });
    if (recline != null)
      measurements.push({
        key: 'recline',
        icon: SEAT_MEASUREMENTS_ICONS['recline'] ?? '',
        title: locale['reclineShort'] ?? locale['recline'] ?? 'Recline',
        uniqId: genFeatureId(),
        value: this._convertUnit(recline, units),
      });

    // Legacy string features array — best-effort key normalization, treat as positive amenities.
    for (const feat of seat?.features ?? []) {
      const key = feat.toLowerCase().replace(/[^a-z]/g, '');
      features.push({
        key,
        icon: SEAT_FEATURES_ICONS[key] ?? SEAT_FEATURES_ICONS['+'] ?? '',
        title: locale[key] ?? feat,
        uniqId: genFeatureId(),
        value: feat,
      });
    }

    // New API features object
    const nf = newSeat?.features;
    if (nf) {
      const has = (v: unknown): boolean => v === true || v === '+' || v === '-';
      const isNeg = (v: unknown): boolean => v === '-';

      const pushPositive = (key: string, apiValue: unknown, opts: { iconKey?: string; titleKey?: string } = {}) => {
        const iconKey = opts.iconKey ?? key;
        features.push({
          key,
          icon: SEAT_FEATURES_ICONS[iconKey] ?? SEAT_FEATURES_ICONS['+'] ?? '',
          title: locale[opts.titleKey ?? key] ?? key,
          uniqId: genFeatureId(),
          value: typeof apiValue === 'string' && apiValue !== '+' && apiValue !== '-' ? apiValue : true,
        });
      };
      const pushNegative = (key: string) => {
        features.push({
          key,
          icon: SEAT_FEATURES_ICONS['-'] ?? '',
          title: null,
          uniqId: genFeatureId(),
          value: locale[key] ?? key,
        });
      };
      // For features that can go either way (extraLegroom, exitRow, bassinet): pick by API value.
      const pushEither = (key: string, apiValue: unknown, opts: { titleKey?: string } = {}) =>
        isNeg(apiValue) ? pushNegative(key) : pushPositive(key, apiValue, opts);

      if (has(nf.audioVideo)) pushPositive('audioVideo', nf.audioVideo);

      const hasPower = has(nf.powerOutlet);
      const hasUsb = has(nf.usbPort);
      if (hasPower && hasUsb) {
        pushPositive('powerOutlet', nf.powerOutlet, { iconKey: 'power', titleKey: 'usbPowerPlug' });
      } else if (hasPower) {
        pushPositive('powerOutlet', nf.powerOutlet, {
          iconKey: 'power',
          titleKey: 'powerPlug',
        });
      } else if (hasUsb) {
        pushPositive('usbPort', nf.usbPort, { iconKey: 'usb', titleKey: 'usbPlug' });
      }

      if (has(nf.wifiEnabled)) pushPositive('wifiEnabled', nf.wifiEnabled, { iconKey: 'wifi' });
      if (has(nf.bluetooth)) pushPositive('bluetooth', nf.bluetooth);

      if (has(nf.extraLegroom)) pushEither('extraLegroom', nf.extraLegroom, { titleKey: 'extra_legroom' });
      if (has(nf.exitRow)) pushEither('exitRow', nf.exitRow);
      if (has(nf.bassinet)) pushEither('bassinet', nf.bassinet);

      if (has(nf.nearGalley)) pushNegative('nearGalley');
      if (has(nf.nearLavatory)) pushNegative('nearLavatory');
      if (has((nf as Record<string, unknown>)['nearStairs'])) pushNegative('nearStairs');
      if (has(nf.noFloorStorage)) pushNegative('noFloorStorage');
      if (has((nf as Record<string, unknown>)['noOverheadStorage'])) pushNegative('noOverheadStorage');
      if (has(nf.getColdByExit)) pushNegative('getColdByExit');
      if (has(nf.misalignedWindow)) pushNegative('misalignedWindow');
      if (has(nf.wingInWindow)) pushNegative('wingInWindow');
      if (has(nf.limitedRecline)) pushNegative('limitedRecline');
      if (has(nf.trayTableInArmrest)) pushNegative('trayTableInArmrest');
      if (has(nf.restrictedLegroom)) pushNegative('restrictedLegroom');
    }

    return { features, measurements };
  }

  // ─── Flight-level amenities ─────────────────────────────────────────────────

  /**
   * Build amenities from flight-level response fields (entertainment, wifi, power).
   * These apply to all seats and are shown at the top of the tooltip amenities list.
   */
  private _buildFlightAmenities(apiResponse: IApiSeatmapResponse, lang = 'EN'): ISeatFeature[] {
    const locale = LOCALES_MAP[lang] ?? LOCALES_MAP['EN'];
    const amenities: ISeatFeature[] = [];

    // React parity (data-preparer.js:87-107 + the seat feature merger): the
    // localized phrase belongs in `title` (the category label), and the API's
    // free-form `summary` belongs in `value`. Falling back to `true` when no
    // summary is present matches React's `cabin[key] = summary` shape after the
    // subsequent feature mapper turns it into `{ title: locale[key], value: cabin[key] }`.
    if (apiResponse.entertainment?.exists) {
      amenities.push({
        key: 'audioVideo',
        icon: SEAT_FEATURES_ICONS['audioVideo'] ?? '',
        title: locale['audioVideo'] ?? 'Audio and video on demand',
        uniqId: genFeatureId(),
        value: apiResponse.entertainment.summary ?? true,
      });
    }

    if (apiResponse.power?.exists) {
      const pw = apiResponse.power;
      const powerIcon = SEAT_FEATURES_ICONS['power'] ?? '';
      if (pw.powerOutlet && pw.usbPort) {
        amenities.push({
          key: 'power',
          icon: powerIcon,
          title: locale['usbPowerPlug'] ?? 'USB and power plug',
          uniqId: genFeatureId(),
          value: pw.summary ?? true,
        });
      } else if (pw.powerOutlet) {
        amenities.push({
          key: 'power',
          icon: powerIcon,
          title: locale['powerPlug'] ?? 'Power plug',
          uniqId: genFeatureId(),
          value: pw.summary ?? true,
        });
      } else if (pw.usbPort) {
        amenities.push({
          key: 'usbPort',
          icon: SEAT_FEATURES_ICONS['usb'] ?? powerIcon,
          title: locale['usbPlug'] ?? 'USB plug',
          uniqId: genFeatureId(),
          value: pw.summary ?? true,
        });
      } else {
        amenities.push({
          key: 'power',
          icon: powerIcon,
          title: locale['power'] ?? 'Power plug',
          uniqId: genFeatureId(),
          value: pw.summary ?? true,
        });
      }
    }

    if (apiResponse.wifi?.exists) {
      // React uses `wifi` as the key (not `wifiEnabled`) — see data-preparer.js:99.
      amenities.push({
        key: 'wifi',
        icon: SEAT_FEATURES_ICONS['wifi'] ?? '',
        title: locale['wifi'] ?? 'Wi-Fi',
        uniqId: genFeatureId(),
        value: apiResponse.wifi.summary ?? true,
      });
    }

    return amenities;
  }

  // ─── Shared helpers ─────────────────────────────────────────────────────────

  /**
   * Compute the scale factor from the deck's native content width.
   *
   * Groups rows by cabin class, finds the widest native row per class,
   * averages across classes (matching React's targetDeckWidth), then
   * derives scale = availablePixels / deckNativeWidth.
   *
   * This ensures seats of different types (e.g. First Suite 550px vs
   * Economy 100px) render at proportional sizes — unlike a uniform
   * seatSize which makes all seats identical width.
   */
  /**
   * Compute the native targetDeckWidth for a deck's rows.
   * Groups by cabin class, finds widest row per class, averages.
   */
  private _computeNativeDeckWidth(rows: IApiRow[]): number {
    return this._computeDeckRowAvg(rows, /* countAisles */ true);
  }

  /**
   * Same shape as `_computeNativeDeckWidth` but mirrors React's
   * `_dataHelper.findBiggestDeckRow` + `_prepareRow` with `maxRowWidth=0`
   * (data-preparer.js:164,304-313): aisle elements get width 0, so the
   * resulting average is `seats × nativeW` only. Feeds the `displayScale`
   * derivation in `JetsSeatMapComponent` — keeping it independent of the
   * aisle-inflated `nativeDeckWidth` lets row layout stay correct (aisles
   * visible) while the contour scale matches React.
   */
  private _computeBiggestSeatRowWidth(rows: IApiRow[]): number {
    return this._computeDeckRowAvg(rows, /* countAisles */ false);
  }

  private _computeDeckRowAvg(rows: IApiRow[], countAisles: boolean): number {
    interface GroupEntry {
      classCode: string;
      bestSeatCount: number;
      bestRowWidth: number;
    }
    const groups: GroupEntry[] = [];
    let currentClassCode: string | null = null;
    let bestSeatCount = 0;
    let bestRowWidth = 0;

    for (const row of rows) {
      const classCode = row.classCode ?? row.cabinClass ?? 'E';

      if (classCode !== currentClassCode) {
        if (currentClassCode !== null) {
          groups.push({ classCode: currentClassCode, bestSeatCount, bestRowWidth });
        }
        currentClassCode = classCode;
        bestSeatCount = 0;
        bestRowWidth = 0;
      }

      const scheme = row.seatScheme ?? '';
      let seatCount = 0;
      let nativeRowWidth = 0;

      if (scheme) {
        seatCount = (scheme.match(/S/g) ?? []).length;
        const seatType = row.seatType ?? DEFAULT_SEAT_TYPE;
        const [nativeW] = SEAT_SIZE_BY_TYPE[seatType] ?? [100, 100];
        // countAisles=true → `scheme.length × nativeW` (preparer needs aisle
        // budget downstream; see `_prepareRowNew` line 230 distributing
        // `remaining` to aisles).
        // countAisles=false → `seatCount × nativeW` (React parity for the
        // displayScale denominator — `data-preparer.js:304-313` collapses
        // aisle widths to 0 when `maxRowWidth=0`).
        nativeRowWidth = (countAisles ? scheme.length : seatCount) * nativeW;
      } else {
        const seats = row.seats ?? [];
        const rowSeatType = row.seatType ?? DEFAULT_SEAT_TYPE;
        const [nativeW] = SEAT_SIZE_BY_TYPE[rowSeatType] ?? [100, 100];
        let totalLen = 0;
        for (const s of seats) {
          if (this._apiSeatType(s) !== ENTITY_TYPE_MAP.aisle) seatCount++;
          totalLen++;
        }
        nativeRowWidth = (countAisles ? totalLen : seatCount) * nativeW;
      }

      if (seatCount > bestSeatCount) {
        bestSeatCount = seatCount;
        bestRowWidth = nativeRowWidth;
      }
    }
    if (currentClassCode !== null) {
      groups.push({ classCode: currentClassCode, bestSeatCount, bestRowWidth });
    }

    const sum = groups.reduce((acc, g) => acc + g.bestRowWidth, 0);
    return groups.length > 0 ? sum / groups.length : 1;
  }

  /**
   * Compute scale and rendered deckWidth from a nativeDeckWidth.
   * Called with the GLOBAL (widest) nativeDeckWidth so all decks
   * share one scale factor — matching React's single CSS transform.
   * Each deck's own nativeDeckWidth is stored separately for floor narrowing.
   */
  private _computeDeckScale(
    nativeDeckWidth: number,
    containerWidth: number,
    fuselageStrokeWidth = 12,
    sideSpace = 0
  ): { scale: number; deckWidth: number } {
    const DECK_PADDING = 10;
    const FUSELAGE_OUTLINE = 12;
    const innerDeckWidth = nativeDeckWidth + (DECK_PADDING + FUSELAGE_OUTLINE) * 2;
    // Reserve body border (fuselageStrokeWidth) AND the `fuselageFillColor`
    // lining on each side — the lining mirrors React's
    // `borderWidth = max((innerW - deck.width)*0.5 - fuselageStrokeWidth, fuselageStrokeWidth)`
    // (PlaneBody/index.js:86-94), minimum width == fuselageStrokeWidth.
    const maxDeckWidth = innerDeckWidth + fuselageStrokeWidth * 4 + sideSpace * 2;
    const scale = maxDeckWidth > 0 ? containerWidth / maxDeckWidth : 1;

    return { scale, deckWidth: innerDeckWidth * scale };
  }

  /** Map API rotation string → TSeatRotation CSS class suffix */
  private _mapRotation(apiRotation: string | undefined): import('../types').TSeatRotation {
    const map: Record<string, import('../types').TSeatRotation> = {
      nw: 'nw',
      nw45: 'nw45',
      ne: 'ne',
      ne45: 'ne45',
      s: 's',
      se: 'se',
      sw: 'sw',
      n: '',
      '': '',
    };
    return map[apiRotation ?? ''] ?? '';
  }

  private _calculateSeatSize(mapWidth: number, rowSize: number): number {
    if (!rowSize) return DEFAULT_SEAT_SIZE;
    const available = mapWidth;
    const size = Math.floor(available / rowSize);
    return Math.max(size, 16);
  }

  private _resolveCabinLabel(cabinClass: string, lang: string): string {
    const locale = LOCALES_MAP[lang] ?? LOCALES_MAP['EN'];
    const map: Record<string, string> = {
      F: locale['first'] ?? 'First',
      B: locale['business'] ?? 'Business',
      P: locale['premium'] ?? 'Premium Economy',
      E: locale['economy'] ?? 'Economy',
    };
    return map[cabinClass.toUpperCase()] ?? cabinClass;
  }

  /** Map seat score (1-10) to color using configurable ranges */
  static _calculateSeatColorByScore(
    score: number | undefined,
    colorRanges?: Array<{ range: [number, number]; color: string }>,
    enabled = true
  ): string | null {
    if (
      !enabled ||
      typeof score !== 'number' ||
      score < 1 ||
      score > 10 ||
      !Array.isArray(colorRanges) ||
      !colorRanges.length
    ) {
      return null;
    }
    const found = colorRanges.find(r => score >= r.range[0] && score <= r.range[1]);
    return found?.color ?? null;
  }

  /** Merge user-provided color theme with defaults and apply constraints */
  static mergeColorThemeWithConstraints(
    theme: import('../types').IColorTheme | undefined
  ): import('../types').IColorTheme {
    if (!theme) return {};
    const merged = { ...theme };
    // Clamp fuselageStrokeWidth to 10-18
    if (typeof merged.fuselageStrokeWidth === 'number') {
      merged.fuselageStrokeWidth = Math.min(18, Math.max(10, merged.fuselageStrokeWidth));
    }
    // Validate customSeatColorRanges
    if (merged.customSeatColorRanges) {
      merged.customSeatColorRanges = merged.customSeatColorRanges.filter(
        r =>
          Array.isArray(r.range) &&
          r.range.length === 2 &&
          typeof r.range[0] === 'number' &&
          typeof r.range[1] === 'number' &&
          typeof r.color === 'string' &&
          r.color.length > 0
      );
    }
    return merged;
  }

  /** Prepare additionalProps from availability for tooltip rendering */
  prepareSeatAdditionalProps(
    additionalProps?: Array<{ type: string; icon?: string; label?: string; cssClass?: string }>
  ): ISeatFeature[] {
    if (!additionalProps?.length) return [];
    return additionalProps.map(item => ({
      icon: SEAT_FEATURES_ICONS[item.icon ?? 'dot'] ?? '',
      title: null,
      value: item.label,
      cssClass: item.cssClass,
    }));
  }
}
