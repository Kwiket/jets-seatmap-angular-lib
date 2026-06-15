/**
 * Fixture configs for the multi-instance e2e smoke-test.
 *
 * Four `JetsSeatMapComponent` instances on a single page, two base flights
 * (QT888 and QT777 — both `cabinClass: 'A'`, so the API serves every cabin
 * class) × two distinct cabin classes each, with deliberately different
 * `colorTheme` and `horizontal` knobs. The goal is to expose any global
 * state bleed between `providedIn: 'root'` services across instances.
 */

import { IConfig, IFlight, IPassenger } from '@seatmaps.com/angular-lib';
import { BASE_CONFIG, DEMO_FLIGHTS } from '../flights.data';

export interface MultiInstanceConfig {
  title: string;
  flight: IFlight;
  config: IConfig;
  passengers?: IPassenger[];
}

const DARK_THEME_OVERRIDES = {
  seatMapBackgroundColor: '#1e1e1e',
  floorColor: '#2a2a2a',
  seatLabelColor: '#fff',
  seatStrokeColor: '#444',
  seatArmrestColor: '#666',
  armrestColor: '#666',
  notAvailableSeatsColor: '#555',
  bulkBaseColor: '#555',
  bulkCutColor: '#333',
  bulkIconColor: '#bbb',
  deckLabelTitleColor: '#fff',
  fuselageFillColor: '#3a3a3a',
  fuselageStrokeColor: '#5a5a5a',
  fuselageWindowsColor: '#5a5a5a',
  fuselageWingsColor: 'rgba(150, 150, 150, 0.5)',
};

function findFlightByKey(key: string) {
  const found = DEMO_FLIGHTS.find(f => f.key === key);
  if (!found) {
    throw new Error(`Multi-instance fixture: flight "${key}" missing from DEMO_FLIGHTS`);
  }
  return found;
}

export function getMultiInstanceConfigs(): MultiInstanceConfig[] {
  const qt888 = findFlightByKey('qt888');
  const qt777 = findFlightByKey('qt777');

  const lightTheme = (qt888.config.colorTheme ?? {}) as Record<string, unknown>;

  return [
    {
      title: 'Instance 1 — QT888 · Economy · light theme',
      flight: { ...qt888.flight, cabinClass: 'E' },
      config: { ...BASE_CONFIG, width: 400, horizontal: false, colorTheme: lightTheme as IConfig['colorTheme'] },
      passengers: qt888.passengers,
    },
    {
      title: 'Instance 2 — QT888 · Business · dark theme',
      flight: { ...qt888.flight, cabinClass: 'B' },
      config: {
        ...BASE_CONFIG,
        width: 400,
        horizontal: false,
        colorTheme: { ...lightTheme, ...DARK_THEME_OVERRIDES } as IConfig['colorTheme'],
      },
      passengers: qt888.passengers,
    },
    {
      title: 'Instance 3 — QT777 · First · light theme',
      flight: { ...qt777.flight, cabinClass: 'F' },
      config: { ...BASE_CONFIG, width: 400, horizontal: false, colorTheme: lightTheme as IConfig['colorTheme'] },
      passengers: qt777.passengers,
    },
    {
      title: 'Instance 4 — QT777 · Premium · horizontal',
      flight: { ...qt777.flight, cabinClass: 'P' },
      config: { ...BASE_CONFIG, width: 400, horizontal: true, colorTheme: lightTheme as IConfig['colorTheme'] },
      passengers: qt777.passengers,
    },
  ];
}
