import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DUPLICATE_BUSINESS_KEY, toApiError } from '../../core/http/api-error';
import {
  UpsertWorkScheduleRequest,
  WORK_SCHEDULE_LIMITS,
} from '../../core/models/work-schedule.models';
import { NotificationService } from '../../core/notifications/notification.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { WorkScheduleService } from './work-schedule.service';

const LIST_PATH = '/jornadas-trabalho';

type ScheduleField =
  | 'name'
  | 'consecutiveWorkDays'
  | 'restDays'
  | 'maximumConsecutiveWorkDays'
  | 'description';

const FIELDS: readonly ScheduleField[] = [
  'name',
  'consecutiveWorkDays',
  'restDays',
  'maximumConsecutiveWorkDays',
  'description',
];

const BUSINESS_RULE_MESSAGE =
  'A configuração desta jornada não é permitida pelas regras do sistema. Revise os dias informados.';

const CYCLE_EXCEEDS_MAXIMUM_MESSAGE =
  'Os dias consecutivos de trabalho não podem ser maiores que o máximo de dias consecutivos permitido.';

const DUPLICATE_NAME_MESSAGE = 'Já existe uma jornada de trabalho cadastrada com este nome.';

function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim().length === 0 ? { required: true } : null;
}

function integer(control: AbstractControl<number | null>): ValidationErrors | null {
  return control.value === null || Number.isInteger(control.value) ? null : { integer: true };
}

const cycleWithinMaximum: ValidatorFn = (group) => {
  const work = group.get('consecutiveWorkDays');
  const maximum = group.get('maximumConsecutiveWorkDays');
  if (!work || !maximum || work.invalid || maximum.invalid) {
    return null;
  }
  return (work.value as number) > (maximum.value as number) ? { cycleExceedsMaximum: true } : null;
};

