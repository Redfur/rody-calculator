// Чистые функции расчёта и форматирования. Без DOM.
//
// Все моменты времени — «настенное» время без часового пояса, переведённое
// в целые минуты через Date.UTC. Так смена пояса или летнее время на
// устройстве никогда не сдвигают результат на час.

export const ENOX_OFFSET_AFTER_BIRTH_HOURS = 12;
export const ENOX_OFFSET_AFTER_OPERATION_HOURS = 0;
export const ENOX_COURSES_DAYS = [10, 42] as const;
export const DRY_PERIOD_MARK_HOURS = 18;

const MIN_PER_HOUR = 60;
const MIN_PER_DAY = 24 * MIN_PER_HOUR;

export type ChainKey = 'contractions' | 'pushing' | 'fetus' | 'placenta';
export type EventKey = ChainKey | 'waters' | 'opStart' | 'opEnd';

export const CHAIN: readonly ChainKey[] = ['contractions', 'pushing', 'fetus', 'placenta'];
export const OP_EVENTS: readonly EventKey[] = ['opStart', 'opEnd'];
export const ALL_EVENTS: readonly EventKey[] = [...CHAIN, 'waters', ...OP_EVENTS];

export interface FieldValue {
  date: string;
  time: string;
}
export type Fields = Record<EventKey, FieldValue>;

export function emptyFields(): Fields {
  const f = {} as Fields;
  for (const k of ALL_EVENTS) f[k] = { date: '', time: '' };
  return f;
}

// ---------- Разбор ввода ----------

export interface DateParts {
  y: number;
  m: number;
  d: number;
}
export interface TimeParts {
  h: number;
  mi: number;
}

export function parseDate(s: string): DateParts | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

export function parseTime(s: string): TimeParts | null {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return { h, mi };
}

/** Маска времени по мере набора: `0845` → `08:45`. */
export function maskTime(raw: string): string {
  const pasted = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(raw);
  if (pasted) return `${pasted[1].padStart(2, '0')}:${pasted[2]}`;
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

/** Маска даты по мере набора: `13102026` → `13.10.2026`. */
export function maskDate(raw: string): string {
  const pasted = /^\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4})\s*$/.exec(raw);
  if (pasted) return `${pasted[1].padStart(2, '0')}.${pasted[2].padStart(2, '0')}.${pasted[3]}`;
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return digits;
}

/** При уходе с поля дописывает век: `13.10.26` → `13.10.2026`. */
export function finalizeDate(s: string): string {
  const m = /^(\d{2})\.(\d{2})\.(\d{2})$/.exec(s);
  return m ? `${m[1]}.${m[2]}.20${m[3]}` : s;
}

// ---------- Минуты и форматирование ----------

const pad2 = (n: number) => String(n).padStart(2, '0');

export function toMinutes(date: string, time: string): number | null {
  const d = parseDate(date);
  const t = parseTime(time);
  if (!d || !t) return null;
  return Date.UTC(d.y, d.m - 1, d.d, t.h, t.mi) / 60000;
}

function partsOf(min: number) {
  const dt = new Date(min * 60000);
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
    h: dt.getUTCHours(),
    mi: dt.getUTCMinutes(),
    wd: dt.getUTCDay(),
  };
}

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export function formatDate(min: number): string {
  const p = partsOf(min);
  return `${pad2(p.d)}.${pad2(p.m)}.${p.y}`;
}
export function formatDayMonth(min: number): string {
  const p = partsOf(min);
  return `${pad2(p.d)}.${pad2(p.m)}`;
}
export function formatClock(min: number): string {
  const p = partsOf(min);
  return `${pad2(p.h)}:${pad2(p.mi)}`;
}
/** `14.10.2026 в 22:30` */
export function formatDateTime(min: number): string {
  return `${formatDate(min)} в ${formatClock(min)}`;
}
/** `13.10 · 22:40` — подписи на шкале. */
export function formatTick(min: number): string {
  return `${formatDayMonth(min)} · ${formatClock(min)}`;
}
export function weekdayShort(min: number): string {
  return WEEKDAYS[partsOf(min).wd];
}

