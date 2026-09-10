import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { AuthStore } from '../core/auth/auth-store';
import { PermissionCode } from '../core/models/permission.model';

interface NavItem {
  readonly label: string;
  readonly path: string;
  readonly permissions: readonly PermissionCode[];
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Início', path: '/inicio', permissions: [] },
  { label: 'Funcionários', path: '/funcionarios', permissions: ['FUNCIONARIO_VISUALIZAR'] },
  { label: 'Profissões', path: '/profissoes', permissions: ['PROFISSAO_VISUALIZAR'] },
  { label: 'Cargos', path: '/cargos', permissions: ['CARGO_VISUALIZAR'] },
  {
    label: 'Níveis profissionais',
    path: '/niveis-profissionais',
    permissions: ['NIVEL_PROFISSIONAL_VISUALIZAR'],
  },
  {
    label: 'Unidades hospitalares',
    path: '/unidades-hospitalares',
    permissions: ['FUNCIONARIO_VISUALIZAR'],
  },
  { label: 'Setores', path: '/setores', permissions: ['SETOR_VISUALIZAR'] },
  {
    label: 'Categorias de setor',
    path: '/categorias-setor',
    permissions: ['CATEGORIA_SETOR_VISUALIZAR'],
  },
  {
    label: 'Usuários e permissões',
    path: '/usuarios',
    permissions: ['USUARIO_GERENCIAR_PERMISSOES'],
  },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell" [class.shell--nav-open]="navOpen()">
      <a class="skip-link" href="#conteudo">Ir para o conteúdo</a>

      <aside class="shell__sidebar" aria-label="Navegação principal">
        <div class="brand">
          <span class="brand__mark" aria-hidden="true">SGE</span>
          <span class="brand__name">Gestão Empresarial<br /><small>Hospitalar</small></span>
        </div>
        <nav class="nav">
          @for (item of visibleNav(); track item.path) {
            <a
              class="nav__link"
              [routerLink]="item.path"
              routerLinkActive="nav__link--active"
              [routerLinkActiveOptions]="{ exact: false }"
              (click)="closeNav()"
            >
              {{ item.label }}
            </a>
          }
        </nav>
      </aside>

      <div class="shell__main">
        <header class="topbar">
          <button
            type="button"
            class="topbar__toggle"
            [attr.aria-expanded]="navOpen()"
            aria-controls="nav"
            (click)="toggleNav()"
          >
            <span class="visually-hidden">Alternar menu</span>
            <span aria-hidden="true">☰</span>
          </button>
          <div class="topbar__context">
            @if (organizationName(); as org) {
              <span class="topbar__org" title="Organização atual">{{ org }}</span>
            }
          </div>
          <div class="topbar__user">
            <div class="topbar__identity">
              <strong>{{ displayName() }}</strong>
              @if (registration(); as reg) {
                <span class="muted">Matrícula {{ reg }}</span>
              }
            </div>
            <button type="button" class="btn btn--ghost btn--sm" (click)="logout()">Sair</button>
          </div>
        </header>

        <main id="conteudo" class="content" tabindex="-1">
          <router-outlet />
        </main>
      </div>

      @if (navOpen()) {
        <button type="button" class="scrim" aria-label="Fechar menu" (click)="closeNav()"></button>
      }
    </div>
  `,
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly store = inject(AuthStore);

  protected readonly navOpen = signal(false);
  protected readonly displayName = this.store.displayName;
  protected readonly organizationName = this.store.organizationName;
  protected readonly registration = computed(
    () => this.store.currentUser()?.employee?.registrationNumber ?? null,
  );

  protected readonly visibleNav = computed(() =>
    NAV_ITEMS.filter(
      (item) => item.permissions.length === 0 || this.store.hasAll(item.permissions),
    ),
  );

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }

  protected logout(): void {
    this.auth.logout();
  }
}