@Component({
  selector: 'app-work-schedule-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, StatusBadgeComponent],
  templateUrl: './work-schedule-form.component.html',
  styleUrl: './work-schedule-form.component.scss',
})
export class WorkScheduleFormComponent implements OnInit {
  private readonly service = inject(WorkScheduleService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  readonly guid = input<string>();

  protected readonly listPath = LIST_PATH;
  protected readonly limits = WORK_SCHEDULE_LIMITS;
  protected readonly isEdit = computed(() => !!this.guid());

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly active = signal<boolean | null>(null);

  protected readonly form = new FormGroup(
    {
      name: new FormControl('', {
        nonNullable: true,
        validators: [notBlank, Validators.maxLength(WORK_SCHEDULE_LIMITS.nameMaxLength)],
      }),
      consecutiveWorkDays: new FormControl<number | null>(null, {
        validators: [
          Validators.required,
          Validators.min(WORK_SCHEDULE_LIMITS.daysMin),
          Validators.max(WORK_SCHEDULE_LIMITS.maxConsecutiveWorkDays),
          integer,
        ],
      }),
      restDays: new FormControl<number | null>(null, {
        validators: [Validators.required, Validators.min(WORK_SCHEDULE_LIMITS.daysMin), integer],
      }),
      maximumConsecutiveWorkDays: new FormControl<number | null>(null, {
        validators: [
          Validators.required,
          Validators.min(WORK_SCHEDULE_LIMITS.daysMin),
          Validators.max(WORK_SCHEDULE_LIMITS.maxConsecutiveWorkDays),
          integer,
        ],
      }),
      description: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(WORK_SCHEDULE_LIMITS.descriptionMaxLength)],
      }),
    },
    { validators: [cycleWithinMaximum] },
  );

  ngOnInit(): void {
    const guid = this.guid();
    if (!guid) {
      this.loading.set(false);
      return;
    }
    this.service.get(guid).subscribe({
      next: (schedule) => {
        this.form.setValue({
          name: schedule.name,
          consecutiveWorkDays: schedule.consecutiveWorkDays,
          restDays: schedule.restDays,
          maximumConsecutiveWorkDays: schedule.maximumConsecutiveWorkDays,
          description: schedule.description ?? '',
        });
        this.active.set(schedule.active);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const parsed = toApiError(err);
        this.loadError.set(
          parsed.status === 404 ? 'A jornada de trabalho não foi encontrada.' : parsed.message,
        );
      },
    });
  }

  protected invalid(field: ScheduleField): boolean {
    const control = this.form.controls[field];
    if (control.invalid && (control.touched || control.dirty)) {
      return true;
    }
    return field === 'consecutiveWorkDays' && this.cycleExceedsMaximum();
  }

  protected errorFor(field: ScheduleField): string {
    const errors = this.form.controls[field].errors ?? {};
    if (errors['duplicate']) {
      return DUPLICATE_NAME_MESSAGE;
    }
    if (typeof errors['server'] === 'string') {
      return errors['server'];
    }
    const max = WORK_SCHEDULE_LIMITS.maxConsecutiveWorkDays;
    switch (field) {
      case 'name':
        return `Informe o nome (até ${WORK_SCHEDULE_LIMITS.nameMaxLength} caracteres).`;
      case 'consecutiveWorkDays':
        return this.form.controls.consecutiveWorkDays.valid
          ? CYCLE_EXCEEDS_MAXIMUM_MESSAGE
          : `Informe um número inteiro entre 1 e ${max}.`;
      case 'restDays':
        return 'Informe um número inteiro maior que zero.';
      case 'maximumConsecutiveWorkDays':
        return errors['max']
          ? `O máximo permitido é ${max} dias: nenhuma jornada pode autorizar 7 dias consecutivos de trabalho.`
          : `Informe um número inteiro entre 1 e ${max}.`;
      default:
        return `A descrição deve ter até ${WORK_SCHEDULE_LIMITS.descriptionMaxLength} caracteres.`;
    }
  }

  protected submit(): void {
    if (this.busy()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const body: UpsertWorkScheduleRequest = {
      name: raw.name.trim(),
      consecutiveWorkDays: raw.consecutiveWorkDays as number,
      restDays: raw.restDays as number,
      maximumConsecutiveWorkDays: raw.maximumConsecutiveWorkDays as number,
      description: raw.description.trim() || null,
    };
    const guid = this.guid();
    this.busy.set(true);

    const request$ = guid ? this.service.update(guid, body) : this.service.create(body);
    request$.subscribe({
      next: () => {
        this.busy.set(false);
        this.notifications.success(
          guid ? 'Jornada de trabalho atualizada.' : 'Jornada de trabalho cadastrada.',
        );
        void this.router.navigateByUrl(LIST_PATH);
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  private cycleExceedsMaximum(): boolean {
    if (!this.form.hasError('cycleExceedsMaximum')) {
      return false;
    }
    const { consecutiveWorkDays, maximumConsecutiveWorkDays } = this.form.controls;
    return (
      consecutiveWorkDays.touched ||
      consecutiveWorkDays.dirty ||
      maximumConsecutiveWorkDays.touched ||
      maximumConsecutiveWorkDays.dirty
    );
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    const parsed = toApiError(err);

    if (parsed.code === DUPLICATE_BUSINESS_KEY) {
      const control = this.form.controls.name;
      control.setErrors({ ...(control.errors ?? {}), duplicate: true });
      control.markAsTouched();
      this.notifications.error(DUPLICATE_NAME_MESSAGE);
      return;
    }
    if (parsed.status === 400 && parsed.fieldErrors) {
      const unmapped = this.applyServerFieldErrors(parsed.fieldErrors);
      this.notifications.error(['Revise os campos destacados.', ...unmapped].join(' '));
      return;
    }
    if (parsed.status === 422) {
      this.notifications.error(BUSINESS_RULE_MESSAGE);
      return;
    }
    if (parsed.status === 404) {
      this.notifications.warning('A jornada de trabalho não existe mais.');
      void this.router.navigateByUrl(LIST_PATH);
      return;
    }
    this.notifications.error(parsed.message);
  }

  private applyServerFieldErrors(fieldErrors: Record<string, string[]>): string[] {
    const unmapped: string[] = [];
    for (const [key, messages] of Object.entries(fieldErrors)) {
      const list = (Array.isArray(messages) ? messages : []).filter(
        (message): message is string => typeof message === 'string' && message.trim() !== '',
      );
      const field = FIELDS.find((name) => name.toLowerCase() === key.toLowerCase());
      if (!field) {
        unmapped.push(...list);
        continue;
      }
      const control = this.form.controls[field];
      control.setErrors({ ...(control.errors ?? {}), server: list[0] ?? 'Valor inválido.' });
      control.markAsTouched();
    }
    return unmapped;
  }
}
