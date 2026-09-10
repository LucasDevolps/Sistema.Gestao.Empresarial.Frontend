import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { AuthStore } from '../core/auth/auth-store';
import { CurrentUserResponse } from '../core/models/auth.models';
import { ShellComponent } from './shell.component';

function identity(permissions: string[]): CurrentUserResponse {
  return {
    userGuid: '1',
    email: 'u@h.test',
    active: true,
    permissionVersion: 1,
    employee: null,
    organization: null,
    hiringUnit: null,
    permissions,
  };
}

describe('ShellComponent navigation', () => {
  let fixture: ComponentFixture<ShellComponent>;
  let store: AuthStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: { logout: () => undefined } }],
    });
    store = TestBed.inject(AuthStore);
    fixture = TestBed.createComponent(ShellComponent);
  });

  function navLabels(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.nav__link')).map((a) =>
      (a as HTMLElement).textContent?.trim(),
    ) as string[];
  }

  it('hides "Setores" and "Categorias de setor" without the view permission', () => {
    store.setIdentity(identity(['SETOR_CRIAR', 'CATEGORIA_SETOR_CRIAR', 'CATEGORIA_SETOR_EDITAR']));
    fixture.detectChanges();
    expect(navLabels()).not.toContain('Setores');
    expect(navLabels()).not.toContain('Categorias de setor');
  });

  it('shows "Setores" with SETOR_VISUALIZAR and "Categorias de setor" with CATEGORIA_SETOR_VISUALIZAR', () => {
    store.setIdentity(identity(['SETOR_VISUALIZAR', 'CATEGORIA_SETOR_VISUALIZAR']));
    fixture.detectChanges();
    expect(navLabels()).toContain('Setores');
    expect(navLabels()).toContain('Categorias de setor');
  });

  it('always shows "Início" (no permission required)', () => {
    store.setIdentity(identity([]));
    fixture.detectChanges();
    expect(navLabels()).toContain('Início');
  });
});
