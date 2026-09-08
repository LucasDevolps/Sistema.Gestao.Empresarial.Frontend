import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CurrentUserResponse } from '../../core/models/auth.models';
import { AuthStore } from '../../core/auth/auth-store';
import { HasPermissionDirective } from './has-permission.directive';

@Component({
  standalone: true,
  imports: [HasPermissionDirective],
  template: `
    <span id="single" *appHasPermission="'FUNCIONARIO_CRIAR'">novo</span>
    <span id="any" *appHasPermission="['CARGO_CRIAR', 'CARGO_EDITAR']; mode: 'any'">editar</span>
  `,
})
class HostComponent {}

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

describe('HasPermissionDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let store: AuthStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    store = TestBed.inject(AuthStore);
    fixture = TestBed.createComponent(HostComponent);
  });

  it('hides protected content while permissions are unknown (deny by default)', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#single')).toBeNull();
    expect(fixture.nativeElement.querySelector('#any')).toBeNull();
  });

  it('shows content once the matching permission is present', () => {
    store.setIdentity(identity(['FUNCIONARIO_CRIAR']));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#single')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#any')).toBeNull();
  });

  it('supports "any" mode', () => {
    store.setIdentity(identity(['CARGO_EDITAR']));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#any')).not.toBeNull();
  });

  it('re-hides content when the permission snapshot is reset', () => {
    store.setIdentity(identity(['FUNCIONARIO_CRIAR']));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#single')).not.toBeNull();

    store.reset('logout');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#single')).toBeNull();
  });
});
