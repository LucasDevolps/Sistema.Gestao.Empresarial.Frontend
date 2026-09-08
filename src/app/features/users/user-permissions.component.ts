import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store';
import { toApiError } from '../../core/http/api-error';
import { PERMISSION_CODES, PERMISSION_LABELS, PermissionCode } from '../../core/models/permission.model';
import { NotificationService } from '../../core/notifications/notification.service';
import { UsersService } from './users.service';

@Component({
  selector: 'app-user-permissions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './user-permissions.component.html',
})
export class UserPermissionsComponent implements OnInit {
  private readonly service = inject(UsersService);
  private readonly notifications = inject(NotificationService);
  private readonly store = inject(AuthStore);

  readonly userGuid = input.required<string>();

  protected readonly allCodes = PERMISSION_CODES;
  protected readonly labels = PERMISSION_LABELS;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly version = signal<number | null>(null);
  protected readonly granted = signal<ReadonlySet<string>>(new Set<string>());
  /** Code currently being written — its row is locked. */
  protected readonly pendingCode = signal<string | null>(null);

  protected readonly isSelf = computed(
    () => this.store.currentUser()?.userGuid === this.userGuid(),
  );

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getPermissions(this.userGuid()).subscribe({
      next: (data) => {
        this.granted.set(new Set(data.permissions));
        this.version.set(data.version);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }

  protected has(code: PermissionCode): boolean {
    return this.granted().has(code);
  }

  /** The admin may only grant a permission they themselves hold (spec section 32). */
  protected canGrant(code: PermissionCode): boolean {
    return this.store.hasPermission(code);
  }

  protected set(code: PermissionCode, grant: boolean): void {
    if (this.isSelf() || this.pendingCode()) {
      return;
    }
    if (grant && !this.canGrant(code)) {
      this.notifications.warning(
        'Você só pode conceder uma permissão que também possui.',
      );
      return;
    }

    this.pendingCode.set(code);
    this.service.setPermission(this.userGuid(), code, { granted: grant }).subscribe({
      next: () => {
        // No optimistic UI: re-read the target's effective permissions (spec section 32).
        this.service.getPermissions(this.userGuid()).subscribe({
          next: (data) => {
            this.granted.set(new Set(data.permissions));
            this.version.set(data.version);
            this.pendingCode.set(null);
            this.notifications.success('Permissões atualizadas.');
          },
          error: (err: unknown) => {
            this.pendingCode.set(null);
            this.notifications.error(toApiError(err).message);
          },
        });
      },
      error: (err: unknown) => {
        this.pendingCode.set(null);
        const parsed = toApiError(err);
        if (parsed.status === 403) {
          this.notifications.error(
            'Operação negada pelo servidor. Verifique se você possui a permissão e o escopo necessários.',
          );
        } else if (parsed.status === 404) {
          this.notifications.error('Usuário indisponível para alteração de permissões.');
        } else {
          this.notifications.error(parsed.message);
        }
      },
    });
  }
}
