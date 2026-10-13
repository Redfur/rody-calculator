import { describe, expect, it } from 'vitest';
import { formatDateTime, toMinutes } from './calc';
import { courseEnds, courseLabel, doses, dosesByDay, findAntibiotic } from './antibiotics';

describe('антибиотики', () => {
  it('ампициллин + сульбактам каждые 6 ч: 48 ч заканчивается в 19:00 следующих суток', () => {
    const start = toMinutes('13.10.2026', '01:00') as number;
    const ends = courseEnds(start, findAntibiotic('ampisulbactam')!);
    expect(ends.map((e) => [e.hours, formatDateTime(e.last.at), e.count])).toEqual([
      [48, '14.10.2026 в 19:00', 8],
      [72, '15.10.2026 в 19:00', 12],
    ]);
  });

  it('цефазолин каждые 8 ч', () => {
    const start = toMinutes('13.10.2026', '10:00') as number;
    const ends = courseEnds(start, findAntibiotic('cefazolin')!);
    expect(ends.map((e) => [formatDateTime(e.last.at), e.count])).toEqual([
      ['15.10.2026 в 02:00', 6],
      ['16.10.2026 в 02:00', 9],
    ]);
  });

  it('группировка по дням', () => {
    const start = toMinutes('13.10.2026', '01:00') as number;
    const days = dosesByDay(doses(start, 6, 48));
    expect(days.map((d) => [d.day, d.weekday, d.doses.length])).toEqual([
      ['13.10.2026', 'вт', 4],
      ['14.10.2026', 'ср', 4],
    ]);
  });

  it('подписи курсов', () => {
    expect(courseLabel(48)).toBe('2 суток (48 ч)');
    expect(courseLabel(24)).toBe('1 сутки (24 ч)');
    expect(courseLabel(42)).toBe('42 ч');
  });
});
