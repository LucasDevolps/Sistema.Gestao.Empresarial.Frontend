import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toApiError } from '../../core/http/api-error';
import { HospitalUnitResponse } from '../../core/models/organization.models';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { OrganizationCatalogService } from './organization-catalog.service';

@Component({
  selector: 'app-hospital-unit-detail',
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
            <a class="btn btn--ghost" routerLink="/unidades-hospitalares">Voltar</a>
          </div>
        </div>
      } @else if (unit(); as u) {
        <header class="page__head">
          <div>
            <h1 class="page__title">{{ u.name }}</h1>
            <p class="page__subtitle"><app-status-badge [active]="u.active" /></p>
          </div>
          <a class="btn btn--ghost" routerLink="/unidades-hospitalares">Voltar</a>
        </header>
        <section class="card">
          <div class="card__body">
            <dl class="facts">
              <div><dt>Organização</dt><dd>{{ u.organization.name }}</dd></div>
              <div><dt>Criada em</dt><dd>{{ u.createdAt | date: 'short' }}</dd></div>
              <div><dt>Atualizada em</dt><dd>{{ u.updatedAt | date: 'short' }}</dd></div>
            </dl>
          </div>
        </section>
      }
    </div>
  `,
})
export class HospitalUnitDetailComponent implements OnInit {
  private readonly service = inject(OrganizationCatalogService);

  readonly unitGuid = input.required<string>();

  protected readonly unit = signal<HospitalUnitResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.service.getHospitalUnit(this.unitGuid()).subscribe({
      next: (data) => {
        this.unit.set(data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }
}
