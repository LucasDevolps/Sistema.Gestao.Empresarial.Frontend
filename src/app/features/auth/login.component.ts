import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth-store';
import { toApiError } from '../../core/http/api-error';
import { SessionEndReason } from '../../core/models/auth.models';

const SESSION_END_MESSAGES: Record<SessionEndReason, string> = {
  logout: 'Você saiu do sistema.',
  expired: 'Sua sessão expirou por inatividade. Entre novamente.',
  revoked: 'Sua sessão foi encerrada porque você entrou em outro dispositivo.',
  'refresh-failed': 'Não foi possível renovar sua sessão. Entre novamente.',
  'identity-failed': 'Não foi possível confirmar sua identidade. Entre novamente.',
};

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="login">
      <div class="login__panel card">
        <div class="login__brand">
          <span class="login__mark" aria-hidden="true">SGE</span>
          <div>
            <h1 class="login__title">Sistema de Gestão Empresarial</h1>
            <p class="muted">Ambiente hospitalar</p>
          </div>
        </div>

        @if (sessionMessage(); as message) {
          <p class="login__notice" role="status">{{ message }}</p>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label class="field__label" for="email">E-mail</label>
            <input
              id="email"
              type="email"
              class="input"
              formControlName="email"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              [attr.aria-invalid]="isInvalid('email')"
              aria-describedby="email-error"
            />
            @if (isInvalid('email')) {
              <span id="email-error" class="field__error">Informe um e-mail válido.</span>
            }
          </div>

          <div class="field">
            <label class="field__label" for="password">Senha</label>
            <input
              id="password"
              type="password"
              class="input"
              formControlName="password"
              autocomplete="current-password"
              [attr.aria-invalid]="isInvalid('password')"
              aria-describedby="password-error"
            />
            @if (isInvalid('password')) {
              <span id="password-error" class="field__error">Informe sua senha.</span>
            }
          </div>

          @if (errorMessage(); as message) {
            <p class="login__error" role="alert">{{ message }}</p>
          }

          <button type="submit" class="btn btn--block" [disabled]="submitting()">
            @if (submitting()) {
              <span class="spinner" aria-hidden="true"></span> Entrando…
            } @else {
              Entrar
            }
          </button>
        </form>
      </div>
      <p class="login__foot muted">
        Acesso restrito. Toda a autorização é validada pelo servidor.
      </p>
    </div>
  `,
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly sessionMessage = computed(() => {
    const reason = this.store.sessionEndReason();
    return reason ? SESSION_END_MESSAGES[reason] : null;
  });

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.maxLength(500)]],
  });

  protected isInvalid(control: 'email' | 'password'): boolean {
    const ctrl = this.form.controls[control];
    return ctrl.invalid && (ctrl.touched || ctrl.dirty);
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.store.clearSessionEndReason();

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigateByUrl('/');
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const parsed = toApiError(error);
        // Avoid user enumeration: show the backend's safe message, never
        // "user exists but wrong password" (spec section 44).
        this.errorMessage.set(
          parsed.status === 401
            ? 'E-mail ou senha inválidos.'
            : parsed.status === 429
              ? parsed.message
              : parsed.message,
        );
      },
    });
  }
}
