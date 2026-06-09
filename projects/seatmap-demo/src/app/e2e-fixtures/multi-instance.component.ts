import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IInitialLayoutData,
  IPassenger,
  JetsSeatMapComponent,
} from '@kwiket/jets-seatmap-angular-lib';
import { getMultiInstanceConfigs, MultiInstanceConfig } from './multi-instance-configs';

declare global {
  interface Window {
    __multiInstanceReady?: boolean[];
    __multiInstanceInited?: (IInitialLayoutData | null)[];
    __multiInstanceSelections?: IPassenger[][];
  }
}

const INSTANCE_COUNT = 4;

@Component({
  selector: 'app-multi-instance-fixture',
  standalone: true,
  imports: [CommonModule, JetsSeatMapComponent],
  templateUrl: './multi-instance.component.html',
  styleUrl: './multi-instance.component.scss',
})
export class MultiInstanceFixtureComponent {
  readonly configs: MultiInstanceConfig[] = getMultiInstanceConfigs();

  constructor() {
    if (typeof window !== 'undefined') {
      window.__multiInstanceReady = Array(INSTANCE_COUNT).fill(false);
      window.__multiInstanceInited = Array(INSTANCE_COUNT).fill(null);
      window.__multiInstanceSelections = Array.from({ length: INSTANCE_COUNT }, () => []);
    }
  }

  onInited(idx: number, event: IInitialLayoutData): void {
    if (typeof window === 'undefined') return;
    if (window.__multiInstanceInited) window.__multiInstanceInited[idx] = event;
    if (window.__multiInstanceReady) window.__multiInstanceReady[idx] = !event.error;
  }

  onSelected(idx: number, passengers: IPassenger[]): void {
    if (typeof window === 'undefined') return;
    if (window.__multiInstanceSelections) {
      window.__multiInstanceSelections[idx] = passengers.filter(p => !!p.seat);
    }
  }
}
