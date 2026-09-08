import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { AuthStore } from '../../core/auth/auth-store';
import { PermissionCode } from '../../core/models/permission.model';

/**
 * Structural directive that renders its content only when the signed-in user
 * holds the required permission(s). Deny-by-default: unknown / not-yet-loaded
 * permissions hide the content (spec section 15).
 *
 * Usage:
 *   <button *appHasPermission="'FUNCIONARIO_CRIAR'"> ... </button>
 *   <a *appHasPermission="['CARGO_CRIAR','CARGO_EDITAR']; mode: 'any'"> ... </a>
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly store = inject(AuthStore);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);

  readonly appHasPermission = input.required<PermissionCode | readonly PermissionCode[]>();
  readonly appHasPermissionMode = input<'all' | 'any'>('all');

  private visible = false;

  constructor() {
    effect(() => {
      const value = this.appHasPermission();
      const codes = Array.isArray(value) ? value : [value as PermissionCode];
      const allowed =
        this.appHasPermissionMode() === 'any' ? this.store.hasAny(codes) : this.store.hasAll(codes);
      this.render(allowed);
    });
  }

  private render(allowed: boolean): void {
    if (allowed && !this.visible) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.visible = true;
    } else if (!allowed && this.visible) {
      this.viewContainer.clear();
      this.visible = false;
    }
  }
}
