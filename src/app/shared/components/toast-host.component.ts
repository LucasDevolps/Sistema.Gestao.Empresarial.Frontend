import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService } from '../../core/notifications/notification.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-host" aria-live="polite" aria-atomic="false">
      @for (item of notifications.notifications(); track item.id) {
        <div class="toast" [class]="'toast--' + item.kind" [attr.role]="item.kind === 'error' ? 'alert' : 'status'">
          <span class="toast__text">{{ item.text }}</span>
          <button type="button" class="toast__close" aria-label="Fechar" (click)="notifications.dismiss(item.id)">
            &times;
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toast-host {
        position: fixed;
        top: max(1rem, env(safe-area-inset-top));
        right: max(1rem, env(safe-area-inset-right));
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-width: min(28rem, calc(100vw - 2rem));
      }
      .toast {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-md);
        background: var(--color-surface);
        border-left: 4px solid var(--color-border);
        color: var(--color-text);
        font-size: 0.9rem;
      }
      .toast--success {
        border-left-color: var(--color-success);
      }
      .toast--error {
        border-left-color: var(--color-danger);
      }
      .toast--warning {
        border-left-color: var(--color-warning);
      }
      .toast--info {
        border-left-color: var(--color-primary);
      }
      .toast__text {
        flex: 1;
        line-height: 1.35;
      }
      .toast__close {
        border: none;
        background: none;
        font-size: 1.15rem;
        line-height: 1;
        cursor: pointer;
        color: var(--color-text-muted);
      }
      .toast__close:hover {
        color: var(--color-text);
      }
    `,
  ],
})
export class ToastHostComponent {
  readonly notifications = inject(NotificationService);
}
