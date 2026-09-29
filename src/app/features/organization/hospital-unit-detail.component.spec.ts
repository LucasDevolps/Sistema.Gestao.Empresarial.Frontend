import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthStore } from '../../core/auth/auth-store';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { HospitalUnitResponse } from '../../core/models/organization.models';
import { HospitalUnitDetailComponent } from './hospital-unit-detail.component';
import { fullUnit } from './hospital-unit-form.model.spec';
import { OrganizationCatalogService } from './organization-catalog.service';

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

describe('HospitalUnitDetailComponent', () => {
  let fixture: ComponentFixture<HospitalUnitDetailComponent>;
  let service: jasmine.SpyObj<OrganizationCatalogService>;

  function setup(permissions: string[], unit: HospitalUnitResponse = fullUnit()): void {
    service = jasmine.createSpyObj<OrganizationCatalogService>('svc', [
      'getHospitalUnit',
      'changeHospitalUnitStatus',
    ]);
    service.getHospitalUnit.and.returnValue(of(unit));
    service.changeHospitalUnitStatus.and.callFake((_guid, body) =>
      of({ ...unit, active: body.active }),
    );
    TestBed.configureTestingModule({
      imports: [HospitalUnitDetailComponent],
      providers: [provideRouter([]), { provide: OrganizationCatalogService, useValue: service }],
    });
    TestBed.inject(AuthStore).setIdentity(identity(permissions));
    fixture = TestBed.createComponent(HospitalUnitDetailComponent);
    fixture.componentRef.setInput('unitGuid', unit.guid);
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function sectionTitles(): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('section h2')).map(
      (h) => h.textContent?.trim() ?? '',
    );
  }

  function action(label: string): HTMLElement | undefined {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('header a, header button'),
    ).find((e) => e.textContent?.trim() === label);
  }

  it('shows the complete registration grouped by section, with friendly labels and masks', () => {
    setup(['UNIDADE_HOSPITALAR_VISUALIZAR']);
    expect(sectionTitles()).toEqual([
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
      'Registro',
    ]);
    const content = text();
    expect(content).toContain('Hospital geral');
    expect(content).toContain('Privada');
    expect(content).toContain('11.222.333/0001-81');
    expect(content).toContain('01001-000');
    expect(content).toContain('31/12/2027');
    expect(content).toContain('Carla Diretora');
    expect(content).not.toContain('HospitalGeral');
    expect(content).not.toContain('null');
    expect(content).not.toContain('undefined');
  });

  it('skips empty fields and empty sections instead of printing placeholders', () => {
    setup(
      ['UNIDADE_HOSPITALAR_VISUALIZAR'],
      fullUnit({
        clinicalDirectorName: null,
        clinicalDirectorCrm: null,
        clinicalDirectorCrmState: null,
        clinicalDirectorEmail: null,
        clinicalDirectorPhone: null,
        secondaryPhone: null,
        hasOutpatientCare: null,
      }),
    );
    expect(sectionTitles()).not.toContain('Diretor clínico');
    expect(text()).not.toContain('Telefone secundário');
    expect(text()).not.toContain('Atendimento ambulatorial');
  });

  it('a read-only user sees neither "Editar" nor the status action', () => {
    setup(['UNIDADE_HOSPITALAR_VISUALIZAR']);
    expect(action('Editar')).toBeUndefined();
    expect(action('Inativar unidade')).toBeUndefined();
  });

  it('an editor sees "Editar" and "Inativar unidade"', () => {
    setup(['UNIDADE_HOSPITALAR_VISUALIZAR', 'UNIDADE_HOSPITALAR_EDITAR']);
    expect(action('Editar')).toBeDefined();
    expect(action('Inativar unidade')).toBeDefined();
  });

  it('asks for confirmation before inactivating, then PATCHes { active: false }', () => {
    setup(['UNIDADE_HOSPITALAR_VISUALIZAR', 'UNIDADE_HOSPITALAR_EDITAR']);
    action('Inativar unidade')!.click();
    fixture.detectChanges();

    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    expect(dialog.open).toBeTrue();
    expect(dialog.textContent).toContain('relacionamentos não serão excluídos');
    expect(service.changeHospitalUnitStatus).not.toHaveBeenCalled();

    (dialog.querySelector('.btn--danger') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(service.changeHospitalUnitStatus).toHaveBeenCalledOnceWith('unit-1', { active: false });
    expect(dialog.open).toBeFalse();
    expect(action('Reativar unidade')).toBeDefined();
  });

  it('does nothing when the inactivation is cancelled', () => {
    setup(['UNIDADE_HOSPITALAR_VISUALIZAR', 'UNIDADE_HOSPITALAR_EDITAR']);
    action('Inativar unidade')!.click();
    fixture.detectChanges();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    (dialog.querySelector('.btn--ghost') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(service.changeHospitalUnitStatus).not.toHaveBeenCalled();
    expect(dialog.open).toBeFalse();
  });

  it('reactivates an inactive unit directly', () => {
    setup(
      ['UNIDADE_HOSPITALAR_VISUALIZAR', 'UNIDADE_HOSPITALAR_EDITAR'],
      fullUnit({ active: false }),
    );
    action('Reativar unidade')!.click();
    fixture.detectChanges();
    expect(service.changeHospitalUnitStatus).toHaveBeenCalledOnceWith('unit-1', { active: true });
  });

  it('shows a safe message for a unit outside the organization (404)', () => {
    service = jasmine.createSpyObj<OrganizationCatalogService>('svc', ['getHospitalUnit']);
    service.getHospitalUnit.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );
    TestBed.configureTestingModule({
      imports: [HospitalUnitDetailComponent],
      providers: [provideRouter([]), { provide: OrganizationCatalogService, useValue: service }],
    });
    TestBed.inject(AuthStore).setIdentity(identity(['UNIDADE_HOSPITALAR_VISUALIZAR']));
    fixture = TestBed.createComponent(HospitalUnitDetailComponent);
    fixture.componentRef.setInput('unitGuid', 'other-org');
    fixture.detectChanges();
    expect(text()).toContain('não foi encontrada ou não pertence à sua organização');
  });
});
