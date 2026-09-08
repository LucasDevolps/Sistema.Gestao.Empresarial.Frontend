import { DateOnlyPipe } from './date-only.pipe';

describe('DateOnlyPipe', () => {
  const pipe = new DateOnlyPipe();

  it('formats YYYY-MM-DD as DD/MM/YYYY without touching timezone', () => {
    expect(pipe.transform('2026-09-07')).toBe('07/09/2026');
  });

  it('accepts a full ISO string and keeps the calendar date', () => {
    expect(pipe.transform('2026-01-31T23:00:00-03:00')).toBe('31/01/2026');
  });

  it('renders a dash for empty values', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
    expect(pipe.transform('')).toBe('—');
  });

  it('returns the original string when it is not a date', () => {
    expect(pipe.transform('n/a')).toBe('n/a');
  });
});
