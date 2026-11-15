import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { WorkScheduleResponse } from '../../core/models/work-schedule.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { aWorkSchedule } from './testing/work-schedule.builder';
import { WorkScheduleFormComponent } from './work-schedule-form.component';
import { WorkScheduleService } from './work-schedule.service';

const ADMIN_FIVE_BY_TWO = aWorkSchedule()
  .withGuid('ws-5x2')
  .named('Administrativo 5x2')
  .withCycle(5, 2)
  .withMaximum(5)
  .describedAs('Equipe administrativa')
  .inactive()
  .build();

describe('WorkScheduleFormComponent', () => {
  let fixture: ComponentFixture<WorkScheduleFormComponent>;
  let create: jasmine.Spy;
  let update: jasmine.Spy;
  let get: jasmine.Spy;
  let notifications: NotificationService;
  let navigate: jasmine.Spy;

  function setup(guid?: string): void {
    fixture = TestBed.createComponent(WorkScheduleFormComponent);
    if (guid) {
      fixture.componentRef.setInput('guid', guid);
    }
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function type(id: string, value: string): void {
    const input = el().querySelector(`#${id}`) as HTMLInputElement | HTMLTextAreaElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function fillSixByOne(): void {
    type('name', '6x1');
    type('consecutiveWorkDays', '6');
    type('restDays', '1');
    type('maximumConsecutiveWorkDays', '6');
  }

  function submit(): void {
    (el().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function errorText(field: string): string | undefined {
    return el().querySelector(`#${field}-error`)?.textContent?.trim();
  }

  function submitButton(): HTMLButtonElement {
    return el().querySelector('button[type="submit"]') as HTMLButtonElement;
  }

  beforeEach(() => {
    const saved = aWorkSchedule().build();
    create = jasmine.createSpy('create').and.returnValue(of(saved));
    update = jasmine.createSpy('update').and.returnValue(of(saved));
    get = jasmine.createSpy('get').and.returnValue(of(ADMIN_FIVE_BY_TWO));
    const service: Partial<WorkScheduleService> = {
      create: create as never,
      update: update as never,
      get: get as never,
    };
    TestBed.configureTestingModule({
      imports: [WorkScheduleFormComponent],
      providers: [provideRouter([]), { provide: WorkScheduleService, useValue: service }],
    });
    notifications = TestBed.inject(NotificationService);
    navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
  });

  describe('create — validation', () => {
    beforeEach(() => setup());

    it('never sends an empty form and shows every required field error', () => {
      submit();

      expect(create).not.toHaveBeenCalled();
      expect(errorText('name')).toContain('Informe o nome');
      expect(errorText('consecutiveWorkDays')).toContain('entre 1 e 6');
      expect(errorText('restDays')).toContain('maior que zero');
      expect(errorText('maximumConsecutiveWorkDays')).toContain('entre 1 e 6');
      expect(el().querySelector('#name')?.getAttribute('aria-invalid')).toBe('true');
    });

    it('rejects a blank-only name', () => {
      fillSixByOne();
      type('name', '   ');
      submit();

      expect(create).not.toHaveBeenCalled();
      expect(errorText('name')).toContain('Informe o nome');
    });

    it('rejects zero work days', () => {
      fillSixByOne();
      type('consecutiveWorkDays', '0');
      submit();

      expect(create).not.toHaveBeenCalled();
      expect(errorText('consecutiveWorkDays')).toContain('entre 1 e 6');
    });

    it('rejects zero rest days', () => {
      fillSixByOne();
      type('restDays', '0');
      submit();

      expect(create).not.toHaveBeenCalled();
      expect(errorText('restDays')).toContain('maior que zero');
    });

    it('rejects negative rest days', () => {
      fillSixByOne();
      type('restDays', '-1');
      submit();

      expect(create).not.toHaveBeenCalled();
      expect(errorText('restDays')).toContain('maior que zero');
    });

    it('rejects a maximum of 7 consecutive work days', () => {
      fillSixByOne();
      type('maximumConsecutiveWorkDays', '7');
      submit();

      expect(create).not.toHaveBeenCalled();
      expect(errorText('maximumConsecutiveWorkDays')).toContain(
        'nenhuma jornada pode autorizar 7 dias consecutivos',
      );
    });

    it('rejects 7 work days in the cycle', () => {
      fillSixByOne();
      type('consecutiveWorkDays', '7');
      submit();

      expect(create).not.toHaveBeenCalled();
      expect(errorText('consecutiveWorkDays')).toContain('entre 1 e 6');
    });

    it('rejects work days greater than the configured maximum', () => {
      fillSixByOne();
      type('maximumConsecutiveWorkDays', '5');
      submit();

      expect(create).not.toHaveBeenCalled();
      expect(errorText('consecutiveWorkDays')).toBe(
        'Os dias consecutivos de trabalho não podem ser maiores que o máximo de dias consecutivos permitido.',
      );
      expect(el().querySelector('#consecutiveWorkDays')?.getAttribute('aria-invalid')).toBe('true');
    });

    it('shows the cycle error as soon as the maximum is lowered below the work days', () => {
      fillSixByOne();
      type('maximumConsecutiveWorkDays', '4');

      expect(errorText('consecutiveWorkDays')).toContain('não podem ser maiores que o máximo');
    });

    it('rejects a non-integer number of days', () => {
      fillSixByOne();
      type('restDays', '1.5');
      submit();

      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('create — submission', () => {
    beforeEach(() => setup());

    it('sends the trimmed body with a null empty description and returns to the list', () => {
      const success = spyOn(notifications, 'success');
      fillSixByOne();
      type('name', '  6x1  ');
      type('description', '   ');
      submit();

      expect(create).toHaveBeenCalledOnceWith({
        name: '6x1',
        consecutiveWorkDays: 6,
        restDays: 1,
        maximumConsecutiveWorkDays: 6,
        description: null,
      });
      expect(success).toHaveBeenCalledWith('Jornada de trabalho cadastrada.');
      expect(navigate).toHaveBeenCalledWith('/jornadas-trabalho');
    });

    it('sends the trimmed description when informed', () => {
      fillSixByOne();
      type('description', '  Plantão assistencial  ');
      submit();

      expect(create.calls.mostRecent().args[0].description).toBe('Plantão assistencial');
    });

    it('prevents double submit and shows the saving state', () => {
      const pending = new Subject<WorkScheduleResponse>();
      create.and.returnValue(pending);
      fillSixByOne();

      submit();
      submit();

      expect(create).toHaveBeenCalledTimes(1);
      expect(submitButton().disabled).toBeTrue();
      expect(submitButton().textContent).toContain('Salvando');
      pending.complete();
    });

    it('maps a 409 DUPLICATE_BUSINESS_KEY to the name field and stays on the form', () => {
      const error = spyOn(notifications, 'error');
      create.and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { title: 'Registro duplicado.', code: 'DUPLICATE_BUSINESS_KEY', field: 'name' },
            }),
        ),
      );
      fillSixByOne();
      submit();

      const expected = 'Já existe uma jornada de trabalho cadastrada com este nome.';
      expect(errorText('name')).toBe(expected);
      expect(error).toHaveBeenCalledWith(expected);
      expect(navigate).not.toHaveBeenCalled();
      expect(submitButton().disabled).toBeFalse();
    });

    it('puts 400 validation messages under their fields', () => {
      const error = spyOn(notifications, 'error');
      create.and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: {
                title: 'One or more validation errors occurred.',
                errors: { MaximumConsecutiveWorkDays: ['Valor fora do permitido.'] },
              },
            }),
        ),
      );
      fillSixByOne();
      submit();

      expect(errorText('maximumConsecutiveWorkDays')).toBe('Valor fora do permitido.');
      expect(error).toHaveBeenCalledWith('Revise os campos destacados.');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('shows a business-rule message on 422', () => {
      const error = spyOn(notifications, 'error');
      create.and.returnValue(throwError(() => new HttpErrorResponse({ status: 422 })));
      fillSixByOne();
      submit();

      expect(error).toHaveBeenCalledWith(
        'A configuração desta jornada não é permitida pelas regras do sistema. Revise os dias informados.',
      );
      expect(navigate).not.toHaveBeenCalled();
    });

    it('shows the permission error on 403', () => {
      const error = spyOn(notifications, 'error');
      create.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
      fillSixByOne();
      submit();

      expect(error).toHaveBeenCalledWith('Você não tem permissão para executar esta ação.');
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('edit', () => {
    it('loads the schedule by guid, shows its status and updates the same guid', () => {
      setup('ws-5x2');

      expect(get).toHaveBeenCalledOnceWith('ws-5x2');
      expect((el().querySelector('#name') as HTMLInputElement).value).toBe('Administrativo 5x2');
      expect((el().querySelector('#consecutiveWorkDays') as HTMLInputElement).value).toBe('5');
      expect((el().querySelector('#restDays') as HTMLInputElement).value).toBe('2');
      expect((el().querySelector('#maximumConsecutiveWorkDays') as HTMLInputElement).value).toBe('5');
      expect((el().querySelector('#description') as HTMLTextAreaElement).value).toBe(
        'Equipe administrativa',
      );
      expect(el().textContent).toContain('Inativa');

      type('restDays', '3');
      submit();

      expect(update).toHaveBeenCalledOnceWith('ws-5x2', {
        name: 'Administrativo 5x2',
        consecutiveWorkDays: 5,
        restDays: 3,
        maximumConsecutiveWorkDays: 5,
        description: 'Equipe administrativa',
      });
      expect(create).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith('/jornadas-trabalho');
    });

    it('shows a not-found state when the schedule does not exist', () => {
      get.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
      setup('missing');

      expect(el().querySelector('[role="alert"]')?.textContent).toContain('não foi encontrada');
      expect(el().querySelector('form')).toBeNull();
    });

    it('shows the permission error when loading is forbidden', () => {
      get.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
      setup('ws-5x2');

      expect(el().querySelector('[role="alert"]')?.textContent).toContain('permissão');
    });

    it('returns to the list when the schedule vanished before saving (404)', () => {
      const warning = spyOn(notifications, 'warning');
      update.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
      setup('ws-5x2');
      submit();

      expect(warning).toHaveBeenCalledWith('A jornada de trabalho não existe mais.');
      expect(navigate).toHaveBeenCalledWith('/jornadas-trabalho');
    });
  });
});
