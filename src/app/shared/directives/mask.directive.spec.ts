import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MaskDirective, caretAfterDigits } from './mask.directive';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, MaskDirective],
  template: `<input id="cnpj" appMask="cnpj" [formControl]="control" />`,
})
class HostComponent {
  readonly control = new FormControl('', { nonNullable: true });
}

describe('MaskDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let input: HTMLInputElement;
  let control: FormControl<string>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('#cnpj');
    control = fixture.componentInstance.control;
  });

  function type(value: string, inputType = 'insertText'): void {
    input.value = value;
    input.dispatchEvent(new InputEvent('input', { inputType }));
  }

  it('formats typed digits and keeps the control in sync', () => {
    type('11222333000181');
    expect(input.value).toBe('11.222.333/0001-81');
    expect(control.value).toBe('11.222.333/0001-81');
  });

  it('formats a pasted, already formatted value without mangling it', () => {
    type('11.222.333/0001-81', 'insertFromPaste');
    expect(control.value).toBe('11.222.333/0001-81');
  });

  it('does not reformat while deleting, so separators can be erased', () => {
    type('11.222.333/0001-8', 'deleteContentBackward');
    expect(control.value).toBe('11.222.333/0001-8');
    type('11.222.333/0001-', 'deleteContentBackward');
    expect(control.value).toBe('11.222.333/0001-');
  });

  it('normalises on blur', () => {
    type('11.222.333/0001-', 'deleteContentBackward');
    input.dispatchEvent(new Event('blur'));
    expect(control.value).toBe('11.222.333/0001');
  });

  it('never blocks input: extra digits stay visible for the validator', () => {
    type('112223330001819');
    expect(control.value).toBe('112223330001819');
  });

  it('places the caret right after the n-th digit', () => {
    expect(caretAfterDigits('11.222.333/0001-81', 2)).toBe(2);
    expect(caretAfterDigits('11.222.333/0001-81', 3)).toBe(4);
    expect(caretAfterDigits('11.222.333/0001-81', 14)).toBe(18);
    expect(caretAfterDigits('11.222', 0)).toBe(0);
  });
});
