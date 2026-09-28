import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { ProfessionalLevelResponse } from '../../core/models/catalog.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { ProfessionalCatalogService } from './professional-catalog.service';
import { ProfessionalLevelFormComponent } from './professional-level-form.component';

const SENIOR: ProfessionalLevelResponse = {
  guid: 'lvl-sr',
  code: 'SR',
  name: 'Sênior',
  order: 3,
  active: true,
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
};

function duplicate(field: 'code' | 'name'): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 409,
    error: { title: 'Registro duplicado.', code: 'DUPLICATE_BUSINESS_KEY', field },
  });
}

describe('ProfessionalLevelFormComponent', () => {
  let fixture: ComponentFixture<ProfessionalLevelFormComponent>;
  let createLevel: jasmine.Spy;
  let updateLevel: jasmine.Spy;
  let getLevel: jasmine.Spy;
  let notifications: NotificationService;
  let navigate: jasmine.Spy;

  function setup(guid?: string): void {
    fixture = TestBed.createComponent(ProfessionalLevelFormComponent);
    if (guid) {
      fixture.componentRef.setInput('guid', guid);
    }
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function type(id: string, value: string): void {
    const input = el().querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submit(): void {
    (el().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function submitButton(): HTMLButtonElement {
    return el().querySelector('button[type="submit"]') as HTMLButtonElement;
  }

  beforeEach(() => {
    createLevel = jasmine.createSpy('createLevel').and.returnValue(of(SENIOR));
    updateLevel = jasmine.createSpy('updateLevel').and.returnValue(of(SENIOR));
    getLevel = jasmine.createSpy('getLevel').and.returnValue(of(SENIOR));
    const catalog: Partial<ProfessionalCatalogService> = {
      createLevel: createLevel as never,
      updateLevel: updateLevel as never,
      getLevel: getLevel as never,
    };
    TestBed.configureTestingModule({
      imports: [ProfessionalLevelFormComponent],
      providers: [provideRouter([]), { provide: ProfessionalCatalogService, useValue: catalog }],
    });
    notifications = TestBed.inject(NotificationService);
    navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
  });

  describe('create', () => {
    beforeEach(() => setup());

    it('never sends an invalid form and shows every field error', () => {
      type('code', '   ');
      type('order', '0');
      submit();

      expect(createLevel).not.toHaveBeenCalled();
      expect(el().querySelector('#code-error')?.textContent).toContain('Informe o código');
      expect(el().querySelector('#name-error')?.textContent).toContain('Informe o nome');
      expect(el().querySelector('#order-error')?.textContent).toContain('entre 1 e 9999');
      expect(el().querySelector('#code')?.getAttribute('aria-invalid')).toBe('true');
    });

    it('rejects a non-integer order', () => {
      type('code', 'JR');
      type('name', 'Júnior');
      type('order', '1.5');
      submit();

      expect(createLevel).not.toHaveBeenCalled();
    });

    it('sends the trimmed, upper-cased body and returns to the list', () => {
      const success = spyOn(notifications, 'success');
      type('code', ' esp ');
      type('name', '  Especialista  ');
      type('order', '4');
      submit();

      expect(createLevel).toHaveBeenCalledOnceWith({ code: 'ESP', name: 'Especialista', order: 4 });
      expect(success).toHaveBeenCalledWith('Nível profissional cadastrado.');
      expect(navigate).toHaveBeenCalledWith('/niveis-profissionais');
    });

    it('prevents double submit and shows the saving state', () => {
      const pending = new Subject<ProfessionalLevelResponse>();
      createLevel.and.returnValue(pending);
      type('code', 'JR');
      type('name', 'Júnior');
      type('order', '1');

      submit();
      submit();

      expect(createLevel).toHaveBeenCalledTimes(1);
      expect(submitButton().disabled).toBeTrue();
      expect(submitButton().textContent).toContain('Salvando');
      pending.complete();
    });

    for (const field of ['code', 'name'] as const) {
      it(`maps a 409 DUPLICATE_BUSINESS_KEY on "${field}" to the field and stays on the form`, () => {
        const error = spyOn(notifications, 'error');
        createLevel.and.returnValue(throwError(() => duplicate(field)));
        type('code', 'JR');
        type('name', 'Júnior');
        type('order', '1');
        submit();

        const expected =
          field === 'code'
            ? 'Já existe um nível profissional com este código.'
            : 'Já existe um nível profissional com este nome.';
        expect(el().querySelector(`#${field}-error`)?.textContent?.trim()).toBe(expected);
        expect(error).toHaveBeenCalledWith(expected);
        expect(navigate).not.toHaveBeenCalled();
        expect(submitButton().disabled).toBeFalse();
      });
    }

    it('shows the permission error on 403', () => {
      const error = spyOn(notifications, 'error');
      createLevel.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
      type('code', 'JR');
      type('name', 'Júnior');
      type('order', '1');
      submit();

      expect(error).toHaveBeenCalledWith('Você não tem permissão para executar esta ação.');
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('edit', () => {
    it('loads the level by guid and updates the same guid', () => {
      setup('lvl-sr');

      expect(getLevel).toHaveBeenCalledOnceWith('lvl-sr');
      expect((el().querySelector('#code') as HTMLInputElement).value).toBe('SR');
      expect((el().querySelector('#name') as HTMLInputElement).value).toBe('Sênior');
      expect((el().querySelector('#order') as HTMLInputElement).value).toBe('3');

      type('name', 'Sênior II');
      submit();

      expect(updateLevel).toHaveBeenCalledOnceWith('lvl-sr', { code: 'SR', name: 'Sênior II', order: 3 });
      expect(createLevel).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith('/niveis-profissionais');
    });

    it('shows a not-found state when the level does not exist or was deleted', () => {
      getLevel.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
      setup('missing');

      expect(el().querySelector('[role="alert"]')?.textContent).toContain(
        'não foi encontrado ou foi excluído',
      );
      expect(el().querySelector('form')).toBeNull();
    });

    it('shows the permission error when loading is forbidden', () => {
      getLevel.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
      setup('lvl-sr');

      expect(el().querySelector('[role="alert"]')?.textContent).toContain('permissão');
    });

    it('returns to the list when the level vanished before saving (404)', () => {
      const warning = spyOn(notifications, 'warning');
      updateLevel.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
      setup('lvl-sr');
      submit();

      expect(warning).toHaveBeenCalledWith('O nível profissional não existe mais.');
      expect(navigate).toHaveBeenCalledWith('/niveis-profissionais');
    });
  });
});