/** `8 ч 10 мин`, `9 ч 05 мин`, `35 мин`, `26 ч 10 мин`. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  return `${h} ч ${pad2(minutes % 60)} мин`;
}

export function pluralDays(n: number): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return `${n} день`;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return `${n} дня`;
  return `${n} дней`;
}

export function shiftDate(date: string, days: number): string | null {
  const d = parseDate(date);
  if (!d) return null;
  return formatDate(Date.UTC(d.y, d.m - 1, d.d) / 60000 + days * MIN_PER_DAY);
}

export function todayString(now: Date = new Date()): string {
  return `${pad2(now.getDate())}.${pad2(now.getMonth() + 1)}.${now.getFullYear()}`;
}

// ---------- Автоподстановка даты ----------

function suggestionSources(key: EventKey): EventKey[] {
  switch (key) {
    case 'waters':
      return ['contractions', 'pushing', 'fetus', 'placenta'];
    case 'opStart':
      return ['fetus', 'placenta', 'pushing', 'contractions', 'waters'];
    case 'opEnd':
      return ['opStart', ...suggestionSources('opStart')];
    default: {
      const i = CHAIN.indexOf(key);
      return CHAIN.slice(0, i).reverse();
    }
  }
}

/** Дата, которую подставить событию: от ближайшего предыдущего события с датой, иначе сегодня. */
export function suggestDate(fields: Fields, key: EventKey, today: string): string {
  for (const src of suggestionSources(key)) {
    if (parseDate(fields[src].date)) return fields[src].date;
  }
  return today;
}

// ---------- Проверки порядка ----------

interface EventNames {
  nom: string; // Потуги
  verb: string; // указаны
  gen: string; // начала потуг
  of: string; // (у) потуг
}

const NAMES: Record<EventKey, EventNames> = {
  contractions: { nom: 'Начало схваток', verb: 'указано', gen: 'начала схваток', of: 'схваток' },
  pushing: { nom: 'Потуги', verb: 'указаны', gen: 'начала потуг', of: 'потуг' },
  fetus: { nom: 'Рождение плода', verb: 'указано', gen: 'рождения плода', of: 'рождения плода' },
  placenta: { nom: 'Рождение плаценты', verb: 'указано', gen: 'рождения плаценты', of: 'рождения плаценты' },
  waters: { nom: 'Излитие вод', verb: 'указано', gen: 'излития вод', of: 'излития вод' },
  opStart: { nom: 'Начало операции', verb: 'указано', gen: 'начала операции', of: 'начала операции' },
  opEnd: { nom: 'Конец операции', verb: 'указан', gen: 'конца операции', of: 'конца операции' },
};

export interface DateHint {
  /** Событие, у которого стоит сдвинуть дату. */
  event: EventKey;
  /** На сколько дней сдвинуть: +1 или −1. */
  days: 1 | -1;
  /** Текущая дата события, `13.10`. */
  current: string;
}

export interface OrderError {
  /** Событие, которое нарушает порядок (подсвечивается красным). */
  event: EventKey;
  /** С каким событием конфликтует. */
  other: EventKey;
  hint: DateHint | null;
  message: string;
}

type Minutes = Record<EventKey, number | null>;

/** Ограничения порядка `a ≤ b` (или `a < b` для операции) среди заполненных событий. */
function constraints(mins: Minutes): Array<[EventKey, EventKey, boolean]> {
  const out: Array<[EventKey, EventKey, boolean]> = [];
  const filled = CHAIN.filter((k) => mins[k] !== null);
  for (let i = 1; i < filled.length; i++) out.push([filled[i - 1], filled[i], false]);
  if (mins.waters !== null && mins.fetus !== null) out.push(['waters', 'fetus', false]);
  if (mins.opStart !== null && mins.opEnd !== null) out.push(['opStart', 'opEnd', true]);
  return out;
}

const holds = (mins: Minutes, [a, b, strict]: [EventKey, EventKey, boolean]) =>
  strict ? (mins[a] as number) < (mins[b] as number) : (mins[a] as number) <= (mins[b] as number);

/** Восстановится ли порядок вокруг события, если сдвинуть его дату на `days`. */
function shiftFixes(mins: Minutes, key: EventKey, days: number): boolean {
  const moved: Minutes = { ...mins, [key]: (mins[key] as number) + days * MIN_PER_DAY };
  return constraints(mins)
    .filter(([a, b]) => a === key || b === key)
    .every((c) => holds(moved, c));
}

function hintText(h: DateHint): string {
  const who = NAMES[h.event].of;
  return h.days > 0
    ? ` Похоже, у ${who} осталась дата ${h.current}, проверьте её.`
    : ` Похоже, у ${who} дата ${h.current} указана на день позже, проверьте её.`;
}

