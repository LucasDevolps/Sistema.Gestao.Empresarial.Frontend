import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AuthStore } from '../../core/auth/auth-store';
import { PagedResponse, PageQuery } from '../../core/models/api.models';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { ChangeStatusRequest } from '../../core/models/catalog.models';
import { WorkScheduleResponse } from '../../core/models/work-schedule.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { aWorkSchedule } from './testing/work-schedule.builder';
import { WorkScheduleService } from './work-schedule.service';
import { WorkSchedulesListComponent } from './work-schedules-list.component';

function identity(permissions: string[]): CurrentUserResponse {
  return {
    userGuid: '1',
    email: 'u@h.test',
    active: true,
    permissionVersion: 1,
    employee: null,
    organization: null,
    hiringUnit: null,
    permissions,
  };
}

function page(items: WorkScheduleResponse[]): Observable<PagedResponse<WorkScheduleResponse>> {
  return of({ items, page: 1, pageSize: 20, total: items.length });
}

const SIX_BY_ONE = aWorkSchedule().withGuid('ws-6x1').named('6x1').withCycle(6, 1).withMaximum(6).build();
const FIVE_BY_TWO = aWorkSchedule()
  .withGuid('ws-5x2')
  .named('5x2')
  .withCycle(5, 2)
  .withMaximum(5)
  .describedAs('Equipe administrativa')
  .inactive()
  .build();
const ALL = ['JORNADA_TRABALHO_VISUALIZAR', 'JORNADA_TRABALHO_CRIAR', 'JORNADA_TRABALHO_EDITAR'];

