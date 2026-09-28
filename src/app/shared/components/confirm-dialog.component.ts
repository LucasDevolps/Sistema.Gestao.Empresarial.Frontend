import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  output,
  viewChild,
} from '@angular/core';

let nextId = 0;

/**
 * Modal confirmation for destructive actions, built on the native `<dialog>`
 * element: `showModal()` gives focus trapping, `Esc`, an inert background and
 * focus restoration without extra dependencies. The parent owns the state — it
 * opens the dialog through `open`, performs the action on `confirmed` and closes
 * it by resetting `open`; while `busy` is true both buttons are disabled and `Esc`
 * is ignored, so the action cannot be fired twice or abandoned mid-request.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="confirm-dialog"
      [attr.aria-labelledby]="titleId"
      [attr.aria-describedby]="messageId"
      (cancel)="onEscape($event)"
    >
      <div class="card">
        <div class="card__body stack">
          <h2 class="confirm-dialog__title" [id]="titleId">{{ title() }}</h2>
          <p class="confirm-dialog__message" [id]="messageId">{{ message() }}</p>
        </div>
        <div class="card__header confirm-dialog__actions">
          <button type="button" class="btn btn--ghost" [disabled]="busy()" (click)="cancelled.emit()">
            Cancelar
          </button>
          <button type="button" class="btn btn--danger" [disabled]="busy()" (click)="confirmed.emit()">
            @if (busy()) {
              <span class="spinner" aria-hidden="true"></span> Processando…
            } @else {
              {{ confirmLabel() }}
            }
          </button>
        </div>
      </div>
    </dialog>
  `,
  styles: [
    `
      .confirm-dialog {
        padding: 0;
        border: none;
        background: transparent;
        width: min(28rem, calc(100vw - 2rem));
        max-width: none;
      }
      .confirm-dialog::backdrop {
        background: rgb(15 23 42 / 0.45);
      }
      .confirm-dialog__title {
        margin: 0;
        font-size: 1.15rem;
      }
      .confirm-dialog__message {
        margin: 0;
      }
      .confirm-dialog__actions {
        justify-content: flex-end;
        border-top: 1px solid var(--color-border);
        border-bottom: none;
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirmar');
  readonly busy = input(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly titleId = `confirm-dialog-title-${nextId}`;
  protected readonly messageId = `confirm-dialog-message-${nextId++}`;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterRenderEffect(() => {
      const element = this.dialog().nativeElement;
      if (this.open() && !element.open) {
        element.showModal();
      } else if (!this.open() && element.open) {
        element.close();
      }
    });
  }

  /** `Esc` fires `cancel`: keep the parent as the single source of truth for `open`. */
  protected onEscape(event: Event): void {
    event.preventDefault();
    if (!this.busy()) {
      this.cancelled.emit();
    }
  }
}
