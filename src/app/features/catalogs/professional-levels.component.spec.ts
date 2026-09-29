import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AuthStore } from '../../core/auth/auth-store';
import { PagedResponse, PageQuery } from '../../core/models/api.models';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { ProfessionalLevelResponse } from '../../core/models/catalog.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { ProfessionalCatalogService } from './professional-catalog.service';
import { ProfessionalLevelsComponent } from './professional-levels.component';

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

function level(guid: string, code: string, name: string, order: number): ProfessionalLevelResponse {
  return {
    guid,
    code,
    name,
    order,
    active: true,
    createdAt: '2026-09-27T12:00:00Z',
    updatedAt: '2026-09-27T12:00:00Z',
  };
}

function page(items: ProfessionalLevelResponse[]): Observable<PagedResponse<ProfessionalLevelResponse>> {
  return of({ items, page: 1, pageSize: 20, total: items.length });
}

const JUNIOR = level('lvl-jr', 'JR', 'Júnior', 1);
const SENIOR = level('lvl-sr', 'SR', 'Sênior', 3);
const ALL = [
  'NIVEL_PROFISSIONAL_VISUALIZAR',
  'NIVEL_PROFISSIONAL_CRIAR',
  'NIVEL_PROFISSIONAL_EDITAR',
];

