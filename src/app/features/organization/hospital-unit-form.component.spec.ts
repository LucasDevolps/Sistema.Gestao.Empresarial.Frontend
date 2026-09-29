import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { NEVER, Observable, Subject, of, throwError } from 'rxjs';
import { AuthStore } from '../../core/auth/auth-store';
import { CurrentUserResponse } from '../../core/models/auth.models';
import {
  CnpjLookupResponse,
  HospitalUnitSummaryResponse,
} from '../../core/models/organization.models';
import { NotificationService } from '../../core/notifications/notification.service';
import {
  CEP_UNAVAILABLE_MESSAGE,
  CNPJ_UNAVAILABLE_MESSAGE,
  HospitalUnitFormComponent,
  INACTIVE_CNPJ_MESSAGE,
  LookupState,
} from './hospital-unit-form.component';
import { HospitalUnitForm } from './hospital-unit-form.model';
import { fullUnit } from './hospital-unit-form.model.spec';
import { OrganizationCatalogService } from './organization-catalog.service';

/** Narrow structural view of the protected template API. */
interface FormInternals {
  form: HospitalUnitForm;
  submit(): void;
  consultCnpj(): void;
  consultCep(): void;
  canQueryCnpj(): boolean;
  canQueryCep(): boolean;
  cnpjLookup(): LookupState;
  cepLookup(): LookupState;
  cnpjInactiveWarning(): boolean;
  duplicateCandidates(): HospitalUnitSummaryResponse[] | null;
  confirmDespiteDuplicates(): void;
  reviewDuplicates(): void;
  formError(): string | null;
  errorFor(key: string): string;
  loadError(): string | null;
}

function identity(permissions: string[]): CurrentUserResponse {
  return {
    userGuid: '1',
    email: 'u@h.test',
    active: true,
    permissionVersion: 1,
    employee: null,
    organization: { guid: 'org-1', name: 'Rede Saúde' },
    hiringUnit: null,
    permissions,
  };
}

function httpError(status: number, error: unknown = null): Observable<never> {
  return throwError(() => new HttpErrorResponse({ status, error }));
}

const VIEW_CREATE = ['UNIDADE_HOSPITALAR_VISUALIZAR', 'UNIDADE_HOSPITALAR_CRIAR'];
const VIEW_EDIT = ['UNIDADE_HOSPITALAR_VISUALIZAR', 'UNIDADE_HOSPITALAR_EDITAR'];

const CNPJ_RESULT: CnpjLookupResponse = {
  cnpj: '11222333000181',
  legalName: 'Hospital Consultado Ltda',
  name: 'Hospital Consultado',
  registrationStatus: 'ATIVA',
  openingDate: '1999-03-01',
  legalNature: 'Sociedade Empresária Limitada',
  primaryCnae: { code: '8610101', description: 'Atividades de atendimento hospitalar' },
  secondaryCnaes: [],
  phone: null,
  email: null,
  postalCode: '01001000',
  street: 'Praça da Sé',
  number: '100',
  complement: null,
  district: 'Sé',
  city: 'São Paulo',
  state: 'SP',
  inactiveRegistrationWarning: false,
};

const CANDIDATE: HospitalUnitSummaryResponse = {
  guid: 'other-1',
  name: 'Hospital Central',
  active: true,
  organization: { guid: 'org-1', name: 'Rede Saúde' },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  legalName: null,
  cnpj: null,
  cnes: null,
  city: 'São Paulo',
  state: 'SP',
};

