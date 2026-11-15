export interface WorkScheduleResponse {
  guid: string;
  name: string;
  consecutiveWorkDays: number;
  restDays: number;
  maximumConsecutiveWorkDays: number;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertWorkScheduleRequest {
  name: string;
  consecutiveWorkDays: number;
  restDays: number;
  maximumConsecutiveWorkDays: number;
  description: string | null;
}

export const WORK_SCHEDULE_LIMITS = {
  nameMaxLength: 100,
  descriptionMaxLength: 500,
  daysMin: 1,
  maxConsecutiveWorkDays: 6,
} as const;
