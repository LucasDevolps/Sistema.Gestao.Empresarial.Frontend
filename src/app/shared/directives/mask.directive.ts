import { Directive, ElementRef, inject, input } from '@angular/core';
import { NgControl } from '@angular/forms';
import { MASKS, MaskKind, onlyDigits } from '../format/brazilian-formats';

/**
 * Lightweight visual mask for `<input>` bound to a form control
 * (`<input formControlName="cnpj" appMask="cnpj">`) — no external library.
 *
 * - Typing and pasting (formatted or not) are reformatted immediately, keeping
 *   the caret after the same number of digits it was after.
 * - Deletions are never reformatted while typing, so Backspace/Delete can erase
 *   separators freely; the value is normalised again on blur.
 * - Nothing is blocked: the control keeps whatever the user entered and the
 *   validators (and ultimately the backend) decide whether it is valid.
 */
@Directive({
  selector: 'input[appMask]',
  standalone: true,
  host: {
    '(input)': 'onInput($event)',
    '(blur)': 'onBlur()',
  },
})
export class MaskDirective {
  readonly appMask = input.required<MaskKind>();

  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private readonly ngControl = inject(NgControl, { self: true, optional: true });

  protected onInput(event: Event): void {
    const inputType = (event as Partial<InputEvent>).inputType ?? '';
    if (inputType.startsWith('delete')) {
      return;
    }
    this.apply(true);
  }

  protected onBlur(): void {
    this.apply(false);
  }

  private apply(keepCaret: boolean): void {
    const raw = this.element.value;
    const formatted = MASKS[this.appMask()](raw);
    if (formatted === raw) {
      return;
    }
    const caret = this.element.selectionStart ?? raw.length;
    const digitsBeforeCaret = onlyDigits(raw.slice(0, caret)).length;

    const control = this.ngControl?.control;
    if (control) {
      control.setValue(formatted);
    } else {
      this.element.value = formatted;
    }

    if (keepCaret && this.element.ownerDocument.activeElement === this.element) {
      const position = caretAfterDigits(formatted, digitsBeforeCaret);
      this.element.setSelectionRange(position, position);
    }
  }
}

/** Index right after the `count`-th digit of `value` (or its end). */
export function caretAfterDigits(value: string, count: number): number {
  if (count <= 0) {
    return 0;
  }
  let seen = 0;
  for (let i = 0; i < value.length; i++) {
    if (/\d/.test(value[i])) {
      seen += 1;
      if (seen === count) {
        return i + 1;
      }
    }
  }
  return value.length;
}