describe('HospitalUnitFormComponent', () => {
  let fixture: ComponentFixture<HospitalUnitFormComponent>;
  let c: FormInternals;
  let service: jasmine.SpyObj<OrganizationCatalogService>;
  let notifications: NotificationService;
  let navigate: jasmine.Spy;

  function setup(
    permissions: string[],
    unitGuid?: string,
    configure?: (spy: jasmine.SpyObj<OrganizationCatalogService>) => void,
  ): void {
    service = jasmine.createSpyObj<OrganizationCatalogService>('OrganizationCatalogService', [
      'getHospitalUnit',
      'createHospitalUnit',
      'updateHospitalUnit',
      'lookupCnpj',
      'lookupCep',
      'findHospitalUnitDuplicates',
    ]);
    service.getHospitalUnit.and.returnValue(of(fullUnit()));
    service.createHospitalUnit.and.returnValue(of(fullUnit({ guid: 'new-unit' })));
    service.updateHospitalUnit.and.returnValue(of(fullUnit()));
    service.lookupCnpj.and.returnValue(of(CNPJ_RESULT));
    service.findHospitalUnitDuplicates.and.returnValue(of([]));
    configure?.(service);

    TestBed.configureTestingModule({
      imports: [HospitalUnitFormComponent],
      providers: [provideRouter([]), { provide: OrganizationCatalogService, useValue: service }],
    });
    TestBed.inject(AuthStore).setIdentity(identity(permissions));
    notifications = TestBed.inject(NotificationService);
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(HospitalUnitFormComponent);
    if (unitGuid) {
      fixture.componentRef.setInput('unitGuid', unitGuid);
    }
    c = fixture.componentInstance as unknown as FormInternals;
    fixture.detectChanges();
  }

  function fillRequired(): void {
    c.form.patchValue({
      name: 'Hospital Central',
      postalCode: '01001-000',
      street: 'Praça da Sé',
      number: '10',
      district: 'Sé',
      city: 'São Paulo',
      state: 'SP',
    });
  }

  function el<T extends HTMLElement>(selector: string): T | null {
    return (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
  }

  function buttonByText(text: string): HTMLButtonElement | undefined {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === text,
    );
  }

  // ---- layout ------------------------------------------------------

  describe('create screen', () => {
    beforeEach(() => setup(VIEW_CREATE));

    it('renders the 10 sections of the registration', () => {
      const titles = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('form section h2'),
      ).map((h) => h.textContent?.trim());
      expect(titles).toEqual([
        'Dados da unidade',
        'Dados empresariais / CNPJ',
        'Endereço',
        'Contatos',
        'Responsável administrativo',
        'Responsável técnico',
        'Diretor clínico',
        'Dados regulatórios',
        'Características operacionais',
        'Observações',
      ]);
    });

    it('labels every control and shows the current organization read-only', () => {
      const controls = (fixture.nativeElement as HTMLElement).querySelectorAll(
        'form input, form select, form textarea',
      );
      for (const control of Array.from(controls)) {
        expect(el(`label[for="${control.id}"]`)).withContext(control.id).not.toBeNull();
      }
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Rede Saúde');
      expect(el('select#hu-organizationGuid')).toBeNull();
    });

    // ---- validation --------------------------------------------------

    it('blocks an empty submit, flags the required fields and focuses the first one', () => {
      c.submit();
      fixture.detectChanges();

      expect(service.createHospitalUnit).not.toHaveBeenCalled();
      expect(service.findHospitalUnitDuplicates).not.toHaveBeenCalled();
      expect(c.formError()).toContain('Revise os campos');
      expect(el('#hu-name')?.getAttribute('aria-invalid')).toBe('true');
      expect(el('#hu-name-error')?.textContent).toContain('Campo obrigatório');
      expect(el('#hu-name')?.getAttribute('aria-describedby')).toContain('hu-name-error');
      expect(document.activeElement?.id).toBe('hu-name');
    });

    it('requires the CNPJ when "possui CNPJ próprio" is checked and the legal name with a CNPJ', () => {
      fillRequired();
      c.form.controls.hasOwnCnpj.setValue(true);
      c.submit();
      expect(c.errorFor('cnpj')).toContain('CNPJ próprio');

      c.form.controls.cnpj.setValue('11.222.333/0001-81');
      c.submit();
      expect(c.errorFor('legalName')).toContain('razão social');
      expect(service.createHospitalUnit).not.toHaveBeenCalled();
    });

    // ---- CNPJ lookup -------------------------------------------------

    it('never consults the CNPJ while the user types — only on the explicit action', () => {
      const input = el<HTMLInputElement>('#hu-cnpj')!;
      for (const partial of ['1', '11222', '11222333000181']) {
        input.value = partial;
        input.dispatchEvent(new InputEvent('input', { inputType: 'insertText' }));
      }
      fixture.detectChanges();
      expect(c.form.controls.cnpj.value).toBe('11.222.333/0001-81');
      expect(service.lookupCnpj).not.toHaveBeenCalled();
    });

    it('enables "Consultar CNPJ" only for a complete, valid CNPJ', () => {
      c.form.controls.cnpj.setValue('11.222.333/0001');
      fixture.detectChanges();
      expect(buttonByText('Consultar CNPJ')?.disabled).toBeTrue();

      c.form.controls.cnpj.setValue('11.222.333/0001-82');
      fixture.detectChanges();
      expect(buttonByText('Consultar CNPJ')?.disabled).toBeTrue();

      c.form.controls.cnpj.setValue('11.222.333/0001-81');
      fixture.detectChanges();
      expect(buttonByText('Consultar CNPJ')?.disabled).toBeFalse();
    });

    it('autofills the returned data through the backend lookup, without saving', () => {
      c.form.controls.cnpj.setValue('11.222.333/0001-81');
      fixture.detectChanges();
      buttonByText('Consultar CNPJ')!.click();
      fixture.detectChanges();

      expect(service.lookupCnpj).toHaveBeenCalledOnceWith('11222333000181');
      expect(c.form.controls.legalName.value).toBe('Hospital Consultado Ltda');
      expect(c.form.controls.name.value).toBe('Hospital Consultado');
      expect(c.form.controls.primaryCnae.value).toBe(
        '8610-1/01 - Atividades de atendimento hospitalar',
      );
      expect(c.form.controls.street.value).toBe('Praça da Sé');
      expect(c.cnpjLookup().status).toBe('success');
      expect(el('#hu-cnpj-lookup')?.textContent).toContain('Revise');
      expect(service.createHospitalUnit).not.toHaveBeenCalled();
      expect(c.cnpjInactiveWarning()).toBeFalse();

      c.form.controls.legalName.setValue('Razão ajustada');
      expect(c.form.controls.legalName.value).toBe('Razão ajustada');
    });

    it('warns about an inactive registration without blocking the save', () => {
      service.lookupCnpj.and.returnValue(
        of({ ...CNPJ_RESULT, registrationStatus: 'BAIXADA', inactiveRegistrationWarning: true }),
      );
      fillRequired();
      c.form.controls.cnpj.setValue('11.222.333/0001-81');
      c.consultCnpj();
      fixture.detectChanges();

      expect(c.cnpjInactiveWarning()).toBeTrue();
      expect(el('.hu-alert--warning')?.textContent).toContain(INACTIVE_CNPJ_MESSAGE);
      expect(el<HTMLButtonElement>('button[type="submit"]')?.disabled).toBeFalse();

      c.submit();
      expect(service.createHospitalUnit).toHaveBeenCalledTimes(1);
    });

    it('reports a CNPJ not found (404) and keeps the form editable', () => {
      service.lookupCnpj.and.returnValue(httpError(404, { title: 'CNPJ não encontrado' }));
      c.form.controls.cnpj.setValue('11.222.333/0001-81');
      c.consultCnpj();
      expect(c.cnpjLookup().status).toBe('notFound');
      expect(c.cnpjLookup().message).toContain('não encontrado');
      expect(c.form.enabled).toBeTrue();
    });

    it('on 503 shows the unavailable message and still allows a manual registration', () => {
      service.lookupCnpj.and.returnValue(httpError(503, { title: 'Consulta temporariamente indisponível.' }));
      fillRequired();
      c.form.patchValue({ cnpj: '11.222.333/0001-81', legalName: 'Digitada Manualmente Ltda' });
      c.consultCnpj();
      expect(c.cnpjLookup().message).toBe(CNPJ_UNAVAILABLE_MESSAGE);

      c.submit();
      expect(service.createHospitalUnit).toHaveBeenCalledTimes(1);
      expect(service.createHospitalUnit.calls.mostRecent().args[0].legalName).toBe(
        'Digitada Manualmente Ltda',
      );
    });

    it('treats a transport failure/timeout (status 0) as unavailable too', () => {
      service.lookupCnpj.and.returnValue(httpError(0));
      c.form.controls.cnpj.setValue('11.222.333/0001-81');
      c.consultCnpj();
      expect(c.cnpjLookup().message).toBe(CNPJ_UNAVAILABLE_MESSAGE);
    });

    // ---- CEP lookup --------------------------------------------------

    it('fills the address from the CEP lookup but never the number', () => {
      service.lookupCep.and.returnValue(
        of({
          postalCode: '01001000',
          street: 'Praça da Sé',
          complement: 'lado ímpar',
          district: 'Sé',
          city: 'São Paulo',
          state: 'SP',
          ibgeCode: '3550308',
          areaCode: '11',
          region: 'Sudeste',
        }),
      );
      c.form.patchValue({ postalCode: '01001-000', number: '742' });
      fixture.detectChanges();
      buttonByText('Buscar CEP')!.click();

      expect(service.lookupCep).toHaveBeenCalledOnceWith('01001000');
      expect(c.form.controls.number.value).toBe('742');
      expect(c.form.controls.city.value).toBe('São Paulo');
      expect(c.form.controls.ibgeCode.value).toBe('3550308');
      expect(c.cepLookup().status).toBe('success');

      c.form.controls.street.setValue('Rua corrigida');
      expect(c.form.controls.street.value).toBe('Rua corrigida');
    });

    it('does not consult an incomplete CEP', () => {
      c.form.controls.postalCode.setValue('01001-00');
      fixture.detectChanges();
      expect(buttonByText('Buscar CEP')?.disabled).toBeTrue();
      c.consultCep();
      expect(service.lookupCep).not.toHaveBeenCalled();
    });

    it('shows "CEP não encontrado." on 404 and lets the user fill it manually', () => {
      service.lookupCep.and.returnValue(httpError(404, { title: 'CEP não encontrado' }));
      c.form.controls.postalCode.setValue('99999-999');
      c.consultCep();
      expect(c.cepLookup().status).toBe('notFound');
      expect(c.cepLookup().message).toContain('CEP não encontrado.');

      fillRequired();
      c.form.controls.postalCode.setValue('99999-999');
      c.submit();
      expect(service.createHospitalUnit).toHaveBeenCalledTimes(1);
    });

    it('shows the unavailable message when the CEP service fails', () => {
      service.lookupCep.and.returnValue(httpError(503));
      c.form.controls.postalCode.setValue('01001-000');
      c.consultCep();
      expect(c.cepLookup().message).toBe(CEP_UNAVAILABLE_MESSAGE);
    });

    // ---- possible duplicates -----------------------------------------

    it('saves right away when no similar unit is found', () => {
      fillRequired();
      c.submit();
      expect(service.findHospitalUnitDuplicates).toHaveBeenCalledOnceWith({
        name: 'Hospital Central',
        legalName: null,
        postalCode: '01001000',
        number: '10',
        excludeGuid: null,
      });
      expect(service.createHospitalUnit).toHaveBeenCalledTimes(1);
    });

    it('asks for confirmation when similar units are found and does not save on "Revisar cadastro"', () => {
      service.findHospitalUnitDuplicates.and.returnValue(of([CANDIDATE]));
      fillRequired();
      c.submit();
      fixture.detectChanges();

      expect(c.duplicateCandidates()).toEqual([CANDIDATE]);
      expect(service.createHospitalUnit).not.toHaveBeenCalled();
      const dialog = el<HTMLDialogElement>('dialog')!;
      expect(dialog.open).toBeTrue();
      expect(dialog.textContent).toContain('Hospital Central');
      expect(dialog.textContent).toContain('São Paulo/SP');

      c.reviewDuplicates();
      fixture.detectChanges();
      expect(dialog.open).toBeFalse();
      expect(service.createHospitalUnit).not.toHaveBeenCalled();
    });

    it('saves when the user confirms "Continuar mesmo assim"', () => {
      service.findHospitalUnitDuplicates.and.returnValue(of([CANDIDATE]));
      fillRequired();
      c.submit();
      c.confirmDespiteDuplicates();
      expect(service.createHospitalUnit).toHaveBeenCalledTimes(1);
    });

    it('does not block saving if the similarity check itself fails', () => {
      service.findHospitalUnitDuplicates.and.returnValue(httpError(503));
      fillRequired();
      c.submit();
      expect(service.createHospitalUnit).toHaveBeenCalledTimes(1);
    });

    // ---- save and errors --------------------------------------------

    it('creates, notifies and navigates to the new unit', () => {
      const success = spyOn(notifications, 'success');
      fillRequired();
      c.submit();
      expect(success).toHaveBeenCalledWith('Unidade hospitalar cadastrada.');
      expect(navigate).toHaveBeenCalledWith(['/unidades-hospitalares', 'new-unit']);
    });

    it('prevents a double submit while saving', () => {
      service.createHospitalUnit.and.returnValue(NEVER);
      fillRequired();
      c.submit();
      c.submit();
      fixture.detectChanges();
      expect(service.createHospitalUnit).toHaveBeenCalledTimes(1);
      expect(el<HTMLButtonElement>('button[type="submit"]')?.disabled).toBeTrue();
    });

    for (const [field, message] of [
      ['cnpj', 'Já existe uma unidade hospitalar cadastrada com este CNPJ.'],
      ['cnes', 'Já existe uma unidade hospitalar cadastrada com este CNES.'],
      ['internalCode', 'Já existe uma unidade hospitalar com este código interno nesta organização.'],
    ] as const) {
      it(`maps a 409 DUPLICATE_BUSINESS_KEY on "${field}" to the field`, () => {
        service.createHospitalUnit.and.returnValue(
          httpError(409, {
            title: 'Registro duplicado.',
            detail: 'Violation of UNIQUE KEY constraint IX_UnidadesHospitalares_Cnpj',
            code: 'DUPLICATE_BUSINESS_KEY',
            field,
          }),
        );
        fillRequired();
        c.form.patchValue({
          cnpj: '11.222.333/0001-81',
          legalName: 'Hospital Central Ltda',
          cnes: '1234567',
          internalCode: 'HC',
        });
        c.submit();

        expect(c.form.controls[field].hasError('duplicate')).toBeTrue();
        expect(c.errorFor(field)).toBe(message);
        expect(c.formError()).toBe(message);
        expect(c.formError()).not.toContain('IX_');
      });
    }

    it('does not flag a field the user already changed while the save was in flight', () => {
      const response = new Subject<never>();
      service.createHospitalUnit.and.returnValue(response);
      fillRequired();
      c.form.controls.internalCode.setValue('E2E-01');
      c.submit();

      c.form.controls.internalCode.setValue(''); // user corrects it before the 409 arrives
      response.error(
        new HttpErrorResponse({
          status: 409,
          error: { code: 'DUPLICATE_BUSINESS_KEY', field: 'internalCode' },
        }),
      );

      expect(c.form.controls.internalCode.errors).toBeNull();
      expect(c.form.valid).toBeTrue();
      expect(c.formError()).toContain('código interno'); // still told what happened
    });

    it('maps 400 field errors next to their controls', () => {
      service.createHospitalUnit.and.returnValue(
        httpError(400, {
          title: 'One or more validation errors occurred.',
          errors: { PostalCode: ['CEP deve possuir 8 dígitos.'], Foo: ['Outro problema.'] },
        }),
      );
      fillRequired();
      c.submit();
      fixture.detectChanges();

      expect(c.errorFor('postalCode')).toBe('CEP deve possuir 8 dígitos.');
      expect(el('#hu-postalCode')?.getAttribute('aria-invalid')).toBe('true');
      expect(c.formError()).toContain('Outro problema.');
      expect(document.activeElement?.id).toBe('hu-postalCode');
    });

    it('shows a safe message for other failures (e.g. 422, 403)', () => {
      const error = spyOn(notifications, 'error');
      service.createHospitalUnit.and.returnValue(httpError(422, { title: 'Operação não permitida.' }));
      fillRequired();
      c.submit();
      expect(error).toHaveBeenCalledWith('A operação não é permitida pelas regras do sistema.');
    });
  });

  // ---- permissions -------------------------------------------------

  describe('with UNIDADE_HOSPITALAR_CRIAR only', () => {
    beforeEach(() => setup(['UNIDADE_HOSPITALAR_CRIAR']));

    it('hides the lookups, skips the similarity check and still saves', () => {
      fixture.detectChanges();
      expect(buttonByText('Consultar CNPJ')).toBeUndefined();
      expect(buttonByText('Buscar CEP')).toBeUndefined();

      c.form.controls.cnpj.setValue('11.222.333/0001-81');
      c.consultCnpj();
      expect(service.lookupCnpj).not.toHaveBeenCalled();

      fillRequired();
      c.form.controls.legalName.setValue('Hospital Central Ltda');
      c.submit();
      expect(service.findHospitalUnitDuplicates).not.toHaveBeenCalled();
      expect(service.createHospitalUnit).toHaveBeenCalledTimes(1);
      // Without the view permission the detail route is off-limits.
      expect(navigate).toHaveBeenCalledWith(['/inicio']);
    });
  });

  // ---- edit ----------------------------------------------------------

  describe('edit screen', () => {
    beforeEach(() => setup(VIEW_EDIT, 'unit-1'));

    it('loads every stored value into the form', () => {
      expect(service.getHospitalUnit).toHaveBeenCalledOnceWith('unit-1');
      expect(c.form.controls.name.value).toBe('Hospital Central');
      expect(c.form.controls.cnpj.value).toBe('11.222.333/0001-81');
      expect(c.form.controls.technicalResponsibleName.value).toBe('Bruno Técnico');
      expect(c.form.controls.totalBeds.value).toBe(120);
      expect(c.form.controls.hasOutpatientCare.value).toBeNull();
    });

    it('sends the complete registration with PUT and skips the check when nothing relevant changed', () => {
      c.form.controls.notes.setValue('Atualizada');
      c.submit();

      expect(service.findHospitalUnitDuplicates).not.toHaveBeenCalled();
      expect(service.updateHospitalUnit).toHaveBeenCalledTimes(1);
      const [guid, body] = service.updateHospitalUnit.calls.mostRecent().args;
      expect(guid).toBe('unit-1');
      expect(body.notes).toBe('Atualizada');
      expect(body.clinicalDirectorName).toBe('Carla Diretora');
      expect(body.sanitaryPermitExpiry).toBe('2027-12-31');
      expect(body.icuBeds).toBe(20);
      // Omitted optional fields are sent explicitly as null (PUT = replacement).
      expect('secondaryPhone' in body).toBeTrue();
      expect(body.secondaryPhone).toBeNull();
      expect(service.createHospitalUnit).not.toHaveBeenCalled();
    });

    it('re-checks similarity with excludeGuid when name/CEP/number change', () => {
      c.form.controls.name.setValue('Hospital Central II');
      c.submit();
      expect(service.findHospitalUnitDuplicates).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ name: 'Hospital Central II', excludeGuid: 'unit-1' }),
      );
      expect(service.updateHospitalUnit).toHaveBeenCalledTimes(1);
    });
  });

  it('shows a load error when the unit does not exist', () => {
    setup(VIEW_EDIT, 'missing', (spy) => spy.getHospitalUnit.and.returnValue(httpError(404)));
    expect(c.loadError()).toContain('não foi encontrada');
    expect(el('form')).toBeNull();
  });
});
