import { WorkScheduleResponse } from '../../../core/models/work-schedule.models';

export class WorkScheduleBuilder {
  private value: WorkScheduleResponse = {
    guid: 'ws-6x1',
    name: '6x1',
    consecutiveWorkDays: 6,
    restDays: 1,
    maximumConsecutiveWorkDays: 6,
    description: null,
    active: true,
    createdAt: '2026-11-14T12:00:00Z',
    updatedAt: '2026-11-14T12:00:00Z',
  };

  withGuid(guid: string): this {
    this.value = { ...this.value, guid };
    return this;
  }

  named(name: string): this {
    this.value = { ...this.value, name };
    return this;
  }

  withCycle(consecutiveWorkDays: number, restDays: number): this {
    this.value = { ...this.value, consecutiveWorkDays, restDays };
    return this;
  }

  withMaximum(maximumConsecutiveWorkDays: number): this {
    this.value = { ...this.value, maximumConsecutiveWorkDays };
    return this;
  }

  describedAs(description: string | null): this {
    this.value = { ...this.value, description };
    return this;
  }

  inactive(): this {
    this.value = { ...this.value, active: false };
    return this;
  }

  build(): WorkScheduleResponse {
    return { ...this.value };
  }
}

export function aWorkSchedule(): WorkScheduleBuilder {
  return new WorkScheduleBuilder();
}
