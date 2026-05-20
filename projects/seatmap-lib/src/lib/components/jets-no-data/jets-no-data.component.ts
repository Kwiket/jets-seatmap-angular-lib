import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LOCALES_MAP } from '../../constants';

@Component({
  selector: 'sm-jets-no-data',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="jets-no-data">
      <div class="jets-no-data--icon">✈</div>
      <div class="jets-no-data--text">{{ label }}</div>
    </div>
  `,
  styles: [
    `
      .jets-no-data {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        gap: 12px;
      }

      .jets-no-data--icon {
        font-size: 32px;
        color: #ccc;
      }

      .jets-no-data--text {
        font-size: 13px;
        color: #aaa;
        text-align: center;
      }
    `,
  ],
})
export class JetsNoDataComponent {
  @Input() lang = 'EN';

  get label(): string {
    return LOCALES_MAP[this.lang]?.['noData'] || 'No seat map available';
  }
}
