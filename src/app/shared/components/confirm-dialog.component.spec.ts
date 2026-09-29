import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmDialogComponent } from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let confirmed: jasmine.Spy;
  let cancelled: jasmine.Spy;

  function dialog(): HTMLDialogElement {
    return (fixture.nativeElement as HTMLElement).querySelector('dialog') as HTMLDialogElement;
  }

  function button(selector: string): HTMLButtonElement {
    return dialog().querySelector(selector) as HTMLButtonElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ConfirmDialogComponent] });
    fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.componentRef.setInput('title', 'Excluir item');
    fixture.componentRef.setInput('message', 'Tem certeza?');
    fixture.componentRef.setInput('confirmLabel', 'Excluir');
    confirmed = jasmine.createSpy('confirmed');
    cancelled = jasmine.createSpy('cancelled');
    fixture.componentInstance.confirmed.subscribe(confirmed);
    fixture.componentInstance.cancelled.subscribe(cancelled);
    fixture.detectChanges();
  });

  afterEach(() => {
    if (dialog().open) {
      dialog().close();
    }
  });

  it('stays closed until the parent opens it, then shows an accessible modal', () => {
    expect(dialog().open).toBeFalse();

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(dialog().open).toBeTrue();
    const labelledBy = dialog().getAttribute('aria-labelledby')!;
    const describedBy = dialog().getAttribute('aria-describedby')!;
    expect(dialog().querySelector(`#${labelledBy}`)?.textContent).toContain('Excluir item');
    expect(dialog().querySelector(`#${describedBy}`)?.textContent).toContain('Tem certeza?');
  });

  it('emits confirmed / cancelled from its buttons', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    button('.btn--danger').click();
    button('.btn--ghost').click();

    expect(confirmed).toHaveBeenCalledTimes(1);
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('Esc asks the parent to cancel instead of closing on its own', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const escape = new Event('cancel', { cancelable: true });
    dialog().dispatchEvent(escape);

    expect(escape.defaultPrevented).toBeTrue();
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(dialog().open).toBeTrue();
  });

  it('while busy disables both buttons and ignores Esc', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();

    expect(button('.btn--danger').disabled).toBeTrue();
    expect(button('.btn--ghost').disabled).toBeTrue();
    dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('supports custom labels and a non-destructive tone (defaults stay destructive)', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('confirmLabel', 'Continuar mesmo assim');
    fixture.componentRef.setInput('cancelLabel', 'Revisar cadastro');
    fixture.componentRef.setInput('tone', 'primary');
    fixture.detectChanges();

    expect(dialog().querySelector('.btn--danger')).toBeNull();
    expect(button('.btn--accent').textContent?.trim()).toBe('Continuar mesmo assim');
    expect(button('.btn--ghost').textContent?.trim()).toBe('Revisar cadastro');
  });

  it('closes when the parent resets open', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();

    expect(dialog().open).toBeFalse();
  });
});