function findOrderErrors(mins: Minutes): OrderError[] {
  const errors: OrderError[] = [];
  const blamed = new Set<EventKey>();

  const blame = (event: EventKey, other: EventKey, later: boolean, days: 1 | -1 | 0, equal = false) => {
    if (blamed.has(event)) return;
    blamed.add(event);
    const hint: DateHint | null = days
      ? { event, days, current: formatDayMonth(mins[event] as number) }
      : null;
    const n = NAMES[event];
    let message: string;
    if (equal) message = `${n.nom} совпадает с началом операции.`;
    else message = `${n.nom} ${n.verb} ${later ? 'раньше' : 'позже'} ${NAMES[other].gen}.`;
    if (hint) message += hintText(hint);
    errors.push({ event, other, hint, message });
  };

  for (const c of constraints(mins)) {
    if (holds(mins, c)) continue;
    const [a, b] = c;
    if (blamed.has(a) || blamed.has(b)) continue;
    if (a === 'opStart') {
      const equal = mins.opStart === mins.opEnd;
      blame('opEnd', 'opStart', true, !equal && shiftFixes(mins, 'opEnd', 1) ? 1 : 0, equal);
    } else if (a === 'waters') {
      // Порядок цепочки уже проверен, поэтому под подозрением сами воды.
      blame('waters', 'fetus', false, 0);
    } else if (shiftFixes(mins, b, 1)) {
      // Самая частая ошибка: после полуночи забыли нажать «›».
      blame(b, a, true, 1);
    } else if (shiftFixes(mins, a, -1)) {
      blame(a, b, false, -1);
    } else {
      blame(b, a, true, 0);
    }
  }
  return errors;
}

// ---------- Итоговый расчёт ----------

export type Duration =
  | { kind: 'value'; minutes: number }
  | { kind: 'empty' }
  | { kind: 'error' };

export interface EnoxCourse {
  days: number;
  end: number;
}
export interface Enox {
  status: 'ok' | 'empty' | 'error';
  source: 'birth' | 'operation' | null;
  start: number | null;
  courses: EnoxCourse[];
}

export type ScalePieceKind = 'p1' | 'p2' | 'p3' | 'gap';
export interface ScalePiece {
  kind: ScalePieceKind;
  minutes: number;
}
export interface Scale {
  status: 'ok' | 'error' | 'empty';
  start: number | null;
  end: number | null;
  pieces: ScalePiece[];
  /** Безводный промежуток: доли от ширины шкалы (0..1). */
  water: { left: number; width: number; open: boolean } | null;
  description: string;
}

export interface Result {
  minutes: Minutes;
  errors: OrderError[];
  bad: Set<EventKey>;
  total: Duration;
  p1: Duration;
  p2: Duration;
  p3: Duration;
  dry: Duration;
  op: Duration | null;
  /** Момент «излитие вод + 18 ч». */
  dryMark: number | null;
  enox: Enox;
  scale: Scale;
}

const EMPTY: Duration = { kind: 'empty' };
const ERROR: Duration = { kind: 'error' };

export function compute(fields: Fields, opOpen: boolean): Result {
  const minutes = {} as Minutes;
  for (const k of ALL_EVENTS) {
    const skip = !opOpen && OP_EVENTS.includes(k);
    minutes[k] = skip ? null : toMinutes(fields[k].date, fields[k].time);
  }

  const errors = findOrderErrors(minutes);
  const bad = new Set(errors.map((e) => e.event));

  const span = (a: EventKey, b: EventKey): Duration => {
    const x = minutes[a];
    const y = minutes[b];
    if (x === null || y === null) return EMPTY;
    if (bad.has(a) || bad.has(b) || y < x) return ERROR;
    return { kind: 'value', minutes: y - x };
  };

  // Общая продолжительность зависит только от своих концов.
  const c = minutes.contractions;
  const pl = minutes.placenta;
  const total: Duration =
    c === null || pl === null ? EMPTY : pl < c ? ERROR : { kind: 'value', minutes: pl - c };

  const p1 = span('contractions', 'pushing');
  const p2 = span('pushing', 'fetus');
  const p3 = span('fetus', 'placenta');
  const dry = span('waters', 'fetus');
  const op = opOpen ? span('opStart', 'opEnd') : null;

  const dryMark = minutes.waters === null ? null : minutes.waters + DRY_PERIOD_MARK_HOURS * MIN_PER_HOUR;

  return {
    minutes,
    errors,
    bad,
    total,
    p1,
    p2,
    p3,
    dry,
    op,
    dryMark,
    enox: computeEnox(minutes, bad),
    scale: computeScale(minutes, bad, { p1, p2, p3, dry }),
  };
}

