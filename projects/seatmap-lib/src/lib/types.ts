// ─── Cabin / Passenger / Lang ────────────────────────────────────────────────
export type TCabinClass = 'E' | 'P' | 'B' | 'F' | 'A';
export type TPassengerType = 'ADT' | 'CHD' | 'INF';
export type TLang =
  | 'EN'
  | 'RU'
  | 'CN'
  | 'DE'
  | 'FR'
  | 'ES'
  | 'IT'
  | 'PT'
  | 'PT-BR'
  | 'AR'
  | 'JA'
  | 'KO'
  | 'TR'
  | 'NL'
  | 'PL'
  | 'CS'
  | 'UK'
  | 'VI';
export type TUnits = 'metric' | 'imperials';

// ─── Seat types ───────────────────────────────────────────────────────────────
export type TSeatType = 'seat' | 'aisle' | 'empty' | 'index';
export type TSeatStatus = 'available' | 'unavailable' | 'selected' | 'preferred' | 'extra' | 'disabled';
export type TSeatRotation = 'nw' | 'nw45' | 'ne' | 'ne45' | 's' | 'se' | 'sw' | '';

// ─── Flight ───────────────────────────────────────────────────────────────────
export interface IFlight {
  id: string;
  airlineCode: string;
  flightNo: string;
  departureDate: string;
  departure: string;
  arrival: string;
  cabinClass: TCabinClass;
  passengerType?: string;
  planeCode?: number | string;
  startRow?: string;
  endRow?: string;
}

// ─── Color theme ──────────────────────────────────────────────────────────────
export interface IColorTheme {
  // Seat
  seatAvailableColor?: string;
  seatUnavailableColor?: string;
  seatSelectedColor?: string;
  seatPreferredColor?: string;
  seatExtraColor?: string;
  seatLabelColor?: string;
  seatLabelTextShadow?: string;
  seatStrokeColor?: string;
  seatStrokeWidth?: number;
  seatUnavailableCrossColor?: string;
  seatSelectedStrokeColor?: string;
  seatArmrestColor?: string;
  seatBackingColor?: string;
  notAvailableSeatsColor?: string;
  // Fuselage
  /** Fill color for the full hull — nose, body and tail. Mirrors the React lib. */
  fuselageFillColor?: string;
  fuselageStrokeColor?: string;
  /** Stroke width in SVG units, clamped to 10–18 by mergeColorThemeWithConstraints. */
  fuselageStrokeWidth?: number;
  fuselageWindowsColor?: string;
  fuselageWingsColor?: string;
  fuselageNoseType?: 'default' | 'by-type';
  // Floor & background
  seatMapBackgroundColor?: string;
  floorColor?: string;
  seatmapFontColor?: string;
  // Bulk
  bulkIconColor?: string;
  bulkFloorIconColor?: string;
  bulkBaseColor?: string;
  bulkCutColor?: string;
  // Armrest / exit / hull
  armrestColor?: string;
  exitColor?: string;
  /**
   * @deprecated No longer used by the renderer — use `fuselageFillColor`
   * instead. Kept on the type so existing consumer themes still compile.
   */
  hullColor?: string;
  // Passenger badge
  defaultPassengerBadgeColor?: string;
  defaultPassengerBadgeLabelColor?: string;
  defaultPassengerBadgeBorderColor?: string;
  // Tooltip
  tooltipBackgroundColor?: string;
  tooltipHeaderColor?: string;
  tooltipBorderColor?: string;
  tooltipFontColor?: string;
  tooltipIconColor?: string;
  tooltipIconBorderColor?: string;
  tooltipIconBackgroundColor?: string;
  tooltipSelectButtonTextColor?: string;
  tooltipSelectButtonBackgroundColor?: string;
  tooltipCancelButtonTextColor?: string;
  tooltipCancelButtonBackgroundColor?: string;
  // Deck
  deckTitleColor?: string;
  deckLabelTitleColor?: string;
  deckHeightSpacing?: number;
  deckSeparation?: number;
  // Deck selector
  deckSelectorStrokeColor?: string;
  deckSelectorFillColor?: string;
  deckSelectorSize?: number;
  // Wings
  wingsWidth?: number;
  // Cabin titles
  cabinTitlesWidth?: number;
  cabinTitlesHighlightColors?: Record<string, string>;
  cabinTitlesLabelColor?: string;
  // Typography
  fontFamily?: string;
  // Exit icons
  exitIconUrlLeft?: string;
  exitIconUrlRight?: string;
  // Score-based seat coloring
  customSeatColorRanges?: Array<{ range: [number, number]; color: string }>;
  /**
   * Optional per-class override palette used when `colorfulSeatsByClass`
   * is enabled in IConfig. If a key is present for a cabin class, the
   * algorithmic HSL tint is skipped and this colour wins.
   */
  seatClassTints?: Partial<Record<TCabinClass, string>>;
  /** When true, theme seat colors override API-provided per-seat colors */
  forceThemeSeatColors?: boolean;
}

