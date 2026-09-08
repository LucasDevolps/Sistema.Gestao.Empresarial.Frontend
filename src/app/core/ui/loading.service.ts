import { Injectable, computed, signal } from '@angular/core';

/**
 * Counts in-flight HTTP requests so the shell can show a slim top progress bar
 * without freezing the whole UI for small operations (spec section 46).
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pending = signal(0);

  readonly isLoading = computed(() => this.pending() > 0);

  begin(): void {
    this.pending.update((n) => n + 1);
  }

  end(): void {
    this.pending.update((n) => Math.max(0, n - 1));
  }

  reset(): void {
    this.pending.set(0);
  }
}
