import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LOCALES_MAP } from '../../constants';

@Component({
  selector: 'sm-jets-not-init',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="jets-not-init">
      <div class="jets-not-init--spinner"></div>
      <div class="jets-not-init--text">{{ label }}</div>
    </div>
  `,
  styles: [
    `
      .jets-not-init {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        gap: 16px;
      }

      .jets-not-init--spinner {
        width: 36px;
        height: 36px;
        border: 3px solid #e0e0e0;
        border-top-color: rgb(0, 68, 153);
        border-radius: 50%;
        animation: jets-spin 0.8s linear infinite;
      }

      @keyframes jets-spin {
        to {
          transform: rotate(360deg);
        }
      }

      .jets-not-init--text {
        font-size: 13px;
        color: #888;
      }
    `,
  ],
})
export class JetsNotInitComponent {
  @Input() lang = 'EN';

  get label(): string {
    return LOCALES_MAP[this.lang]?.['loading'] || 'Loading seat map...';
  }
}
