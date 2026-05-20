/*
 * Public API Surface of seatmap-lib
 */

// Main component
export * from './lib/components/jets-seatmap/jets-seatmap.component';

// Sub-components (for custom layouts / overrides)
export * from './lib/components/jets-deck/jets-deck.component';
export * from './lib/components/jets-row/jets-row.component';
export * from './lib/components/jets-seat/jets-seat.component';
export * from './lib/components/jets-tooltip/jets-tooltip.component';
export * from './lib/components/jets-plane-body/jets-plane-body.component';
export * from './lib/components/jets-nose/jets-nose.component';
export * from './lib/components/jets-tail/jets-tail.component';
export * from './lib/components/jets-wing/jets-wing.component';
export * from './lib/components/jets-bulk/jets-bulk.component';
export * from './lib/components/jets-deck-exit/jets-deck-exit.component';
export * from './lib/components/jets-deck-selector/jets-deck-selector.component';
export * from './lib/components/jets-deck-separator/jets-deck-separator.component';

export * from './lib/components/jets-not-init/jets-not-init.component';
export * from './lib/components/jets-no-data/jets-no-data.component';

// NgModule
export * from './lib/jets-seatmap-lib.module';

// Types
export * from './lib/types';

// Services
export { SeatmapService } from './lib/services/seatmap.service';
export { SeatmapApiService } from './lib/services/seatmap-api.service';
export { SeatmapPreparerService } from './lib/services/seatmap-preparer.service';

// Environment
export { getEnvironmentInfo } from './lib/services/environment.service';

// Utilities
export {
  getAvailableCabins,
  getCabinSubDecks,
  filterDeckByCabin,
  getCabinSubDeckWingTopAdjust,
} from './lib/utils/cabin-utils';

// Constants
export {
  LOCALES_MAP,
  SEAT_STATUS_MAP,
  SEAT_TYPE_MAP,
  CLASS_CODE_MAP,
  DEFAULT_COLOR_THEME,
  DEFAULT_LANG,
  DEFAULT_SEAT_MAP_WIDTH,
  DEFAULT_SEAT_SIZE,
  DEFAULT_TOOLTIP_WIDTH,
  SCALE_TYPES,
  SEAT_SIZE_BY_TYPE,
  DEFAULT_SEAT_TYPE,
  SEAT_FEATURES_ICONS,
  SEAT_MEASUREMENTS_ICONS,
} from './lib/constants';
