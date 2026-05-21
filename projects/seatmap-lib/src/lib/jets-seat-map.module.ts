import { NgModule } from '@angular/core';
import { JetsSeatMapComponent } from './components/jets-seat-map/jets-seat-map.component';
import { JetsDeckComponent } from './components/jets-deck/jets-deck.component';
import { JetsRowComponent } from './components/jets-row/jets-row.component';
import { JetsSeatComponent } from './components/jets-seat/jets-seat.component';
import { JetsTooltipComponent } from './components/jets-tooltip/jets-tooltip.component';
import { JetsPlaneBodyComponent } from './components/jets-plane-body/jets-plane-body.component';
import { JetsNoseComponent } from './components/jets-nose/jets-nose.component';
import { JetsTailComponent } from './components/jets-tail/jets-tail.component';
import { JetsWingComponent } from './components/jets-wing/jets-wing.component';
import { JetsBulkComponent } from './components/jets-bulk/jets-bulk.component';
import { JetsDeckExitComponent } from './components/jets-deck-exit/jets-deck-exit.component';
import { JetsDeckSelectorComponent } from './components/jets-deck-selector/jets-deck-selector.component';
import { JetsDeckSeparatorComponent } from './components/jets-deck-separator/jets-deck-separator.component';

import { JetsNotInitComponent } from './components/jets-not-init/jets-not-init.component';
import { JetsNoDataComponent } from './components/jets-no-data/jets-no-data.component';

const COMPONENTS = [
  JetsSeatMapComponent,
  JetsDeckComponent,
  JetsRowComponent,
  JetsSeatComponent,
  JetsTooltipComponent,
  JetsPlaneBodyComponent,
  JetsNoseComponent,
  JetsTailComponent,
  JetsWingComponent,
  JetsBulkComponent,
  JetsDeckExitComponent,
  JetsDeckSelectorComponent,
  JetsDeckSeparatorComponent,
  JetsNotInitComponent,
  JetsNoDataComponent,
];

@NgModule({
  imports: COMPONENTS,
  exports: COMPONENTS,
})
export class JetsSeatMapModule {}