function computeEnox(minutes: Minutes, bad: Set<EventKey>): Enox {
  let source: Enox['source'] = null;
  let event: EventKey | null = null;
  let offsetHours = 0;
  if (minutes.opEnd !== null) {
    source = 'operation';
    event = 'opEnd';
    offsetHours = ENOX_OFFSET_AFTER_OPERATION_HOURS;
  } else if (minutes.fetus !== null) {
    source = 'birth';
    event = 'fetus';
    offsetHours = ENOX_OFFSET_AFTER_BIRTH_HOURS;
  }
  if (!event) return { status: 'empty', source: null, start: null, courses: [] };
  if (bad.has(event)) return { status: 'error', source, start: null, courses: [] };
  const start = (minutes[event] as number) + offsetHours * MIN_PER_HOUR;
  return {
    status: 'ok',
    source,
    start,
    courses: ENOX_COURSES_DAYS.map((days) => ({ days, end: start + days * MIN_PER_DAY })),
  };
}

const PERIOD_KINDS: ScalePieceKind[] = ['p1', 'p2', 'p3'];

function computeScale(
  minutes: Minutes,
  bad: Set<EventKey>,
  d: { p1: Duration; p2: Duration; p3: Duration; dry: Duration },
): Scale {
  const off = (status: Scale['status']): Scale => ({
    status,
    start: null,
    end: null,
    pieces: [],
    water: null,
    description: '',
  });
  if ([...CHAIN, 'waters' as const].some((k) => bad.has(k))) return off('error');
  const periods = [d.p1, d.p2, d.p3];
  if (!periods.some((p) => p.kind === 'value')) return off('empty');

  const filled = CHAIN.filter((k) => minutes[k] !== null);
  const points = [...filled, ...(minutes.waters !== null ? ['waters' as const] : [])].map(
    (k) => minutes[k] as number,
  );
  const start = Math.min(...points);
  const end = Math.max(...points);
  const range = end - start;

  const pieces: ScalePiece[] = [];
  const push = (kind: ScalePieceKind, m: number) => {
    if (m > 0) pieces.push({ kind, minutes: m });
  };
  let prev: ChainKey | null = null;
  let cursor = start;
  for (const k of filled) {
    const t = minutes[k] as number;
    const i = CHAIN.indexOf(k);
    const adjacent = prev !== null && i - CHAIN.indexOf(prev) === 1;
    push(adjacent ? PERIOD_KINDS[i - 1] : 'gap', t - cursor);
    cursor = t;
    prev = k;
  }
  push('gap', end - cursor);

  let water: Scale['water'] = null;
  const w = minutes.waters;
  if (w !== null) {
    if (range === 0) water = { left: 0, width: 1, open: minutes.fetus === null };
    else {
      const left = (w - start) / range;
      water =
        minutes.fetus !== null
          ? { left, width: (minutes.fetus - w) / range, open: false }
          : { left, width: 1 - left, open: true };
    }
  }

  const parts = [`Шкала родов с ${formatDayMonth(start)} ${formatClock(start)} до ${formatDayMonth(end)} ${formatClock(end)}.`];
  const labels = ['1 период', '2 период', '3 период'];
  const known = periods
    .map((p, i) => (p.kind === 'value' ? `${labels[i]} ${formatDuration(p.minutes)}` : null))
    .filter(Boolean);
  parts.push(`${known.join(', ')}.`);
  if (w !== null) {
    parts.push(
      d.dry.kind === 'value'
        ? `Безводный промежуток ${formatDuration(d.dry.minutes)}, с ${formatDayMonth(w)} ${formatClock(w)}.`
        : `Безводный промежуток с ${formatDayMonth(w)} ${formatClock(w)}.`,
    );
  }

  return { status: 'ok', start, end, pieces, water, description: parts.join(' ') };
}

// ---------- Вывод ----------

export function durationText(d: Duration): string {
  if (d.kind === 'value') return formatDuration(d.minutes);
  return d.kind === 'error' ? 'ошибка' : '—';
}

/** Ровно пять строк для буфера обмена. «ошибка» копируется как «—». */
export function buildCopyText(r: Result): string {
  const v = (d: Duration) => (d.kind === 'value' ? formatDuration(d.minutes) : '—');
  return [
    `Общая продолжительность родов: ${v(r.total)}`,
    `1 период: ${v(r.p1)}`,
    `2 период: ${v(r.p2)}`,
    `3 период: ${v(r.p3)}`,
    `Безводный промежуток: ${v(r.dry)}`,
  ].join('\n');
}

export function enoxCourseText(c: EnoxCourse): string {
  return `до ${formatDateTime(c.end)}, ${weekdayShort(c.end)}`;
}