export type TScaleType = 'zoom' | 'scale';

// ─── Component overrides ──────────────────────────────────────────────────────
import type { Type } from '@angular/core';
export interface IComponentOverrides {
  JetsSeat?: Type<unknown>;
  JetsTooltip?: Type<unknown>;
  JetsTooltipView?: Type<unknown>;
  JetsNotInit?: Type<unknown>;
}

// ─── Config ───────────────────────────────────────────────────────────────────
export interface IConfig {
  width: number;
  lang: TLang;
  apiUrl: string;
  apiAppId: string;
  apiKey: string | (() => string);
  /** Authorization header scheme prepended to the bearer token. Default: 'Bearer'. */
  apiAuthorizationScheme?: string;
  /** Arbitrary metadata propagated into the API request body. */
  apiMetadata?: Record<string, unknown>;
  units?: TUnits;
  colorTheme?: IColorTheme;
  builtInTooltip?: boolean;
  builtInDeckSelector?: boolean;
  horizontal?: boolean;
  rightToLeft?: boolean;
  visibleFuselage?: boolean;
  /** Show/hide the nose independently. When undefined, falls back to visibleFuselage. */
  visibleNose?: boolean;
  /** Show/hide the tail independently. When undefined, falls back to visibleFuselage. */
  visibleTail?: boolean;
  visibleWings?: boolean;
  visibleCabinTitles?: boolean;
  singleDeckMode?: boolean;
  tooltipOnHover?: boolean;
  visibleSeatPriceLabels?: boolean;
  /**
   * When true, cabin partitions (bulks) render flat — both halves of the
   * SVG (base body and top cap) use `bulkCutColor`, hiding the pseudo-3D
   * upper/lower split. Default false keeps the existing two-tone look.
   */
  flatBulks?: boolean;
  /**
   * When true, `available` seats are tinted by cabin class so the
   * boundaries between F / B / P / E are visible. The tint is applied
   * on top of any score-based or API colour. Default false.
   */
  colorfulSeatsByClass?: boolean;
  /**
   * Gate the `IColorTheme.customSeatColorRanges` score-based seat
   * colouring. Default true keeps the legacy behaviour — when the theme
   * provides ranges and a seat has a `score`, the seat picks up the
   * matched colour. Set false to ignore ranges and fall back to
   * `seatAvailableColor` (so only `colorfulSeatsByClass` remains).
   */
  colorfulSeatsByScore?: boolean;
  currencySign?: string;
  externalPassengerManagement?: boolean;
  scaleType?: TScaleType;
  customCabinTitles?: Record<string, string>;
  hiddenSeatFeatures?: string[];
  componentOverrides?: IComponentOverrides;
}

// ─── Passenger ────────────────────────────────────────────────────────────────
export interface IPassenger {
  readonly id: string;
  seat?: { price: number; seatLabel: string };
  passengerType?: TPassengerType;
  passengerLabel?: string;
  passengerColor?: string;
  abbr?: string;
}

// ─── Availability ─────────────────────────────────────────────────────────────
export type TSeatAvailability = Array<{
  label: string;
  price: number;
  currency: string;
  color?: string;
  onlyForPassengerType?: string;
  additionalProps?: Array<{ type: string; cssClass?: string }>;
}>;

