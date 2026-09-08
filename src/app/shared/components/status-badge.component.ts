import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class.badge--on]="active()" [class.badge--off]="!active()">
    {{ active() ? activeLabel() : inactiveLabel() }}
  </span>`,
  styles: [
    `
      .badge {
        display: inline-flex;
        align-items: center;
        padding: 0.15rem 0.6rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
        line-height: 1.6;
        white-space: nowrap;
      }
      .badge--on {
        background: var(--color-success-soft);
        color: var(--color-success-strong);
      }
      .badge--off {
        background: var(--color-neutral-100);
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class StatusBadgeComponent {
  readonly active = input.required<boolean>();
  readonly activeLabel = input('Ativo');
  readonly inactiveLabel = input('Inativo');
}