describe('WorkSchedulesListComponent', () => {
  let fixture: ComponentFixture<WorkSchedulesListComponent>;
  let list: jasmine.Spy<(query: PageQuery) => Observable<PagedResponse<WorkScheduleResponse>>>;
  let changeStatus: jasmine.Spy<
    (guid: string, request: ChangeStatusRequest) => Observable<WorkScheduleResponse>
  >;
  let notifications: NotificationService;

  function setup(permissions: string[] = ALL): void {
    TestBed.inject(AuthStore).setIdentity(identity(permissions));
    fixture = TestBed.createComponent(WorkSchedulesListComponent);
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rows(): HTMLTableRowElement[] {
    return Array.from(el().querySelectorAll('tbody tr'));
  }

  function statusButton(action: 'Inativar' | 'Reativar', name: string): HTMLButtonElement | null {
    return el().querySelector(`button[aria-label="${action} jornada ${name}"]`);
  }

  function dialog(): HTMLDialogElement {
    return el().querySelector('dialog') as HTMLDialogElement;
  }

  function confirmButton(): HTMLButtonElement {
    return dialog().querySelector('.btn--danger') as HTMLButtonElement;
  }

  beforeEach(() => {
    list = jasmine.createSpy('list').and.returnValue(page([FIVE_BY_TWO, SIX_BY_ONE]));
    changeStatus = jasmine.createSpy('changeStatus');
    const service: Partial<WorkScheduleService> = {
      list: list as never,
      changeStatus: changeStatus as never,
    };
    TestBed.configureTestingModule({
      imports: [WorkSchedulesListComponent],
      providers: [provideRouter([]), { provide: WorkScheduleService, useValue: service }],
    });
    notifications = TestBed.inject(NotificationService);
  });

  it('loads the first page without filters and renders every listed column', () => {
    setup();

    expect(list).toHaveBeenCalledWith({ search: null, active: null, page: 1, pageSize: 20 });
    const cells = Array.from(rows()[0].querySelectorAll('td')).map((td) => td.textContent?.trim());
    expect(cells[0]).toContain('5x2');
    expect(cells[0]).toContain('Equipe administrativa');
    expect(cells[1]).toBe('5');
    expect(cells[2]).toBe('2');
    expect(cells[3]).toBe('5');
    expect(cells[4]).toBe('Inativa');
    expect(rows()[1].textContent).toContain('Ativa');
  });

  it('shows a loading row while the request is pending', () => {
    const pending = new Subject<PagedResponse<WorkScheduleResponse>>();
    list.and.returnValue(pending);
    setup();

    expect(el().textContent).toContain('Carregando…');
    pending.next({ items: [SIX_BY_ONE], page: 1, pageSize: 20, total: 1 });
    fixture.detectChanges();
    expect(el().textContent).not.toContain('Carregando…');
  });

  it('renders the empty state when nothing is registered', () => {
    list.and.returnValue(page([]));
    setup();

    expect(el().textContent).toContain('Nenhuma jornada de trabalho cadastrada.');
  });

  it('shows the API error inline and notifies, except for 403', () => {
    const error = spyOn(notifications, 'error');
    list.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    setup();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('erro interno');
    expect(error).toHaveBeenCalledTimes(1);

    error.calls.reset();
    list.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    fixture = TestBed.createComponent(WorkSchedulesListComponent);
    fixture.detectChanges();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('permissão');
    expect(error).not.toHaveBeenCalled();
  });

  it('filters by name after the debounce, restarting on page 1', fakeAsync(() => {
    setup();
    const input = el().querySelector('#f-search') as HTMLInputElement;
    input.value = ' 6x1 ';
    input.dispatchEvent(new Event('input'));
    tick(300);

    expect(list).toHaveBeenCalledWith({ search: '6x1', active: null, page: 1, pageSize: 20 });
  }));

  it('filters by status and shows the filtered empty state', fakeAsync(() => {
    setup();
    list.and.returnValue(page([]));
    const select = el().querySelector('#f-active') as HTMLSelectElement;
    select.value = 'false';
    select.dispatchEvent(new Event('change'));
    tick(300);
    fixture.detectChanges();

    expect(list).toHaveBeenCalledWith({ search: null, active: false, page: 1, pageSize: 20 });
    expect(el().textContent).toContain('Nenhuma jornada encontrada para os filtros informados.');
  }));

  describe('permissions', () => {
    function linkTexts(): string[] {
      return Array.from(el().querySelectorAll('a')).map((a) => (a.textContent ?? '').trim());
    }

    it('read-only users see neither "Nova jornada", "Editar" nor status actions', () => {
      setup(['JORNADA_TRABALHO_VISUALIZAR']);

      expect(linkTexts()).not.toContain('Nova jornada');
      expect(linkTexts()).not.toContain('Editar');
      expect(statusButton('Inativar', '6x1')).toBeNull();
      expect(statusButton('Reativar', '5x2')).toBeNull();
    });

    it('CRIAR shows "Nova jornada"; VISUALIZAR + EDITAR show the row actions', () => {
      setup(ALL);

      expect(linkTexts()).toContain('Nova jornada');
      expect(linkTexts()).toContain('Editar');
      expect(statusButton('Inativar', '6x1')).not.toBeNull();
      expect(statusButton('Reativar', '5x2')).not.toBeNull();
    });
  });

  describe('inactivation and reactivation', () => {
    it('asks for confirmation before inactivating and only calls the API after it', () => {
      changeStatus.and.returnValue(of(aWorkSchedule().withGuid('ws-6x1').inactive().build()));
      setup();

      statusButton('Inativar', '6x1')!.click();
      fixture.detectChanges();
      expect(dialog().open).toBeTrue();
      expect(dialog().textContent).toContain('"6x1"');
      expect(changeStatus).not.toHaveBeenCalled();

      confirmButton().click();
      fixture.detectChanges();

      expect(changeStatus).toHaveBeenCalledOnceWith('ws-6x1', { active: false });
    });

    it('cancelling closes the dialog without calling the API', () => {
      setup();
      statusButton('Inativar', '6x1')!.click();
      fixture.detectChanges();

      (dialog().querySelector('.btn--ghost') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(dialog().open).toBeFalse();
      expect(changeStatus).not.toHaveBeenCalled();
    });

    it('updates the row in place after inactivating', () => {
      const success = spyOn(notifications, 'success');
      changeStatus.and.returnValue(of(aWorkSchedule().withGuid('ws-6x1').inactive().build()));
      setup();
      list.calls.reset();

      statusButton('Inativar', '6x1')!.click();
      fixture.detectChanges();
      confirmButton().click();
      fixture.detectChanges();

      expect(success).toHaveBeenCalledWith('Jornada de trabalho inativada.');
      expect(statusButton('Reativar', '6x1')).not.toBeNull();
      expect(list).not.toHaveBeenCalled();
      expect(dialog().open).toBeFalse();
    });

    it('reactivates directly, without confirmation', () => {
      const success = spyOn(notifications, 'success');
      const reactivated = { ...FIVE_BY_TWO, active: true };
      changeStatus.and.returnValue(of(reactivated));
      setup();

      statusButton('Reativar', '5x2')!.click();
      fixture.detectChanges();

      expect(changeStatus).toHaveBeenCalledOnceWith('ws-5x2', { active: true });
      expect(success).toHaveBeenCalledWith('Jornada de trabalho reativada.');
      expect(statusButton('Inativar', '5x2')).not.toBeNull();
    });

    it('reloads from the backend when a status filter is active', fakeAsync(() => {
      changeStatus.and.returnValue(of(aWorkSchedule().withGuid('ws-6x1').inactive().build()));
      list.and.returnValue(page([SIX_BY_ONE]));
      setup();
      const select = el().querySelector('#f-active') as HTMLSelectElement;
      select.value = 'true';
      select.dispatchEvent(new Event('change'));
      tick(300);
      fixture.detectChanges();
      list.calls.reset();
      list.and.returnValue(page([]));

      statusButton('Inativar', '6x1')!.click();
      fixture.detectChanges();
      confirmButton().click();
      fixture.detectChanges();

      expect(list).toHaveBeenCalledOnceWith({ search: null, active: true, page: 1, pageSize: 20 });
      expect(rows().some((row) => row.textContent?.includes('6x1'))).toBeFalse();
    }));

    it('reloads with a warning when the schedule no longer exists (404)', () => {
      const warning = spyOn(notifications, 'warning');
      changeStatus.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
      setup();
      list.calls.reset();

      statusButton('Reativar', '5x2')!.click();
      fixture.detectChanges();

      expect(warning).toHaveBeenCalledWith(
        'Esta jornada de trabalho não existe mais. A lista foi atualizada.',
      );
      expect(list).toHaveBeenCalledTimes(1);
    });

    it('surfaces 403 from the backend instead of hiding it', () => {
      const error = spyOn(notifications, 'error');
      changeStatus.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
      setup();

      statusButton('Reativar', '5x2')!.click();
      fixture.detectChanges();

      expect(error).toHaveBeenCalledWith('Você não tem permissão para executar esta ação.');
    });

    it('blocks a double confirmation while the request is in flight', () => {
      const pending = new Subject<WorkScheduleResponse>();
      changeStatus.and.returnValue(pending);
      setup();

      statusButton('Inativar', '6x1')!.click();
      fixture.detectChanges();
      confirmButton().click();
      fixture.detectChanges();

      expect(confirmButton().disabled).toBeTrue();
      confirmButton().click();
      expect(changeStatus).toHaveBeenCalledTimes(1);

      pending.complete();
    });
  });
});