describe('ProfessionalLevelsComponent', () => {
  let fixture: ComponentFixture<ProfessionalLevelsComponent>;
  let listLevels: jasmine.Spy<(query: PageQuery) => Observable<PagedResponse<ProfessionalLevelResponse>>>;
  let deleteLevel: jasmine.Spy<(guid: string) => Observable<void>>;
  let notifications: NotificationService;

  function setup(permissions: string[] = ALL): void {
    TestBed.inject(AuthStore).setIdentity(identity(permissions));
    fixture = TestBed.createComponent(ProfessionalLevelsComponent);
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rowsText(): string[] {
    return Array.from(el().querySelectorAll('tbody tr')).map((r) => (r.textContent ?? '').trim());
  }

  function deleteButton(name: string): HTMLButtonElement | null {
    return el().querySelector(`button[aria-label="Excluir nível ${name}"]`);
  }

  function dialog(): HTMLDialogElement {
    return el().querySelector('dialog') as HTMLDialogElement;
  }

  function confirmButton(): HTMLButtonElement {
    return dialog().querySelector('.btn--danger') as HTMLButtonElement;
  }

  beforeEach(() => {
    listLevels = jasmine.createSpy('listLevels').and.returnValue(page([JUNIOR, SENIOR]));
    deleteLevel = jasmine.createSpy('deleteLevel').and.returnValue(of(undefined));
    const catalog: Partial<ProfessionalCatalogService> = {
      listLevels: listLevels as never,
      deleteLevel: deleteLevel as never,
    };
    TestBed.configureTestingModule({
      imports: [ProfessionalLevelsComponent],
      providers: [provideRouter([]), { provide: ProfessionalCatalogService, useValue: catalog }],
    });
    notifications = TestBed.inject(NotificationService);
  });

  it('loads the first page ordered by the backend and renders order, code and name', () => {
    setup();

    expect(listLevels).toHaveBeenCalledWith({ search: null, page: 1, pageSize: 20 });
    const rows = rowsText();
    expect(rows.length).toBe(2);
    expect(rows[0]).toContain('1');
    expect(rows[0]).toContain('JR');
    expect(rows[0]).toContain('Júnior');
    expect(rows[1]).toContain('SR');
  });

  it('shows a loading row while the request is pending', () => {
    const pending = new Subject<PagedResponse<ProfessionalLevelResponse>>();
    listLevels.and.returnValue(pending);
    setup();

    expect(el().textContent).toContain('Carregando…');
    pending.next({ items: [JUNIOR], page: 1, pageSize: 20, total: 1 });
    fixture.detectChanges();
    expect(el().textContent).not.toContain('Carregando…');
  });

  it('renders the empty state when there are no levels', () => {
    listLevels.and.returnValue(page([]));
    setup();

    expect(el().textContent).toContain('Nenhum nível profissional cadastrado.');
  });

  it('shows the API error and notifies, except for 403 which is shown inline only', () => {
    const error = spyOn(notifications, 'error');
    listLevels.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    setup();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('erro interno');
    expect(error).toHaveBeenCalledTimes(1);

    error.calls.reset();
    listLevels.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    fixture = TestBed.createComponent(ProfessionalLevelsComponent);
    fixture.detectChanges();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('permissão');
    expect(error).not.toHaveBeenCalled();
  });

  it('searches by code or name after the debounce, restarting on page 1', fakeAsync(() => {
    setup();
    const input = el().querySelector('#search') as HTMLInputElement;
    input.value = ' pleno ';
    input.dispatchEvent(new Event('input'));
    tick(300);

    expect(listLevels).toHaveBeenCalledWith({ search: 'pleno', page: 1, pageSize: 20 });
  }));

  describe('permissions', () => {
    function linkTexts(): string[] {
      return Array.from(el().querySelectorAll('a')).map((a) => (a.textContent ?? '').trim());
    }

    it('read-only users see neither "Novo", "Editar" nor "Excluir"', () => {
      setup(['NIVEL_PROFISSIONAL_VISUALIZAR']);

      expect(linkTexts()).not.toContain('Novo nível profissional');
      expect(linkTexts()).not.toContain('Editar');
      expect(deleteButton('Júnior')).toBeNull();
    });

    it('CRIAR shows "Novo nível profissional"; EDITAR shows row actions', () => {
      setup(ALL);

      expect(linkTexts()).toContain('Novo nível profissional');
      expect(linkTexts()).toContain('Editar');
      expect(deleteButton('Júnior')).not.toBeNull();
    });
  });

  describe('logical deletion', () => {
    it('asks for confirmation and only calls the API after it', () => {
      setup();
      deleteButton('Sênior')!.click();
      fixture.detectChanges();

      expect(dialog().open).toBeTrue();
      expect(dialog().textContent).toContain('SR · Sênior');
      expect(deleteLevel).not.toHaveBeenCalled();

      confirmButton().click();
      fixture.detectChanges();

      expect(deleteLevel).toHaveBeenCalledOnceWith('lvl-sr');
    });

    it('cancelling closes the dialog without calling the API', () => {
      setup();
      deleteButton('Sênior')!.click();
      fixture.detectChanges();

      (dialog().querySelector('.btn--ghost') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(dialog().open).toBeFalse();
      expect(deleteLevel).not.toHaveBeenCalled();
    });

    it('on success notifies and reloads the list from the backend', () => {
      const success = spyOn(notifications, 'success');
      setup();
      listLevels.calls.reset();
      listLevels.and.returnValue(page([JUNIOR]));

      deleteButton('Sênior')!.click();
      fixture.detectChanges();
      confirmButton().click();
      fixture.detectChanges();

      expect(success).toHaveBeenCalledWith('Nível profissional excluído.');
      expect(listLevels).toHaveBeenCalledTimes(1);
      expect(rowsText().length).toBe(1);
      expect(dialog().open).toBeFalse();
    });

    it('when the level is in use (422) shows the business message and keeps the row', () => {
      const error = spyOn(notifications, 'error');
      deleteLevel.and.returnValue(throwError(() => new HttpErrorResponse({ status: 422 })));
      setup();
      listLevels.calls.reset();

      deleteButton('Sênior')!.click();
      fixture.detectChanges();
      confirmButton().click();
      fixture.detectChanges();

      expect(error).toHaveBeenCalledWith(
        'Este nível profissional está vinculado a funcionários e não pode ser excluído.',
      );
      expect(listLevels).not.toHaveBeenCalled();
      expect(rowsText().some((row) => row.includes('Sênior'))).toBeTrue();
    });

    it('surfaces 403 from the backend instead of hiding it', () => {
      const error = spyOn(notifications, 'error');
      deleteLevel.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
      setup();

      deleteButton('Sênior')!.click();
      fixture.detectChanges();
      confirmButton().click();
      fixture.detectChanges();

      expect(error).toHaveBeenCalledWith('Você não tem permissão para executar esta ação.');
    });

    it('blocks a double confirmation while the request is in flight', () => {
      const pending = new Subject<void>();
      deleteLevel.and.returnValue(pending);
      setup();

      deleteButton('Sênior')!.click();
      fixture.detectChanges();
      confirmButton().click();
      fixture.detectChanges();

      expect(confirmButton().disabled).toBeTrue();
      expect(confirmButton().textContent).toContain('Processando');
      confirmButton().click();
      expect(deleteLevel).toHaveBeenCalledTimes(1);

      pending.next();
      pending.complete();
    });
  });
});
