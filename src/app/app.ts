import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingService } from './core/ui/loading.service';
import { ToastHostComponent } from './shared/components/toast-host.component';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastHostComponent],
  template: `
    <div class="global-progress" [class.global-progress--active]="loading.isLoading()" role="presentation"></div>
    <router-outlet />
    <app-toast-host />
  `,
  styles: [
    `
      .global-progress {
        position: fixed;
        inset: 0 0 auto 0;
        height: 3px;
        background: linear-gradient(90deg, var(--color-primary), var(--color-accent));
        transform: scaleX(0);
        transform-origin: left;
        transition: transform 0.2s ease, opacity 0.2s ease;
        opacity: 0;
        z-index: 1200;
      }
      .global-progress--active {
        transform: scaleX(0.85);
        opacity: 1;
        animation: indeterminate 1.4s ease-in-out infinite;
      }
      @keyframes indeterminate {
        0% {
          transform: scaleX(0.1);
        }
        50% {
          transform: scaleX(0.7);
        }
        100% {
          transform: scaleX(0.98);
        }
      }
    `,
  ],
})
export class App {
  protected readonly loading = inject(LoadingService);
}
