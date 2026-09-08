import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaginatorComponent } from './paginator.component';

describe('PaginatorComponent', () => {
  let fixture: ComponentFixture<PaginatorComponent>;
  let component: PaginatorComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PaginatorComponent] });
    fixture = TestBed.createComponent(PaginatorComponent);
    component = fixture.componentInstance;
  });

  function configure(page: number, pageSize: number, total: number): void {
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('pageSize', pageSize);
    fixture.componentRef.setInput('total', total);
    fixture.detectChanges();
  }

  it('computes the visible range and last page', () => {
    configure(2, 20, 55);
    expect(component.rangeStart()).toBe(21);
    expect(component.rangeEnd()).toBe(40);
    expect(component.lastPage()).toBe(3);
  });

  it('reports an empty range when there are no rows', () => {
    configure(1, 20, 0);
    expect(component.rangeStart()).toBe(0);
    expect(component.rangeEnd()).toBe(0);
    expect(component.lastPage()).toBe(1);
  });

  it('emits clamped page changes and ignores no-ops', () => {
    configure(2, 20, 55);
    const emitted: number[] = [];
    component.pageChange.subscribe((p) => emitted.push(p));

    component.go(99);
    component.go(0);
    component.go(2);
    component.go(1);

    expect(emitted).toEqual([3, 1, 1]);
  });
});
