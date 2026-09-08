import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** Server-side paginator. Emits 1-based page numbers (spec sections 36, "Regras comuns"). */
@Component({
  selector: 'app-paginator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="paginator" aria-label="Paginação">
      <span class="paginator__info">
        {{ rangeStart() }}–{{ rangeEnd() }} de {{ total() }}
      </span>
      <div class="paginator__controls">
        <button
          type="button"
          class="btn btn--ghost btn--sm"
          [disabled]="page() <= 1 || disabled()"
          (click)="go(page() - 1)"
        >
          Anterior
        </button>
        <span class="paginator__page">Página {{ page() }} de {{ lastPage() }}</span>
        <button
          type="button"
          class="btn btn--ghost btn--sm"
          [disabled]="page() >= lastPage() || disabled()"
          (click)="go(page() + 1)"
        >
          Próxima
        </button>
      </div>
    </nav>
  `,
  styles: [
    `
      .paginator {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem 1.5rem;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 0;
      }
      .paginator__info,
      .paginator__page {
        color: var(--color-text-muted);
        font-size: 0.85rem;
      }
      .paginator__controls {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
    `,
  ],
})
export class PaginatorComponent {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly disabled = input(false);

  readonly pageChange = output<number>();

  readonly lastPage = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly rangeStart = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1));
  readonly rangeEnd = computed(() => Math.min(this.total(), this.page() * this.pageSize()));

  go(target: number): void {
    const clamped = Math.min(Math.max(1, target), this.lastPage());
    if (clamped !== this.page()) {
      this.pageChange.emit(clamped);
    }
  }
}
