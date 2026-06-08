[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Kwiket/jets-seatmap-angular-lib/badge)](https://scorecard.dev/viewer/?uri=github.com/Kwiket/jets-seatmap-angular-lib)

# Seatmap integration and communication

This document describes how to integrate the `JetsSeatMap` lib (further "seatmap") into any Angular application. Also,
communication between the seatmap and a parent layer that embeds seatmap (further just "parent layer").

The public API of this Angular library is intentionally aligned with the React counterpart
[`@seatmaps.com/react-lib`](https://www.npmjs.com/package/@seatmaps.com/react-lib): same prop/input names, same payload
shapes, same configuration keys. A developer who has worked with the React version should feel at home here — only the
framework conventions differ (`@Input()` / `@Output()` instead of props/callbacks).

&nbsp;

## Installation

There are 2 ways to install the lib:

- using npm [version](https://www.npmjs.com/package/@kwiket/jets-seatmap-angular-lib)
- using a self-hosted version

### npm version

```bash
npm install @kwiket/jets-seatmap-angular-lib
```

### Self-hosted version

Clone this repository and install dependencies:

```bash
npm install
```

Create a gitignored `.env.local` at the repo root with your sandbox credentials, then run the dev demo:

```bash
API_URL=https://sandbox.quicket.io/api/v1
API_APP_ID=your_app_id
API_KEY=your_api_key
```

```bash
npm start
```

By default, you will see a loading bar — just input your flight parameters and the seatmap will render.

Now, you can customize the source code of the library and apply your CSS styles.

Before use, you have to build the lib:

```bash
npm run build:lib
```

After that, you can publish the library to a new or already existing GitHub repository, or publish it to your NPM account.

To connect the library to a project, run:

```bash
npm install name-of-your-lib-variation
```

or include this string into your `package.json` dependencies if you use the GitHub repo:

```json
"@kwiket/jets-seatmap-angular-lib": "git+ssh://git@github.com/path-to-your-repo.git#branch"
```

&nbsp;

## Integration

This section explains how to integrate seatmap into an Angular application.

`JetsSeatMapComponent` is a **standalone** Angular component. Add it to the `imports` of your host component (or
`NgModule`) and embed it via the `<sm-jets-seat-map>` selector:

```typescript
import { Component } from '@angular/core';
import {
  JetsSeatMapComponent,
  IConfig,
  IFlight,
  IPassenger,
  TSeatAvailability,
  IInitialLayoutData,
  ILayoutData,
  ITooltipRequestData,
} from '@kwiket/jets-seatmap-angular-lib';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [JetsSeatMapComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  flight!: IFlight;
  availability?: TSeatAvailability;
  passengers?: IPassenger[];
  config!: IConfig;
  deckIndex = 0;
  seatJumpTo?: { seatLabel: string };

  onSeatMapInited(data: IInitialLayoutData) { /* … */ }
  onSeatSelected(passengers: IPassenger[]) { /* … */ }
  onSeatUnselected(passengers: IPassenger[]) { /* … */ }
  onLayoutUpdated(data: ILayoutData) { /* … */ }
  onTooltipRequested(data: ITooltipRequestData) { /* … */ }
}
```

```html
<sm-jets-seat-map
  [flight]="flight"
  [availability]="availability"
  [passengers]="passengers"
  [config]="config"
  [currentDeckIndex]="deckIndex"
  [seatJumpTo]="seatJumpTo"
  (seatMapInited)="onSeatMapInited($event)"
  (seatSelected)="onSeatSelected($event)"
  (seatUnselected)="onSeatUnselected($event)"
  (layoutUpdated)="onLayoutUpdated($event)"
  (tooltipRequested)="onTooltipRequested($event)"
/>
```

If you prefer `NgModule`-style consumption, `JetsSeatMapModule` is also exported.

&nbsp;

## Properties

- [Seatmap integration and communication](#seatmap-integration-and-communication)
  - [Installation](#installation)
    - [npm version](#npm-version)
    - [Self-hosted version](#self-hosted-version)
  - [Integration](#integration)
  - [Properties](#properties)
    - [ Flight](#-flight)
    - [ Availability](#-availability)
    - [ Passengers](#-passengers)
    - [ Config](#-config)
    - [ seatJumpTo](#-seatjumpto)
    - [ seatMapInited](#-seatmapinited)
    - [ layoutUpdated](#-layoutupdated)
    - [ tooltipRequested](#-tooltiprequested)
    - [ seatSelected](#-seatselected)
    - [ seatUnselected](#-seatunselected)
    - [ seatMouseLeave](#-seatmouseleave)
    - [ seatMouseClick](#-seatmouseclick)
    - [ availabilityApplied](#-availabilityapplied)
    - [Angular-only extensions](#angular-only-extensions)
  - [Advanced: Overriding Components](#advanced-overriding-components)
  - [Testing](#testing)
  - [Continuous integration](#continuous-integration)

The `flight` and `config` inputs are required.

&nbsp;

### <a name="flight"></a> Flight

This input is required. It provides the data about cabin class, airline code, arrival, departure etc.

Interface, describing data types:

```typescript
interface IFlight {
  id: string;
  airlineCode: string;
  flightNo: string;
  departureDate: string;
  departure: string;
  arrival: string;
  cabinClass: string;
  passengerType?: string;
  planeCode?: number | string;
  startRow?: string;          // string [ 3 .. 24 ] characters
  endRow?: string;            // string [ 3 .. 24 ] characters
  exitRowsLeft?: number[];    // restriction by exit rows numbers
  exitRowsRight?: number[];   // restriction by exit rows numbers
}
```

Example of data the seatmap receives:

```typescript
{
  id: '1111',
  airlineCode: 'BA',
  flightNo: '106',
  departureDate: '2023-09-28',
  departure: 'DXB',
  arrival: 'LHR',
  cabinClass: 'E',
  passengerType: 'ADT',
  planeCode: null,
}
```

Cabin class values: `E` — economy, `P` — economy premium, `B` — business, `F` — first, `A` — whole plane.

The **departure** and **arrival** fields' values must be valid IATA airport codes. The **departureDate** field must be a
valid ISO date in the `yyyy-mm-dd` format.

`startRow` — first of available row numbers and its letters, colon as divider, upper case, e.g. `10` or `10:ABCDEF`. If
`startRow` is set, `endRow` also needs to be set, otherwise it will be `ignored`.
`endRow` — last of available row numbers and its letters, colon as divider, upper case, e.g. `32` or `32:ACDF`. If
`endRow` is set, `startRow` also needs to be set, otherwise it will be `ignored`.

Also, it is possible to define flexible start/end rows params: `"startRow":"1:?FL","endRow":"18:?AL"` — here `?FL` means
the row letters include `FL`, `AFL` will match, `ACFJL` not.

`exitRowsLeft` and `exitRowsRight` are optional fields that allow you to specify restrictions for aircraft based on exit
row numbers. These fields accept arrays of numbers, where each number corresponds to an exit row number.

For example:

```typescript
exitRowsLeft: [10, 20],   // Restricts seats near exit rows 10 and 20 on the left side of the plane
exitRowsRight: [10, 20],  // Restricts seats near exit rows 10 and 20 on the right side of the plane
```

If these fields are provided, the API will try to find a seat map with such exit rows. It is acceptable to populate just
one field, `exitRowsLeft` or `exitRowsRight`, with just 1 exit row number.

&nbsp;

### <a name="availability"></a> Availability

The `availability` input is an array of objects describing which seats are available for passengers. You can pass it
asynchronously or not pass at all — it is `optional`.

Interface, describing data types:

```typescript
interface IIncomingSeat {
  currency: string;
  label: string;
  price: number;
  color?: string;                       // color of the seat
  onlyForPassengerType?: TPassengerType[];
  additionalProps?: TAdditionalProp[];  // up to 12 features and props can be displayed in the tooltip
}

type TSeatAvailability = IIncomingSeat[];

type TAdditionalProp = {
  label: string;
  icon: string;            // supported icons are ["+", "-", "dot", "wifi", "movie", "power"], "dot" is default
};
```

Example of data the seatmap receives:

```typescript
[
  {
    currency: 'USD',
    label: '*',                         // wildcard: applied to all unspecified seats
    price: 33,
    onlyForPassengerType: ['ADT', 'CHD', 'INF'],
    additionalProps: [
      { label: 'Test prop for all', icon: 'dot' },
      { label: 'Another test prop for all', icon: 'wifi' },
    ],
    color: 'lightgrey',
  },
  {
    currency: 'USD',
    label: '20E',
    price: 33,
    onlyForPassengerType: ['ADT', 'CHD', 'INF'],
    additionalProps: [
      { label: 'Clear air', icon: null, cssClass: 'clear-air-style' },
      { label: 'USB plug', icon: 'power' },
    ],
    color: 'green',
  },
  { currency: 'USD', label: '20K', price: 33, onlyForPassengerType: 'ADT' },
  { currency: 'USD', label: '21F', price: 13, onlyForPassengerType: ['ADT', 'CHD', 'INF'] },
  { currency: 'USD', label: '31B', price: 13, onlyForPassengerType: ['CHD', 'INF'] },
];
```

You can pass a seat with `label` **"\*"**. This label works like an **all**-selector for seats. All seats with this
`classCode` will be enabled with the wildcard `price` — individual seat configurations override it. You can pass a seat
with `price` **0**, or no `price` field at all (treated as `0`).

If `onlyForPassengerType` is empty or doesn't exist, then it has no restrictions.

Coloring seats tip: `color` field priority — individual > wildcard > internal. If a `wildcard` color is present, it's
highly recommended to add a `color` property to all individual seats for visual distinction.

All `additionalProps` can have a `cssClass` property assigned to the container, icon and label. For example, if
`cssClass: 'clear-air-style'` you will get 3 additional CSS classes:

- `clear-air-style` — class of seat feature container
- `clear-air-style-icon` — class of seat feature icon
- `clear-air-style-label` — class of seat feature label

These CSS classes can be defined at the host level CSS.

Max count of visible seat features/props = `12`.

&nbsp;

### <a name="passengers"></a> Passengers

The `passengers` input is an array of objects that describes the passengers to be seated. You can pass it asynchronously
or not pass it at all — it is `optional`. If you don't pass the passengers list, seat selection will not work.

Interface, describing data types:

```typescript
interface IPassenger {
  readonly id: string;
  seat?: ISeat;
  passengerType?: TPassengerType;
  passengerLabel?: string;
  passengerColor?: string;
}

interface ISeat {
  price: number;
  seatLabel: string;
}

type TPassengerType = 'ADT' | 'CHD' | 'INF';
```

Example of data the seatmap receives:

```typescript
[
  { id: '1', seat: null },
  {
    id: '2',
    seat: { price: 0, seatLabel: '12F' },
    passengerLabel: 'Alex',
    passengerColor: 'brown',
    readOnly: true,
  },
  {
    id: '3',
    passengerType: 'CHD',
    seat: null,
    passengerLabel: 'John Snow',
    passengerColor: '#ccc',
  },
];
```

`seat`, `passengerType`, `passengerLabel` and `passengerColor` are not required fields. If you do not pass
`passengerType`, `passengerLabel` and `passengerColor`, default values will be used.

Please note that the seatmap identifies how many passengers to allocate by the length of the `passengers` array.
Therefore, to allocate 2 passengers without any predefined seat or its type, the `passengers` array must contain 2
items.

For passengers with `readOnly: true`, it is not possible to unselect the assigned seat.

&nbsp;

### <a name="config"></a> Config

The `config` input describes the basic configuration of the seat map.

Interface, describing data types:

```typescript
interface IConfig {
  width: number;
  lang: TLang;
  units?: TUnits;
  apiUrl: string;
  apiAppId: string;
  apiKey: string | (() => string);    // Angular extension: function form for lazy keys
  apiAuthorizationScheme?: string;
  apiMetadata?: Record<string, unknown>;
  colorTheme?: IColorTheme;
  // …flags below
}

type TUnits = 'metric' | 'imperials';
type TLang =
  | 'EN' | 'RU' | 'CN' | 'DE' | 'FR' | 'ES' | 'IT' | 'PT' | 'PT-BR'
  | 'AR' | 'JA' | 'KO' | 'TR' | 'NL' | 'PL' | 'CS' | 'UK' | 'VI';
```

Minimal `config`:

```typescript
{
  width: 400,
  lang: 'EN',
  units: 'metric',
  apiUrl: 'PROVIDED_API_URL',
  apiAppId: 'PROVIDED_APP_ID',
  apiKey: 'PROVIDED_API_KEY',
}
```

Full `config`:

```typescript
{
  width: 400,                               // width of seatmap, height will be dynamic
                                            // if `horizontal` is true — height and width are swapped (height being static)
  lang: 'EN',
  horizontal: true,                         // render seatmap horizontally or vertically
  rightToLeft: false,                       // RTL languages support
  visibleFuselage: true,                    // render nose and tail graphics
  visibleNose: true,                        // Angular: show/hide the nose independently (fallback to visibleFuselage)
  visibleTail: true,                        // Angular: show/hide the tail independently (fallback to visibleFuselage)
  visibleWings: false,                      // show position of wings
  visibleCabinTitles: true,
  customCabinTitles: { F: 'First', B: 'Business', P: 'Premium', E: 'Economy' },

  builtInDeckSelector: false,               // render built-in deck switcher (multi-deck only)
  singleDeckMode: true,                     // if false, double-deck mode is enabled

  builtInTooltip: true,                     // see `tooltipRequested` section
  externalPassengerManagement: false,       // see `tooltipRequested` section
  tooltipOnHover: false,                    // see `tooltipRequested` section

  visibleSeatPriceLabels: false,
  currencySign: '$',                        // single-character currency sign

  scaleType: 'zoom',                        // 'zoom' | 'scale', Firefox supports 'scale' only

  apiUrl: 'PROVIDED_API_URL',
  apiAppId: 'PROVIDED_APP_ID',
  apiKey: 'PROVIDED_API_KEY',               // can also be a function: () => 'PROVIDED_API_KEY'
  apiAuthorizationScheme: 'Bearer',         // sent in API client requests 'Authorization' header (default: 'Bearer')
  apiMetadata: {                            // proprietary data passed in the POST /flight/features/plane/seatmap body
    PROPRIETARY_KEY: 'PROPRIETARY_VALUE',
  },

  hiddenSeatFeatures: ['limitedRecline', 'getColdByExit', 'doNotRecline', 'wingInWindow', 'nearLavatory', 'nearGalley'],

  componentOverrides: {                     // see "Advanced: Overriding Components" section
    JetsSeat: MyCustomJetsSeat,
    JetsTooltip: MyCustomJetsTooltip,
    JetsTooltipView: MyCustomJetsTooltipView,
    JetsNotInit: MyCustomLoader,
  },

  colorTheme: {                             // most values are CSS-compatible
    seatMapBackgroundColor: 'white',

    deckLabelTitleColor: 'white',
    deckHeightSpacing: 100,                 // extra space on both ends of a deck

    wingsWidth: 50,
    deckSeparation: 0,

    floorColor: 'rgb(30,60,90)',
    seatLabelColor: 'white',
    seatStrokeColor: 'rgb(237, 237, 237)',
    seatStrokeWidth: 1,
    seatArmrestColor: '#cccccc',
    notAvailableSeatsColor: 'lightgray',

    bulkBaseColor: 'dimgrey',
    bulkCutColor: 'lightgrey',
    bulkIconColor: 'darkslategray',
    bulkFloorIconColor: 'lightgrey',

    defaultPassengerBadgeColor: 'darkred',
    defaultPassengerBadgeLabelColor: '#fff',
    defaultPassengerBadgeBorderColor: '#fff',
    fontFamily: 'Montserrat, sans-serif',

    tooltipBackgroundColor: 'rgb(255,255,255)',
    tooltipHeaderColor: '#4f6f8f',
    tooltipBorderColor: 'rgb(255,255,255)',
    tooltipFontColor: '#4f6f8f',
    tooltipIconColor: '#4f6f8f',
    tooltipIconBorderColor: '#4f6f8f',
    tooltipIconBackgroundColor: '#fff',
    tooltipSelectButtonTextColor: '#fff',
    tooltipSelectButtonBackgroundColor: 'rgb(42, 85, 128)',
    tooltipCancelButtonTextColor: '#fff',
    tooltipCancelButtonBackgroundColor: 'rgb(55, 55, 55)',

    deckSelectorStrokeColor: '#fff',
    deckSelectorFillColor: 'rgba(55, 55, 55, 0.5)',
    deckSelectorSize: 25,

    fuselageStrokeWidth: 16,                // min = 10, max = 18
    fuselageFillColor: 'lightgrey',
    fuselageStrokeColor: 'darkgrey',
    fuselageWindowsColor: 'darkgrey',
    fuselageWingsColor: 'rgba(55, 55, 55, 0.5)',
    fuselageNoseType: 'by-type',            // 'default' or 'by-type'

    exitIconUrlLeft: 'https://panorama.quicket.io/icons/exit-left.svg',
    exitIconUrlRight: 'https://panorama.quicket.io/icons/exit-right.svg',

    cabinTitlesWidth: 80,
    cabinTitlesHighlightColors: { F: '#BDB76B', B: '#FF8C00', P: '#8FBC8F', E: '#1E90FF' },
    cabinTitlesLabelColor: '#00BFFF',

    customSeatColorRanges: [
      { color: 'red',    range: [1, 3.99] },
      { color: 'yellow', range: [4, 7.99] },
      { color: 'green',  range: [8, 10] },
    ],
  },
}
```

To override exits, set **both** `exitIconUrlLeft` and `exitIconUrlRight` + define CSS for exits:

```css
.deck-exit__image {
  width: 72px;
  height: 72px;
}
```

If you don't pass optional config params, defaults will be used.

The seatmap supports dynamic seat coloring based on score values. When a seat has a `score` field and
`customSeatColorRanges` is defined in the colorTheme, the seat will be colored according to the score.

**Behavior:**

- If a seat has a `score` and `customSeatColorRanges` is defined → seat is colored based on the first matching range.
- If no matching range is found → falls back to the seat's original `color` property.
- Scores outside the 1–10 range are ignored.
- Overlapping ranges use the first matching range.

**Priority order:** Score-based color > Original seat color > Default color.

&nbsp;

### <a name="seatjumpto"></a> seatJumpTo

This **dedicated `@Input()`** allows you to open a tooltip for any seat by its label. Once the input is set, the view
will scroll to the particular seat and the tooltip will be opened automatically. This will also trigger the
[ tooltipRequested](#-tooltiprequested) event.

The input is `optional`. The component tracks the value (by `seatLabel`) and **does not re-trigger** the jump if the
same value is assigned again, or when unrelated `config` fields change.

```typescript
interface ISeatJumpToData {
  seatLabel: string;
}
```

Example:

```html
<sm-jets-seat-map ... [seatJumpTo]="{ seatLabel: '22D' }" />
```

&nbsp;

### <a name="seatmapinited"></a> seatMapInited

This event fires when the seatmap (DOM tree, content) is initialized. It provides initial layout data and the loaded
seats:

```typescript
interface IInitialLayoutData {
  heightInPx: number;           // sum of lengths of all plane elements; multiply by `scaleFactor` for actual pixels
  widthInPx: number;            // outer width of the plane (swapped with height if `horizontal` is true)
  scaleFactor: number;          // scale applied to fit into provided boundaries
  decksCount: number;
  currentDeckIndex: number;
  media: IMediaData | null;     // cabin photos / panoramas, if any
  error?: string;               // error message if a seatmap could not be built

  // Angular-only convenience fields:
  availableSeats: ISeatData[];  // seats available for passengers
  allSeats: ISeatData[];        // every seat on the plane regardless of status
  availableCabins: { code: string; title: string }[]; // detected cabin classes
}
```

`IMediaData` shape:

```typescript
interface IMediaData {
  photoData?: IMediaPhotoItem[];
  panoData?: IMediaPanoItem[];
}

interface IMediaPhotoItem {
  file: string;
  thumb: string;
  size?: { w: number; h: number };
  thumbSize?: { w: number; h: number };
  description?: string;
}

interface IMediaPanoItem {
  file: string;          // iframe URL (viewer.quicket.io)
  rawFile?: string;
  thumb: string;
  thumbSize?: { w: number; h: number };
  description?: string;
}
```

&nbsp;

### <a name="layoutupdated"></a> layoutUpdated

Fired after `seatMapInited` and on every deck switch when `builtInDeckSelector` is `true` and more than one deck is
available.

```typescript
interface ILayoutData {
  heightInPx: number;           // reflects the size of the plane with the current deck visible, not the total
  widthInPx: number;
  scaleFactor: number;
  decksCount: number;
  currentDeckIndex: number;
}
```

&nbsp;

### <a name="tooltiprequested"></a> tooltipRequested

Fired when a user clicks a seat or puts the cursor over it (when `tooltipOnHover` is `true` in `config`).

If `builtInTooltip` is `false`, the native tooltip will not show up — a custom tooltip can be shown based on the event's
data.

If `tooltipOnHover` is `true`, the user can still select/deselect seats by clicking, even with `builtInTooltip: false`.
To disable interaction completely, set `externalPassengerManagement` to `true`.

| `builtInTooltip` | `tooltipOnHover` | `externalPassengerManagement` | result                                                            |
| :--------------: | :--------------: | :---------------------------: | ----------------------------------------------------------------- |
|       true       |       false      |             false             | native tooltip on `click`, select seat via tooltip buttons        |
|       true       |       true       |             false             | native tooltip on `hover`, select seat by clicking on it          |
|      false       |       true       |             false             | `no tooltip` shown, `select seat by clicking` on it               |
|      false       |       true       |             true              | `no tooltip`, select/deselect `must be treated externally`        |

```typescript
interface ITooltipRequestData {
  seat: ISeatData;            // detailed seat info, see below
  element: HTMLElement;       // HTML element of the clicked/hovered seat; useful for tooltip positioning
  event?: Event;              // DOM event for precise coordinates / preventDefault
}

interface ISeatData {
  id: string;
  letter: string;             // letter in the row
  number?: string;            // includes row number and letter
  type: 'seat' | 'aisle' | 'empty' | 'index';
  status: 'available' | 'unavailable' | 'selected' | 'preferred' | 'extra' | 'disabled';
  size: number;
  color?: string;
  originalColor?: string;
  classType?: string;         // Economy, Business, etc.
  passenger?: IPassenger;
  price?: number;
  currency?: string;
  features?: ISeatFeature[];      // amenities (wifi, recline, etc.)
  measurements?: ISeatFeature[];  // pitch, width, recline
  additionalProps?: ISeatFeature[]; // from Availability
  passengerTypes?: string[];
  score?: number;
  // …
}

interface ISeatFeature {
  title: string | null;
  icon?: string;              // SVG icon
  value?: string | number;
  key?: string;               // i18n key ('pitch', 'width', 'recline', …)
  negative?: boolean;
}
```

**Hint:** use [`Element.getBoundingClientRect`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect)
to align a custom tooltip to the selected seat.

&nbsp;

### <a name="seatselected"></a> seatSelected

Fired when a seat is selected. Provides the updated array of passengers with seat occupancy data. Only emitted when
`externalPassengerManagement: false`.

```typescript
interface IPassenger {
  readonly id: string;
  seat?: ISeat;
  passengerType?: TPassengerType;
  passengerLabel?: string;
  passengerColor?: string;
}

interface ISeat {
  price: number;
  seatLabel: string;
}
```

&nbsp;

### <a name="seatunselected"></a> seatUnselected

Fired when a seat is unselected. Provides the updated array of passengers with seat occupancy data.

```typescript
interface IPassenger {
  readonly id: string;
  seat?: ISeat;
  passengerType?: TPassengerType;
  passengerLabel?: string;
  passengerColor?: string;
}
```

&nbsp;

### <a name="seatmouseleave"></a> seatMouseLeave

Fired when the cursor leaves the seat boundaries — **only when `tooltipOnHover === true`**. The React parent (see the
React library's `JetsSeat.js` / `SeatMap.js`) attaches the underlying mouseleave listener only in hover mode, so the
event is silent in click-tooltip mode. Payload — `ISeatMouseLeaveData`, structurally identical to
[ tooltipRequested](#-tooltiprequested).

```typescript
interface ISeatMouseLeaveData {
  seat: ISeatData;
  element: HTMLElement;
  event?: Event;
}
```

```html
<sm-jets-seat-map
  [flight]="flight"
  [config]="config"
  (seatMouseLeave)="onSeatMouseLeave($event)">
</sm-jets-seat-map>
```

```typescript
onSeatMouseLeave(data: ISeatMouseLeaveData): void {
  console.log('Seat mouse leave: ', data);
}
```

&nbsp;

### <a name="seatmouseclick"></a> seatMouseClick

Triggered when a seat is clicked while `externalPassengerManagement === true && tooltipOnHover === true` on a non-touch
device. The `builtInTooltip` setting is intentionally not part of the contract — when external passenger management
takes over, clicks become a routing signal to your code rather than to the internal tooltip. Hovering still emits
[ tooltipRequested](#-tooltiprequested) (so you can render your own hover affordance), and the built-in tooltip stays
hidden when `builtInTooltip === false`. Payload — `ISeatMouseClickData`, structurally identical to
[ tooltipRequested](#-tooltiprequested).

```typescript
interface ISeatMouseClickData {
  seat: ISeatData;
  element: HTMLElement;
  event?: Event;
}
```

```html
<sm-jets-seat-map
  [flight]="flight"
  [config]="config"
  (seatMouseClick)="onSeatMouseClick($event)">
</sm-jets-seat-map>
```

```typescript
onSeatMouseClick(data: ISeatMouseClickData): void {
  console.log('Seat mouse click: ', data);
}
```

&nbsp;

### <a name="availabilityapplied"></a> availabilityApplied

Triggered after the [Availability](#-availability) input is applied to the rendered decks — both on the initial load
(when `availability` is passed alongside `flight`) and on every subsequent change of the `availability` input. The
payload splits the provided seat labels into the ones that actually exist in the rendered seatmap and the ones that
don't, which is useful for validating that the availability source is in sync with the plane data.

```typescript
interface IExistingSeatsLabelsInfo {
  existingSeatLabels: string[];
  nonExistingSeatLabels: string[];
}
```

The wildcard `'*'` entry (if present) is excluded from both lists.

```html
<sm-jets-seat-map
  [flight]="flight"
  [config]="config"
  [availability]="availability"
  (availabilityApplied)="onAvailabilityApplied($event)">
</sm-jets-seat-map>
```

```typescript
onAvailabilityApplied(data: IExistingSeatsLabelsInfo): void {
  console.log('Availability applied: ', data);
}
```

&nbsp;

### <a name="angular-only-extensions"></a> Angular-only extensions

Beyond the React-parity API above, the Angular component exposes additional `@Output()`s and public methods that are
useful for advanced integrations. These are extensions — they don't break the React-parity contract; they sit on top of
it.

Additional `@Output()`s:

| Output                     | Payload                  | When                                                              |
| -------------------------- | ------------------------ | ----------------------------------------------------------------- |
| `deckChanged`              | `number`                 | Active deck index changed.                                        |
| `loadError`                | `string`                 | Failed to load the seatmap (HTTP error message).                  |
| `seatMouseEnter`           | `ISeatMouseEnterData`    | Cursor entered seat boundaries — fires unconditionally (Angular-only; React has no equivalent). |
| `activeTooltipChanged`     | `ITooltipData \| null`   | Built-in tooltip opened/closed.                                   |
| `legendReady`              | `ILegendItem[]`          | Legend recomputed (after load / availability change).             |
| `mediaReady`               | `IMediaData \| null`     | Media (cabin photos) finished loading.                            |
| `passengersChanged`        | `IPassenger[]`           | Internal passenger list changed (select/unselect).                |
| `selectAvailableChanged`   | `boolean`                | Whether there is a passenger to seat next.                        |
| `currencyDetected`         | `string`                 | Currency detected in availability / seatmap response.             |
| `hasAvailabilityChanged`   | `boolean`                | Whether availability is currently present.                        |

Public methods (via `@ViewChild(JetsSeatMapComponent)`):

`onSeatClick`, `onTooltipSelect`, `onTooltipUnselect`, `onDeckSelect`, `onTooltipClose`, `onSidePanelUnselect`,
`onMapClick`.

&nbsp;

## Advanced: Overriding Components

An optional `componentOverrides` object can be passed via `config` to override any of:

- `JetsSeat` — the seat unit (rendered inside `JetsRowComponent`).
- `JetsTooltip` — the tooltip container.
- `JetsTooltipView` — the presentational layer of the tooltip (alternative to overriding the whole container).
- `JetsNotInit` — the loading state shown before the seatmap is initialized.

Overrides are applied internally via `NgComponentOutlet`. Your override component must be a standalone Angular component
(or registered via an `NgModule`) and should accept the same inputs that the default implementation receives.

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-my-loader',
  standalone: true,
  template: `<div class="my-loader">Loading…</div>`,
})
export class MyCustomLoader {}

// …in the host config:
config = {
  …,
  componentOverrides: {
    JetsSeat: MyCustomJetsSeat,
    JetsTooltip: MyCustomJetsTooltip,
    JetsTooltipView: MyCustomJetsTooltipView,
    JetsNotInit: MyCustomLoader,
  },
};
```

### `JetsTooltip` vs `JetsTooltipView`

`JetsTooltipView` is an alternative way of implementing a custom tooltip by overriding only the presentational layer.
It is rendered inside the default `JetsTooltipComponent`, so you keep the built-in positioning / lifecycle without
having to re-implement them.

If you override the whole `JetsTooltip`, you take ownership of positioning, opening, closing and interaction events
(`tooltipRequested`, `activeTooltipChanged`, etc.).

&nbsp;

## Testing

The library is covered by ~226 unit tests run with **Vitest** through the official Angular 21 builder
`@angular/build:unit-test`. Vitest is API-compatible with Jest (`vi.fn` / `vi.mock` ↔ `jest.fn` / `jest.mock`) and is
the recommended runner for Angular 21+ — `jest-preset-angular` does not yet support this Angular version.

### Commands

```bash
# Run all tests once (CI-style)
npm test

# Watch mode for development
npm test -- --watch

# Coverage report (writes to ./coverage)
npm test -- --coverage
```

### Test layout

- Component tests live next to the component file (`*.component.spec.ts`).
- Service tests live next to the service file (`*.service.spec.ts`).
- Tests use Angular `TestBed` + `HttpClientTestingModule` for the API layer.

### What's covered

- Main component `JetsSeatMapComponent`: rendering, prop variations, all 17 `@Output`s, `seatJumpTo` change tracking,
  `componentOverrides`, error paths, multi-deck behaviour.
- All sub-components (`JetsDeck`, `JetsRow`, `JetsSeat`, `JetsTooltip`, `JetsWing`, `JetsNose`, `JetsTail`,
  `JetsPlaneBody`, `JetsBulk`, `JetsDeckSelector`, `JetsDeckSeparator`, `JetsDeckExit`, `JetsNotInit`, `JetsNoData`) —
  smoke + input/output.
- `JetsSeatMapApiService`: HTTP request shape, authorization scheme, `apiMetadata`, 401 retry, array response merging.
- `JetsSeatMapService` and `JetsSeatMapPreparerService`: data preparation and selection logic.

&nbsp;

## Continuous integration

CI runs on every push and pull request via `.github/workflows/ci.yml`:

- **test** job — `npm ci` + `npm test`.
- **build** job — `npm run build:lib` + `ng build seatmap-demo`.

Supply-chain and code-quality checks:

- `.github/workflows/codeql.yml` — Code Scanning (JS/TS) on push, PR and weekly cron.
- `.github/workflows/scorecard.yml` — OSSF Scorecard analysis, results published to scorecard.dev (see badge at the top).
- `.github/dependabot.yml` — weekly dependency-update PRs for npm and GitHub Actions.

Secret Scanning and Dependabot security alerts are enabled by GitHub automatically for public repositories.
