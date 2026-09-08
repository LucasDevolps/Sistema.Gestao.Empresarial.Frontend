import { Injectable, signal } from '@angular/core';

export type NotificationKind = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  readonly id: number;
  readonly kind: NotificationKind;
  readonly text: string;
}

/**
 * Lightweight, dependency-free user feedback channel (spec section 47).
 * Never carries backend internals — callers pass already-sanitised text.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly items = signal<readonly Notification[]>([]);
  private nextId = 1;

  readonly notifications = this.items.asReadonly();

  success(text: string): void {
    this.push('success', text, 4000);
  }

  info(text: string): void {
    this.push('info', text, 4000);
  }

  warning(text: string): void {
    this.push('warning', text, 6000);
  }

  error(text: string): void {
    this.push('error', text, 8000);
  }

  dismiss(id: number): void {
    this.items.update((current) => current.filter((n) => n.id !== id));
  }

  clear(): void {
    this.items.set([]);
  }

  private push(kind: NotificationKind, text: string, ttl: number): void {
    const id = this.nextId++;
    this.items.update((current) => [...current, { id, kind, text }]);
    if (ttl > 0) {
      setTimeout(() => this.dismiss(id), ttl);
    }
  }
}
