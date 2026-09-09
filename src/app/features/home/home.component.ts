import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store';
import { PermissionCode } from '../../core/models/permission.model';

interface QuickLink {
  readonly label: string;
  readonly description: string;
  readonly path: string;
  readonly permissions: readonly PermissionCode[];
}

const QUICK_LINKS: readonly QuickLink[] = [
  {
    label: 'Funcionários',
    description: 'Consultar e administrar funcionários e seus vínculos.',
    path: '/funcionarios',
    permissions: ['FUNCIONARIO_VISUALIZAR'],
  },
  {
    label: 'Profissões',
    description: 'Catálogo de profissões.',
    path: '/profissoes',
    permissions: ['PROFISSAO_VISUALIZAR'],
  },
  {
    label: 'Cargos',
    description: 'Catálogo de cargos.',
    path: '/cargos',
    permissions: ['CARGO_VISUALIZAR'],
  },
  {
    label: 'Níveis profissionais',
    description: 'Consulta dos níveis profissionais.',
    path: '/niveis-profissionais',
    permissions: ['NIVEL_PROFISSIONAL_VISUALIZAR'],
  },
  {
    label: 'Unidades hospitalares',
    description: 'Unidades da sua organização.',
    path: '/unidades-hospitalares',
    permissions: ['FUNCIONARIO_VISUALIZAR'],
  },
  {
    label: 'Setores',
    description: 'Setores das unidades da sua organização.',
    path: '/setores',
    permissions: ['SETOR_VISUALIZAR'],
  },
  {
    label: 'Usuários e permissões',
    description: 'Administração das permissões efetivas dos usuários.',
    path: '/usuarios',
    permissions: ['USUARIO_GERENCIAR_PERMISSOES'],
  },
];

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="page stack">
      <header class="page__head">
        <div>
          <h1 class="page__title">Bem-vindo(a){{ firstName() ? ', ' + firstName() : '' }}</h1>
          <p class="page__subtitle">Sistema de Gestão Empresarial Hospitalar</p>
        </div>
      </header>

      <section class="card">
        <div class="card__body grid-2">
          <div>
            <h2>Identidade</h2>
            <dl class="facts">
              <div><dt>E-mail</dt><dd>{{ user()?.email }}</dd></div>
              @if (user()?.employee; as emp) {
                <div><dt>Funcionário</dt><dd>{{ emp.name }}</dd></div>
                <div><dt>Matrícula</dt><dd>{{ emp.registrationNumber }}</dd></div>
              }
            </dl>
          </div>
          <div>
            <h2>Escopo organizacional</h2>
            @if (user()?.organization; as org) {
              <dl class="facts">
                <div><dt>Organização</dt><dd>{{ org.name }}</dd></div>
                @if (user()?.hiringUnit; as unit) {
                  <div><dt>Unidade de contratação</dt><dd>{{ unit.name }}</dd></div>
                }
              </dl>
            } @else {
              <p class="muted">
                Seu usuário não possui vínculo de funcionário ativo. As consultas de organização,
                unidades, setores e usuários podem ser negadas pelo servidor até que o vínculo seja
                estabelecido.
              </p>
            }
          </div>
        </div>
      </section>

      <section>
        <h2>Áreas disponíveis</h2>
        <div class="grid-2">
          @for (link of visibleLinks(); track link.path) {
            <a class="quick card" [routerLink]="link.path">
              <strong>{{ link.label }}</strong>
              <span class="muted">{{ link.description }}</span>
            </a>
          } @empty {
            <p class="muted">
              Nenhuma área liberada para o seu perfil no momento. Solicite acesso ao administrador.
            </p>
          }
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .quick {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding: 1.1rem 1.25rem;
        text-decoration: none;
        color: var(--color-text);
        transition: box-shadow 0.15s ease, transform 0.15s ease;
      }
      .quick:hover {
        box-shadow: var(--shadow-md);
        transform: translateY(-2px);
        text-decoration: none;
      }
      .quick strong {
        color: var(--color-primary-dark);
      }
    `,
  ],
})
export class HomeComponent {
  private readonly store = inject(AuthStore);

  protected readonly user = this.store.currentUser;
  protected readonly firstName = computed(
    () => this.store.displayName().split(' ')[0] ?? '',
  );
  protected readonly visibleLinks = computed(() =>
    QUICK_LINKS.filter(
      (link) => link.permissions.length === 0 || this.store.hasAll(link.permissions),
    ),
  );
}