// ─── Seat feature ─────────────────────────────────────────────────────────────
/**
 * Shape mirrors React's prepared feature/measurement item.
 * - `key`: stable feature identifier matching the API (e.g. 'audioVideo', 'nearGalley', 'pitch').
 * - `icon`: full inline SVG string (looked up from SEAT_FEATURES_ICONS / SEAT_MEASUREMENTS_ICONS).
 *   Integrators render it via `innerHTML`. Never just the icon key.
 * - `title`: short localized label (e.g. 'Audio / Video', 'Pitch'). `null` for negative amenities
 *   — in that case the localized phrase moves to `value` (matches React's pros/cons convention).
 * - `value`: for measurements, the formatted dimension (e.g. '198 cm'). For positive amenities,
 *   the raw API value (true | string). For negative amenities, the localized phrase.
 * - `uniqId`: per-item identifier; useful as a React/Angular `*ngFor` track key.
 */
export interface ISeatFeature {
  key?: string;
  icon?: string;
  title: string | null;
  value?: string | number | boolean | null;
  uniqId?: string;
}

// ─── Rendered seat ────────────────────────────────────────────────────────────
export interface ISeatData {
  id: string;
  /**
   * Per-item identifier (React parity). Generated when the seat is prepared,
   * stable for the lifetime of that seat instance. Integrators can use it as
   * a `*ngFor` track key or to correlate `tooltipRequested` payloads with
   * subsequent `seatSelected` events.
   */
  uniqId?: string;
  letter: string;
  type: TSeatType;
  status: TSeatStatus;
  size: number;
  /** Internal seat number (e.g. '6L'). Renamed to `label` in the public emit payload. */
  number?: string;
  /** Emitted alias for `number` (React parity). Present on `tooltipRequested.seat`. */
  label?: string;
  /** Cabin-class single-letter code from the API row (F/B/P/E). */
  classCode?: string;
  /** Composite identifier `${classCode}-${seatIconType}` — matches React's `seatType`. */
  seatType?: string;
  color?: string;
  originalColor?: string;
  rotation?: TSeatRotation;
  passenger?: IPassenger;
  /**
   * Internally the lib treats `price` as a number. On the public emit payload
   * (`tooltipRequested.seat`) it is replaced with the formatted string
   * `${currency} ${priceValue}` (e.g. '$ 29') — see `priceValue` for the
   * raw number. Typed loose so both internal and emit shapes type-check.
   */
  price?: number | string;
  /** Raw numeric price exposed on the public emit payload. */
  priceValue?: number;
  /** Currency symbol or code (e.g. '$', 'EUR'). */
  currency?: string;
  features?: ISeatFeature[];
  measurements?: ISeatFeature[];
  additionalProps?: ISeatFeature[];
  passengerTypes?: string[];
  classType?: string;
  seatIconType?: number;
  rowName?: string;
  name?: string;
  topOffset?: number;
  leftOffset?: number;
  score?: number;
  seatWidth?: number;
  seatHeight?: number;
}

// ─── Rendered row ─────────────────────────────────────────────────────────────
export interface IRowData {
  id: string;
  seats: ISeatData[];
  topOffset?: number;
  name?: string;
  cabinTitle?: string;
  cabinClassCode?: string;
}

// ─── Deck extras ──────────────────────────────────────────────────────────────
export interface IExitData {
  type: 'left' | 'right';
  topOffset: number;
}

export interface IBulkData {
  id?: string;
  type?: number;
  width?: number;
  height?: number;
  xOffset?: number;
  topOffset?: number;
  align?: 'left' | 'right' | 'center';
  stickerType?: string;
}

export interface IWingsInfo {
  topOffset?: number;
  height?: number;
  level?: number;
  visibleWingsLeadings?: boolean;
}

export interface IDeckExtras {
  exits?: IExitData[];
  bulks?: IBulkData[];
  wingsInfo?: IWingsInfo;
  noseType?: string;
  planeBodyHeight?: number;
}

