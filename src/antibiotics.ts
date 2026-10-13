// График введения антибиотиков. Чистые функции, без DOM.
//
// Введения идут от первого с шагом `intervalHours`. Курс на N часов включает
// введения, которые начаты раньше, чем через N часов от первого: при старте
// в 01:00 и шаге 6 ч курс 48 ч заканчивается введением в 19:00 следующих суток.

import { formatClock, formatDate, weekdayShort } from './calc';

export interface Antibiotic {
  id: string;
  name: string;
  dose: string;
  intervalHours: number;
  /** Длительности курсов, для которых показывать последнее введение. */
  courseHours: number[];
}

export const ANTIBIOTICS: readonly Antibiotic[] = [
  { id: 'cefazolin', name: 'Цефазолин', dose: '1 г', intervalHours: 8, courseHours: [48, 72] },
  {
    id: 'amoxiclav',
    name: 'Амоксициллин + клавулановая кислота',
    dose: '1,2 г',
    intervalHours: 8,
    courseHours: [48, 72],
  },
  { id: 'ampisulbactam', name: 'Ампициллин + сульбактам', dose: '1,5 г', intervalHours: 6, courseHours: [48, 72] },
];

export function findAntibiotic(id: string | null): Antibiotic | null {
  return ANTIBIOTICS.find((a) => a.id === id) ?? null;
}

export interface Dose {
  /** Номер введения, с 1. */
  n: number;
  at: number;
}

export interface CourseEnd {
  hours: number;
  last: Dose;
  count: number;
}

/** Все введения курса длительностью `courseHours`. */
export function doses(start: number, intervalHours: number, courseHours: number): Dose[] {
  const out: Dose[] = [];
  for (let k = 0; k * intervalHours < courseHours; k++) {
    out.push({ n: k + 1, at: start + k * intervalHours * 60 });
  }
  return out;
}

export function courseEnds(start: number, drug: Antibiotic): CourseEnd[] {
  return drug.courseHours.map((hours) => {
    const list = doses(start, drug.intervalHours, hours);
    return { hours, last: list[list.length - 1], count: list.length };
  });
}

/** Введения, сгруппированные по календарным дням: для таблицы графика. */
export function dosesByDay(list: Dose[]): Array<{ day: string; weekday: string; doses: Dose[] }> {
  const groups: Array<{ day: string; weekday: string; doses: Dose[] }> = [];
  for (const d of list) {
    const day = formatDate(d.at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.doses.push(d);
    else groups.push({ day, weekday: weekdayShort(d.at), doses: [d] });
  }
  return groups;
}

export function courseLabel(hours: number): string {
  if (hours % 24 !== 0) return `${hours} ч`;
  const days = hours / 24;
  const word = days === 1 ? 'сутки' : 'суток';
  return `${days} ${word} (${hours} ч)`;
}

export function doseTime(d: Dose): string {
  return formatClock(d.at);
}
