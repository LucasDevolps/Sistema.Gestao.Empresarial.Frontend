import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toApiError } from '../../core/http/api-error';
import { SectorResponse } from '../../core/models/organization.models';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { OrganizationCatalogService } from './organization-catalog.service';

@Component({
  selector: 'app-sector-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, StatusBadgeComponent],
  template: `
    <div class="page stack">
      @if (loading()) {
        <div class="empty-state"><span class="spinner"></span> Carregando…</div>
      } @else if (error()) {
        <div class="card">
          <div class="card__body">
            <p role="alert">{{ error() }}</p>
            <a class="btn btn--ghost" routerLink="/setores">Voltar</a>
          </div>
        </div>
      } @else if (sector(); as s) {
        <header class="page__head">
          <div>
            <h1 class="page__title">{{ s.name }}</h1>
            <p class="page__subtitle"><app-status-badge [active]="s.active" /></p>
          </div>
          <a class="btn btn--ghost" routerLink="/setores">Voltar</a>
        </header>
        <section class="card">
          <div class="card__body">
            <dl class="facts">
              <div><dt>Unidade</dt><dd>{{ s.unit.name }}</dd></div>
              <div><dt>Criado em</dt><dd>{{ s.createdAt | date: 'short' }}</dd></div>
              <div><dt>Atualizado em</dt><dd>{{ s.updatedAt | date: 'short' }}</dd></div>
            </dl>
          </div>
        </section>
      }
    </div>
  `,
  styles: [
    `
      .facts {
        margin: 0;
        display: grid;
        gap: 0.5rem;
      }
      .facts div {
        display: flex;
        gap: 0.75rem;
      }
      .facts dt {
        min-width: 10rem;
        color: var(--color-text-muted);
      }
      .facts dd {
        margin: 0;
        font-weight: 550;
      }
    `,
  ],
})
export class SectorDetailComponent implements OnInit {
  private readonly service = inject(OrganizationCatalogService);

  readonly sectorGuid = input.required<string>();

  protected readonly sector = signal<SectorResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.service.getSector(this.sectorGuid()).subscribe({
      next: (data) => {
        this.sector.set(data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }
}