// ─── Rendered deck ────────────────────────────────────────────────────────────
export interface IDeckData {
  rows: IRowData[];
  number?: number;
  title?: string;
  extras?: IDeckExtras;
  /** Scale factor to convert API coordinate units → rendered pixels */
  scale?: number;
  /** Rendered deck content width in px (for fuselage border calculation) */
  deckWidth?: number;
  /** Native (unscaled) targetDeckWidth — used to compute per-deck floor narrowing */
  nativeDeckWidth?: number;
}

// ─── Legend ──────────────────────────────────────────────────────────────────
export interface ILegendItem {
  label: string;
  color: string;
  borderColor?: string;
  icon?: 'cross' | 'checkmark';
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
export interface ITooltipData {
  seat: ISeatData;
  top: number;
  left: number;
  nextPassenger: IPassenger | null;
  lang: TLang;
  openBelow?: boolean;
}

// ─── Events ──────────────────────────────────────────────────────────────────
/**
 * Payload of `seatMapInited` event — initial layout data emitted once the
 * seatmap is rendered for the first time. Matches React's onSeatMapInited.
 */
export interface IInitialLayoutData {
  heightInPx: number;
  widthInPx: number;
  scaleFactor: number;
  decksCount: number;
  currentDeckIndex: number;
  /** Media assets (cabin photos, panoramas) loaded along with the seatmap. */
  media?: IMediaData | null;
  /** Error message, if seatmap failed to load. */
  error?: string;
  // Angular extensions (kept on top of the React contract):
  availableSeats: ISeatData[];
  /** All seats in the seatmap (regardless of availability status). */
  allSeats: ISeatData[];
  /** Available cabin classes detected in the seatmap data (before cabin filtering). */
  availableCabins: { code: string; title: string }[];
}

/** Payload of `layoutUpdated` event — emitted whenever the layout is recomputed. */
export interface ILayoutData {
  heightInPx: number;
  widthInPx: number;
  scaleFactor: number;
  decksCount: number;
  currentDeckIndex: number;
}

/** Payload of `tooltipRequested` event. */
export interface ITooltipRequestData {
  seat: ISeatData;
  element: HTMLElement;
  /** DOM event that triggered the request (click or hover). */
  event?: Event;
}

/** Payload of `seatMouseLeave` event. */
export interface ISeatMouseLeaveData {
  seat: ISeatData;
  element: HTMLElement;
  event?: Event;
}

/** Payload of `seatMouseClick` event (external passenger management + hover tooltip mode). */
export interface ISeatMouseClickData {
  seat: ISeatData;
  element: HTMLElement;
  event?: Event;
}

/** Payload of `seatMouseEnter` event (Angular-only extension). */
export interface ISeatMouseEnterData {
  seat: ISeatData;
  element: HTMLElement;
  event?: Event;
}

/** Payload of `availabilityApplied` event. */
export interface IExistingSeatsLabelsInfo {
  existingSeatLabels: string[];
  nonExistingSeatLabels: string[];
}

// ─── API request ─────────────────────────────────────────────────────────────
export interface IApiFlightRequest {
  id: string;
  airlineCode: string;
  flightNo: string;
  departureDate: string;
  departure: string;
  arrival: string;
  cabinClass: TCabinClass;
  passengerType?: string;
  planeCode?: number | string;
  startRow?: string;
  endRow?: string;
  lang?: TLang;
  units?: TUnits;
}

// ─── New API response types (/flight/features/plane/seatmap) ──────────────────
export interface IApiSeat {
  letter?: string;
  seatNumber?: string;
  /** SVG icon variant (0-4+) */
  type?: number | string;
  /** Actual API field name for seat icon type */
  seatType?: number;
  classType?: string;
  topOffset?: number;
  leftOffset?: number;
  color?: string;
  score?: number;
  name?: string;
  rotation?: string;
  /** Seat dimensions at top level (API returns these outside features) */
  pitch?: string | number;
  width?: string | number;
  recline?: string | number;
  available?: boolean;
  passengerTypes?: string[];
  features?: {
    wifiEnabled?: boolean;
    powerOutlet?: boolean;
    usbPort?: boolean;
    audioVideo?: boolean;
    extraLegroom?: boolean | string;
    restrictedLegroom?: boolean | string;
    bluetooth?: boolean;
    bassinet?: boolean | string;
    exitRow?: boolean | string;
    noFloorStorage?: boolean | string;
    trayTableInArmrest?: boolean | string;
    limitedRecline?: boolean | string;
    nearLavatory?: boolean | string;
    nearGalley?: boolean | string;
    wingInWindow?: boolean | string;
    misalignedWindow?: boolean | string;
    getColdByExit?: boolean | string;
    pitch?: number | string;
    width?: number | string;
    recline?: number | string;
    [key: string]: boolean | string | number | undefined;
  };
}

export interface IApiRow {
  seats?: IApiSeat[];
  topOffset?: number;
  name?: string;
  id?: string;
  /** Row number (may not be sequential) */
  number?: number;
  cabinClass?: string;
  /** Actual API field name for cabin class */
  classCode?: string;
  /** Legacy: seat scheme string like "SS-SSS" */
  seatScheme?: string;
  /** Legacy: row-level seat type number (indexes into SEAT_SIZE_BY_TYPE) */
  seatType?: number;
  /** Legacy: per-seat data array aligned to seatScheme */
  apiSeats?: IApiSeatLegacy[];
}

export interface IApiExit {
  type: 'left' | 'right';
  topOffset: number;
}

export interface IApiBulk {
  id?: string;
  type?: number;
  width?: number;
  height?: number;
  xOffset?: number;
  topOffset?: number;
  align?: 'left' | 'right' | 'center';
  stickerType?: string;
  iconType?: string;
}

export interface IApiWingsInfo {
  level?: number;
  height?: number;
  topOffset?: number;
}

export interface IApiPlane {
  model?: string;
  brand?: string;
  noseType?: string;
}

export interface IApiDeck {
  rows: IApiRow[];
  exits?: IApiExit[];
  bulks?: IApiBulk[];
  wingsInfo?: IApiWingsInfo;
  id?: string;
  number?: number;
  title?: string;
  cabinClass?: string;
}

export interface IApiAvailability {
  seatNumber?: string;
  price?: number;
  currency?: string;
  available?: boolean;
  passengerType?: string;
}

/** Primary API response format */
export interface IApiSeatmapResponse {
  plane?: IApiPlane;
  decks?: IApiDeck[];
  availabilities?: IApiAvailability[];
  /** Legacy cabin metadata */
  cabin?: IApiCabin;
  /** Per-class cabin metadata (keyed by class code: F, B, P, E) */
  cabinsByClass?: Record<string, IApiCabin>;
  /** Legacy nested format */
  seatDetails?: { decks: IApiDeck[] };
  /** Media assets (seat photos, cabin photos) from API */
  media?: IMediaData;
  /** Flight-level amenities */
  entertainment?: { exists?: boolean; cost?: string; deliveryType?: string; summary?: string };
  wifi?: { exists?: boolean; cost?: string; summary?: string };
  power?: {
    exists?: boolean;
    summary?: string;
    type?: string;
    usbPort?: boolean;
    powerOutlet?: boolean;
  };
}

// ─── Legacy types ─────────────────────────────────────────────────────────────
export interface IApiSeatLegacy {
  number?: string;
  available?: boolean;
  features?: string[];
  type?: string;
  passengerTypes?: string[];
}

export interface IApiCabin {
  pitch?: number;
  width?: number;
  recline?: number;
}

/** @deprecated Use IApiSeatmapResponse */
export interface IApiResponse extends IApiSeatmapResponse {}

// ─── Media ──────────────────────────────────────────────────────────────────
export interface IMediaPhotoItem {
  file: string;
  thumb: string;
  size?: { w: number; h: number };
  thumbSize?: { w: number; h: number };
  description?: string;
}

export interface IMediaPanoItem {
  file: string; // iframe URL (viewer.quicket.io)
  rawFile?: string;
  thumb: string;
  thumbSize?: { w: number; h: number };
  description?: string;
}

export interface IMediaData {
  photoData?: IMediaPhotoItem[];
  panoData?: IMediaPanoItem[];
}

export interface IGalleryItem {
  type: 'photo' | 'pano';
  src: string;
  thumb: string;
  description?: string;
}
