import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a backend `DateOnly` string (`YYYY-MM-DD`) as `DD/MM/YYYY` using pure
 * string manipulation — never a `Date` — so there is no timezone shift
 * (spec section 58).
 */
@Pipe({ name: 'dateOnly', standalone: true })
export class DateOnlyPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) {
      return value;
    }
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
}
