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
  SEAT_STATUS_MAP,
  SEAT_TYPE_MAP,
} from '../constants';

@Injectable({ providedIn: 'root' })
export class SeatmapPreparerService {
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
    const wingsW =
      config.visibleWings !== false && hasWings ? (config.colorTheme?.wingsWidth ?? 30) : 0;
    const cabinTitlesW =
      config.visibleCabinTitles !== false ? (config.colorTheme?.cabinTitlesWidth ?? 80) : 0;
    const sideSpace = Math.max(wingsW, cabinTitlesW);

    // Detect format: new (per-seat topOffset) vs legacy (seatScheme strings)
    const isNewFormat = this._isNewApiFormat(decks);
    if (isNewFormat) {
      return decks.map((deck, i) =>
        this._prepareDeckNew(
          deck,
          i,
          config,
          noseType,
          flightAmenities,
          globalNativeDeckWidth,
          sideSpace,
        ),
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
          cabinsByClass,
        ),
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
    sideSpace = 0,
  ): IDeckData {
    const rows = deck.rows ?? [];

    const fuselageStrokeWidth = config.colorTheme?.fuselageStrokeWidth ?? 12;
    const nativeDeckWidth = this._computeNativeDeckWidth(rows);
    // Use global (widest) deck width for scale — matches React's single global scale
    const scaleBase = globalNativeDeckWidth ?? nativeDeckWidth;
    const { scale, deckWidth } = this._computeDeckScale(
      scaleBase,
      config.width,
      fuselageStrokeWidth,
      sideSpace,
    );

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

      // Use localized cabin class label (matches React: always "Business class" etc.)
      const cabinTitle = classChanged
        ? this._resolveCabinLabel(cabinClass, config.lang)
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
      );
      if (classChanged) rendered.cabinClassCode = cabinClass.toUpperCase();
      // Always propagate cabinClassCode for cabin filtering
      if (cabinClass && !rendered.cabinClassCode)
        rendered.cabinClassCode = cabinClass.toUpperCase();
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
    };
  }

  private _getMaxSeatsInRowNew(rows: IApiRow[]): number {
    let max = 0;
    for (const row of rows) {
      const count =
        row.seats?.filter(s => this._apiSeatType(s) !== SEAT_TYPE_MAP.aisle).length ?? 0;
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
      if (type === SEAT_TYPE_MAP.aisle) {
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
      aisleCount > 0
        ? Math.max(1, Math.min(Math.round(remaining / aisleCount), renderedRowW))
        : renderedRowW;

    let letterIdx = 0;
    let seatIdx = 0;

    const renderedSeats: ISeatData[] = seats.map((s, i) => {
      const type = this._apiSeatType(s);
      const nw = seatNativeWidths[i];
      const renderedSize = nw > 0 ? Math.max(Math.round(nw * scale), 8) : aisleSize;

      if (type === SEAT_TYPE_MAP.aisle) {
        return {
          id: `aisle-${rowIndex}-${i}`,
          letter: '',
          type: SEAT_TYPE_MAP.aisle,
          status: SEAT_STATUS_MAP.unavailable as TSeatStatus,
          size: aisleSize,
          leftOffset: s.leftOffset,
          topOffset: s.topOffset,
        };
      }
      if (type === SEAT_TYPE_MAP.empty) {
        return {
          id: `empty-${rowIndex}-${i}`,
          letter: '',
          type: SEAT_TYPE_MAP.empty,
          status: SEAT_STATUS_MAP.unavailable as TSeatStatus,
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
      // Merge flight-level amenities with per-seat features, avoiding duplicates by icon
      const flightIcons = new Set(flightAmenities.map(a => a.icon));
      const seatAmenities = seatFeatures.filter(f => f.value == null && !flightIcons.has(f.icon));
      const seatDimensions = seatFeatures.filter(f => f.value != null);
      const features = [...flightAmenities, ...seatAmenities, ...seatDimensions];
      const seatColor =
        s.color ??
        SeatmapPreparerService._calculateSeatColorByScore(
          s.score,
          colorTheme?.customSeatColorRanges,
        ) ??
        undefined;

      return {
        id: `seat-${rowIndex}-${i}`,
        letter,
        type: SEAT_TYPE_MAP.seat,
        status:
          s.available === false
            ? (SEAT_STATUS_MAP.unavailable as TSeatStatus)
            : (SEAT_STATUS_MAP.available as TSeatStatus),
        size: renderedSize,
        number: seatNumber,
        color: seatColor,
        originalColor: seatColor,
        score: s.score,
        rotation: this._mapRotation(s.rotation),
        classType: (row.classCode ?? row.cabinClass ?? s.classType ?? 'E').toUpperCase(),
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
      return API_SEAT_TYPE_MAP[rawType] ?? SEAT_TYPE_MAP.seat;
    }
    if (typeof rawType === 'string') {
      return SEAT_SCHEME_MAP[rawType] ?? SEAT_TYPE_MAP.seat;
    }
    // Infer from letter: no letter = aisle/empty
    if (!seat.letter && !seat.seatNumber) return SEAT_TYPE_MAP.empty;
    return SEAT_TYPE_MAP.seat;
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
    units?: string,
  ): { features: ISeatFeature[]; measurements: ISeatFeature[] } {
    const locale = LOCALES_MAP[lang] ?? LOCALES_MAP['EN'];
    const features: ISeatFeature[] = [];
    const measurements: ISeatFeature[] = [];

    // Measurements: pitch/width/recline
    const pitch = seat.pitch ?? seat.features?.pitch;
    const width = seat.width ?? seat.features?.width;
    const recline = seat.recline ?? seat.features?.recline;

    // Pitch/width/recline may be top-level on the seat object
    if (seat.pitch)
      features.push({
        title: 'Seat pitch',
        value: this._convertUnit(seat.pitch, units),
        key: 'pitch',
      });
    if (seat.width)
      features.push({
        title: 'Seat width',
        value: this._convertUnit(seat.width, units),
        key: 'width',
      });
    if (seat.recline)
      features.push({
        title: 'Seat recline',
        value: this._convertUnit(seat.recline, units),
        key: 'recline',
      });

    const f = seat.features;
    if (!f) return { features, measurements };

    // features.pitch/width/recline (nested) take precedence if present
    if (f.pitch && !seat.pitch)
      features.push({
        title: 'Seat pitch',
        value: this._convertUnit(f.pitch, units),
        key: 'pitch',
      });
    if (f.width && !seat.width)
      features.push({
        title: 'Seat width',
        value: this._convertUnit(f.width, units),
        key: 'width',
      });
    if (f.recline && !seat.recline)
      features.push({
        title: 'Seat recline',
        value: this._convertUnit(f.recline, units),
        key: 'recline',
      });

    // Helper: React treats any truthy value (true, '+', '-') as feature present.
    const has = (v: any): boolean => v === true || v === '+' || v === '-';

    // Amenities — descriptive titles matching React component style
    if (has(f.audioVideo))
      features.push({ title: 'Free on demand entertainment', icon: 'audioVideo' });

    // Combine power + USB into single amenity when both present
    const hasPower = has(f.powerOutlet);
    const hasUsb = has(f.usbPort);
    if (hasPower && hasUsb) {
      features.push({ title: 'Power available: AC/USB', icon: 'power' });
    } else if (hasPower) {
      features.push({ title: 'Power outlet', icon: 'power' });
    } else if (hasUsb) {
      features.push({ title: 'USB charging', icon: 'usb' });
    }

    if (has(f.wifiEnabled)) features.push({ title: 'Wi-Fi enabled', icon: 'wifi' });
    if (has(f.bluetooth)) features.push({ title: 'Bluetooth', icon: 'bluetooth' });
    if (has(f.extraLegroom)) features.push({ title: 'Extra legroom' });
    if (has(f.restrictedLegroom))
      features.push({ title: 'Restricted legroom', icon: 'negative', negative: true });

    // Negative/warning amenities
    if (has(f.nearGalley))
      features.push({
        title: locale['nearGalley'] ?? 'Close to galleys',
        icon: 'negative',
        negative: true,
      });
    if (has(f.nearLavatory))
      features.push({
        title: locale['nearLavatory'] ?? 'Close to restrooms',
        icon: 'negative',
        negative: true,
      });
    if (has((f as any)['nearStairs']))
      features.push({
        title: locale['nearStairs'] ?? 'Stairs, heavy traffic area',
        icon: 'negative',
        negative: true,
      });
    if (has(f.noFloorStorage))
      features.push({
        title: locale['noFloorStorage'] ?? 'No underseat storage',
        icon: 'negative',
        negative: true,
      });
    if (has((f as any)['noOverheadStorage']))
      features.push({
        title: locale['noOverheadStorage'] ?? 'Limited storage space',
        icon: 'negative',
        negative: true,
      });
    if (has(f.getColdByExit))
      features.push({
        title: locale['getColdByExit'] ?? 'Close to exit, drafts and chilly',
        icon: 'negative',
        negative: true,
      });
    if (has(f.misalignedWindow))
      features.push({
        title: locale['misalignedWindow'] ?? 'Partial or no window view',
        icon: 'negative',
        negative: true,
      });
    if (has(f.wingInWindow))
      features.push({
        title: locale['wingInWindow'] ?? 'Wing view from window',
        icon: 'negative',
        negative: true,
      });
    if (has(f.limitedRecline))
      features.push({
        title: locale['limitedRecline'] ?? 'Restricted recline',
        icon: 'negative',
        negative: true,
      });
    if (has(f.trayTableInArmrest))
      features.push({
        title: locale['trayTableInArmrest'] ?? 'Tray table in armrest',
        icon: 'negative',
        negative: true,
      });

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
    cabinsByClass: Record<string, IApiCabin> = {},
  ): IDeckData {
    const fuselageStrokeWidth = config.colorTheme?.fuselageStrokeWidth ?? 12;
    const nativeDeckWidth = this._computeNativeDeckWidth(deck.rows);
    // Use global (widest) deck width for scale — matches React's single global scale
    const scaleBase = globalNativeDeckWidth ?? nativeDeckWidth;
    const { scale, deckWidth } = this._computeDeckScale(
      scaleBase,
      config.width,
      fuselageStrokeWidth,
      sideSpace,
    );

    // Row area width = this deck's OWN native width × global scale.
    // Narrower decks (e.g. A380 upper) get proportionally narrower rows.
    const rowAreaWidth = nativeDeckWidth * scale;

    const preparedRows: IRowData[] = [];

    let lastCabinClass = '';

    for (let ri = 0; ri < deck.rows.length; ri++) {
      const row = deck.rows[ri];
      const cabinClass = row.classCode ?? row.cabinClass ?? '';

      const classChanged = cabinClass && cabinClass !== lastCabinClass;

      // Use localized cabin class label (matches React: always "Business class" etc.)
      const cabinTitle = classChanged
        ? this._resolveCabinLabel(cabinClass, config.lang)
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
        flightAmenities,
      );
      if (classChanged) rendered.cabinClassCode = cabinClass.toUpperCase();
      // Always propagate cabinClassCode for cabin filtering
      if (cabinClass && !rendered.cabinClassCode)
        rendered.cabinClassCode = cabinClass.toUpperCase();
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
    flightAmenities: ISeatFeature[] = [],
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
      aisleCount > 0
        ? Math.max(1, Math.min(Math.round(remaining / aisleCount), renderedSeatW))
        : renderedSeatW;

    let seatIdx = 0;
    let letterIdx = 0;

    const seats: ISeatData[] = scheme.split('').map((char, i) => {
      const type: TSeatType = SEAT_SCHEME_MAP[char] ?? SEAT_TYPE_MAP.seat;

      if (type === SEAT_TYPE_MAP.aisle) {
        return {
          id: `aisle-${rowIndex}-${i}`,
          letter: '',
          type,
          status: SEAT_STATUS_MAP.unavailable as TSeatStatus,
          size: aisleSize,
        };
      }
      if (type === SEAT_TYPE_MAP.empty) {
        return {
          id: `empty-${rowIndex}-${i}`,
          letter: '',
          type,
          status: SEAT_STATUS_MAP.unavailable as TSeatStatus,
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
      const perSeatRenderedSize = Math.max(
        Math.round(Math.max(nativeRowW, nativeSeatW) * scale),
        8,
      );

      const { features: seatFeatures, measurements } = this._prepareSeatFeaturesLegacy(
        cabin,
        legacy,
        config.lang,
        newSeat,
        config.units,
      );
      // Merge flight-level amenities with per-seat features, avoiding duplicates by icon
      const flightIcons = new Set(flightAmenities.map(a => a.icon));
      const seatAmenities = seatFeatures.filter(f => f.value == null && !flightIcons.has(f.icon));
      const seatDimensions = seatFeatures.filter(f => f.value != null);
      const features = [...flightAmenities, ...seatAmenities, ...seatDimensions];
      // Legacy API seats may have extra fields (color, score, available) beyond IApiSeatLegacy
      const legacyAny = legacy as any;
      const seatScore = newSeat?.score ?? legacyAny?.score;
      const seatApiColor = newSeat?.color ?? legacyAny?.color;
      const seatAvailable = newSeat?.available ?? legacyAny?.available;
      const seatColor =
        seatApiColor ??
        SeatmapPreparerService._calculateSeatColorByScore(
          seatScore,
          config.colorTheme?.customSeatColorRanges,
        ) ??
        undefined;

      return {
        id: `seat-${rowIndex}-${i}`,
        letter,
        type: SEAT_TYPE_MAP.seat,
        status:
          seatAvailable === false
            ? (SEAT_STATUS_MAP.unavailable as TSeatStatus)
            : (SEAT_STATUS_MAP.available as TSeatStatus),
        size: perSeatRenderedSize,
        number: seatNumber,
        color: seatColor,
        originalColor: seatColor,
        score: seatScore,
        rotation: this._mapRotation(newSeat?.rotation),
        classType: (row.classCode ?? row.cabinClass ?? newSeat?.classType ?? 'E').toUpperCase(),
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
    units?: string,
  ): { features: ISeatFeature[]; measurements: ISeatFeature[] } {
    const locale = LOCALES_MAP[lang] ?? LOCALES_MAP['EN'];
    const features: ISeatFeature[] = [];
    const measurements: ISeatFeature[] = [];

    // Pitch/width/recline: prefer seat-level values (new API), fall back to cabin level
    const seatFeatureKeys = Object.keys(newSeat?.features ?? {});
    const noReclineKeys = ['doNotRecline', 'limitedRecline', 'prereclinedSeat'];
    const isSeatWithoutRecline = seatFeatureKeys.some(k => noReclineKeys.includes(k));

    const pitch = newSeat?.pitch ?? newSeat?.features?.pitch ?? cabin.pitch;
    const width = newSeat?.width ?? newSeat?.features?.width ?? cabin.width;
    const rawRecline = newSeat?.recline ?? newSeat?.features?.recline ?? cabin.recline;
    const recline = isSeatWithoutRecline ? '- -' : rawRecline;

    if (pitch)
      features.push({
        title: locale['pitch'] ?? 'Seat pitch',
        value: this._convertUnit(pitch, units),
        key: 'pitch',
      });
    if (width)
      features.push({
        title: locale['width'] ?? 'Seat width',
        value: this._convertUnit(width, units),
        key: 'width',
      });
    if (recline)
      features.push({
        title: locale['recline'] ?? 'Seat recline',
        value: this._convertUnit(recline, units),
        key: 'recline',
      });

    // Legacy string features array
    for (const feat of seat?.features ?? []) {
      const key = feat.toLowerCase().replace(/[^a-z]/g, '');
      const icon = SEAT_FEATURES_ICONS[key] ?? '';
      features.push({ title: locale[key] ?? feat, icon, key });
    }

    // New API features object
    const nf = newSeat?.features;
    if (nf) {
      // Helper: React treats any truthy value (true, '+', '-') as feature present.
      // '-' means negative/warning, '+' or true means positive.
      const has = (v: any): boolean => v === true || v === '+' || v === '-';
      const isNeg = (v: any): boolean => v === '-';

      // Entertainment first
      if (has(nf.audioVideo)) {
        features.push({
          title: locale['entertainment'] ?? 'Free on demand entertainment',
          icon: 'audioVideo',
        });
      }

      // Combine power + USB when both present
      const hasPower = has(nf.powerOutlet);
      const hasUsb = has(nf.usbPort);
      if (hasPower && hasUsb) {
        features.push({ title: locale['powerAcUsb'] ?? 'Power available: AC/USB', icon: 'power' });
      } else if (hasPower) {
        features.push({ title: locale['powerOutletOnly'] ?? 'Power outlet', icon: 'power' });
      } else if (hasUsb) {
        features.push({ title: locale['usbOnly'] ?? 'USB charging', icon: 'usb' });
      }

      if (has(nf.wifiEnabled)) {
        features.push({ title: locale['wifiEnabled'] ?? 'Wi-Fi enabled', icon: 'wifi' });
      }
      if (has(nf.bluetooth)) {
        features.push({ title: locale['bluetooth'] ?? 'Bluetooth', icon: 'bluetooth' });
      }

      if (has(nf.extraLegroom)) {
        features.push({
          title: locale['extra_legroom'] ?? 'Extra legroom',
          negative: isNeg(nf.extraLegroom),
        });
      }
      if (has(nf.exitRow)) {
        features.push({ title: locale['exitRow'] ?? 'Exit row', negative: isNeg(nf.exitRow) });
      }
      if (has(nf.bassinet)) {
        features.push({ title: locale['bassinet'] ?? 'Bassinet', negative: isNeg(nf.bassinet) });
      }

      // Negative/warning amenities
      if (has(nf.nearGalley)) {
        features.push({
          title: locale['nearGalley'] ?? 'Close to galleys',
          icon: 'negative',
          negative: true,
        });
      }
      if (has(nf.nearLavatory)) {
        features.push({
          title: locale['nearLavatory'] ?? 'Close to restrooms',
          icon: 'negative',
          negative: true,
        });
      }
      if (has((nf as any).nearStairs)) {
        features.push({
          title: locale['nearStairs'] ?? 'Stairs, heavy traffic area',
          icon: 'negative',
          negative: true,
        });
      }
      if (has(nf.noFloorStorage)) {
        features.push({
          title: locale['noFloorStorage'] ?? 'No underseat storage',
          icon: 'negative',
          negative: true,
        });
      }
      if (has((nf as any).noOverheadStorage)) {
        features.push({
          title: locale['noOverheadStorage'] ?? 'Limited storage space',
          icon: 'negative',
          negative: true,
        });
      }
      if (has(nf.getColdByExit)) {
        features.push({
          title: locale['getColdByExit'] ?? 'Close to exit, drafts and chilly',
          icon: 'negative',
          negative: true,
        });
      }
      if (has(nf.misalignedWindow)) {
        features.push({
          title: locale['misalignedWindow'] ?? 'Partial or no window view',
          icon: 'negative',
          negative: true,
        });
      }
      if (has(nf.wingInWindow)) {
        features.push({
          title: locale['wingInWindow'] ?? 'Wing view from window',
          icon: 'negative',
          negative: true,
        });
      }
      if (has(nf.limitedRecline)) {
        features.push({
          title: locale['limitedRecline'] ?? 'Restricted recline',
          icon: 'negative',
          negative: true,
        });
      }
      if (has(nf.trayTableInArmrest)) {
        features.push({
          title: locale['trayTableInArmrest'] ?? 'Tray table in armrest',
          icon: 'negative',
          negative: true,
        });
      }
      if (has(nf.restrictedLegroom)) {
        features.push({
          title: locale['restrictedLegroom'] ?? 'Restricted legroom',
          icon: 'negative',
          negative: true,
        });
      }
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

    if (apiResponse.entertainment?.exists) {
      amenities.push({
        title:
          apiResponse.entertainment.summary ??
          locale['entertainment'] ??
          'Free on demand entertainment',
        icon: 'audioVideo',
      });
    }

    if (apiResponse.power?.exists) {
      const pw = apiResponse.power;
      if (pw.powerOutlet && pw.usbPort) {
        amenities.push({
          title: pw.summary ?? locale['powerAcUsb'] ?? 'Power available: AC/USB',
          icon: 'power',
        });
      } else if (pw.powerOutlet) {
        amenities.push({
          title: pw.summary ?? locale['powerOutletOnly'] ?? 'Power outlet',
          icon: 'power',
        });
      } else if (pw.usbPort) {
        amenities.push({ title: pw.summary ?? locale['usbOnly'] ?? 'USB charging', icon: 'usb' });
      } else {
        amenities.push({
          title: pw.summary ?? locale['power'] ?? 'Power available',
          icon: 'power',
        });
      }
    }

    if (apiResponse.wifi?.exists) {
      amenities.push({
        title: apiResponse.wifi.summary ?? locale['wifiEnabled'] ?? 'Wi-Fi enabled',
        icon: 'wifi',
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
    // Group rows CONSECUTIVELY by classCode — matches React's _groupRowsByCabinClass.
    // Then pick the row with the MOST SEATS per group (matches React's findBiggestDeckRow),
    // and use its total native width (all elements including aisles).
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
        nativeRowWidth = scheme.length * nativeW;
      } else {
        const seats = row.seats ?? [];
        const rowSeatType = row.seatType ?? DEFAULT_SEAT_TYPE;
        const [nativeW] = SEAT_SIZE_BY_TYPE[rowSeatType] ?? [100, 100];
        nativeRowWidth = seats.length * nativeW;
        // Count non-aisle seats
        for (const s of seats) {
          if (this._apiSeatType(s) !== SEAT_TYPE_MAP.aisle) seatCount++;
        }
      }

      // Pick row with most seats (like React's findBiggestDeckRow sort by S-count)
      if (seatCount > bestSeatCount) {
        bestSeatCount = seatCount;
        bestRowWidth = nativeRowWidth;
      }
    }
    if (currentClassCode !== null) {
      groups.push({ classCode: currentClassCode, bestSeatCount, bestRowWidth });
    }

    const sum = groups.reduce((acc, g) => acc + g.bestRowWidth, 0);
    const result = groups.length > 0 ? sum / groups.length : 1;
    return result;
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
    sideSpace = 0,
  ): { scale: number; deckWidth: number } {
    const DECK_PADDING = 10;
    const FUSELAGE_OUTLINE = 12;
    const innerDeckWidth = nativeDeckWidth + (DECK_PADDING + FUSELAGE_OUTLINE) * 2;
    const maxDeckWidth = innerDeckWidth + fuselageStrokeWidth * 2 + sideSpace * 2;
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
  ): string | null {
    if (
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
    theme: import('../types').IColorTheme | undefined,
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
          r.color.length > 0,
      );
    }
    return merged;
  }

  /** Prepare additionalProps from availability for tooltip rendering */
  prepareSeatAdditionalProps(
    additionalProps?: Array<{ type: string; icon?: string; label?: string; cssClass?: string }>,
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
