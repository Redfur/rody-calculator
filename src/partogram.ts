// Партограмма: разбор осмотров и подсказки по клиническим рекомендациям.
// Чистые функции, без DOM.
//
// Источники (Минздрав РФ, РОАГ):
//   КР «Аномалии родовой деятельности», 2024 — п. 2.2, 2.3, 3.1, 3.2;
//   КР «Нормальные роды», 2024 — частота осмотров, тахисистолия, 0,5 см/ч.
// Все пороги собраны в константах ниже, чтобы их было легко сверить с текстом КР.

import { formatClock, formatDayMonth, formatDuration, toMinutes } from './calc';

const H = 60;

/** Латентная фаза: заподозрить первичную слабость, если длится дольше (п. 2.2). */
export const LATENT_MAX = { first: 20 * H, repeat: 14 * H };
/** Активная фаза: заподозрить первичную слабость, если длится дольше (п. 2.2). */
export const ACTIVE_MAX = { first: Math.round(8.6 * H), repeat: Math.round(7.5 * H) };
/** Партограмма: время на одном открытии, указывающее на АРД (п. 2.3). */
export const PLATEAU_LIMIT: Record<number, number> = { 5: 6 * H, 6: 5 * H, 7: 3 * H, 8: 2.5 * H, 9: 2 * H };
/** Нет динамики открытия при излившихся водах (п. 2.2, 3.2). */
export const RUPTURED_ARREST = 4 * H;
/** Родостимуляция без динамики (п. 3.2). */
export const OXYTOCIN_ARREST = 6 * H;
/** Второй период: заподозрить слабость, если длится дольше (п. 2.2). */
export const SECOND_MAX = {
  first: { plain: 3 * H, epidural: 4 * H },
  repeat: { plain: 2 * H, epidural: 3 * H },
};
/** Головка не продвигается во втором периоде (п. 2.2). */
export const HEAD_ARREST = 1 * H;
/** Схватки: 2 и менее за 10 минут — слабость (п. 2.2). */
export const WEAK_CONTRACTIONS = 2;
/** Более 5 схваток за 10 минут — чрезмерно сильная деятельность / тахисистолия. */
export const STRONG_CONTRACTIONS = 5;
/** Минимальная скорость раскрытия в активной фазе, см/ч («Нормальные роды»). */
export const MIN_RATE = 0.5;

export const SRC_ARD = 'КР «Аномалии родовой деятельности»';
export const SRC_NORMAL = 'КР «Нормальные роды»';

export type Parity = 'first' | 'repeat';
export type ContractionLength = 'lt20' | '20to40' | '40to60' | 'gt60';

export const LENGTH_LABELS: Record<ContractionLength, string> = {
  lt20: '< 20 с',
  '20to40': '20–40 с',
  '40to60': '40–60 с',
  gt60: '> 60 с',
};

export interface PartoRecord {
  id: string;
  date: string;
  time: string;
  /** Раскрытие, см (0–10). */
  dilation: number | null;
  /** Головка: сколько пятых пальпируется над лоном (5–0). */
  head: number | null;
  /** Схваток за 10 минут. */
  contractions: number | null;
  length: ContractionLength | null;
}

export interface PartoInput {
  records: PartoRecord[];
  parity: Parity | null;
  epidural: boolean;
  /** Начало регулярных схваток. */
  laborStart: number | null;
  /** Излитие вод или амниотомия. */
  waters: number | null;
  /** Начало родостимуляции окситоцином. */
  oxytocin: number | null;
  /** Рождение плода. */
  born: number | null;
}

export interface Point extends PartoRecord {
  at: number;
}

export type Phase = 'none' | 'latent' | 'active' | 'second' | 'born';

export interface Hint {
  level: 'alert' | 'warn' | 'info';
  text: string;
  source: string;
}

export interface Deadline {
  label: string;
  at: number;
}

export interface Analysis {
  points: Point[];
  phase: Phase;
  activeStart: number | null;
  fullAt: number | null;
  dilation: number | null;
  /** Средняя скорость раскрытия в активной фазе, см/ч. */
  rate: number | null;
  hints: Hint[];
  deadlines: Deadline[];
  /** Есть признаки слабости в первом периоде — показать тактику (амниотомия / окситоцин). */
  weakness: boolean;
}

export const PHASE_LABELS: Record<Phase, string> = {
  none: 'Нет осмотров',
  latent: 'Латентная фаза',
  active: 'Активная фаза',
  second: 'Второй период',
  born: 'Плод родился',
};

const dur = (m: number) => formatDuration(Math.max(0, Math.round(m)));
const at = (m: number) => `${formatDayMonth(m)} ${formatClock(m)}`;

/** Начало серии одинаковых значений, которой заканчивается список. */
function plateauStart<T extends Point>(list: T[], value: (p: T) => number | null): T {
  let i = list.length - 1;
  const v = value(list[i]);
  while (i > 0 && value(list[i - 1]) === v) i--;
  return list[i];
}

export function analyze(input: PartoInput): Analysis {
  const points: Point[] = input.records
    .map((r) => ({ ...r, at: toMinutes(r.date, r.time) }))
    .filter((p): p is Point => p.at !== null)
    .sort((a, b) => a.at - b.at);

  const dil = points.filter((p) => p.dilation !== null);
  const lastDil = dil[dil.length - 1] ?? null;
  const lastAt = points.length ? points[points.length - 1].at : null;
  const activeStart = dil.find((p) => (p.dilation as number) >= 5)?.at ?? null;
  const fullAt = dil.find((p) => p.dilation === 10)?.at ?? null;
  const { parity, laborStart, waters, oxytocin, born } = input;

  let phase: Phase = 'none';
  if (born !== null) phase = 'born';
  else if (fullAt !== null) phase = 'second';
  else if (activeStart !== null) phase = 'active';
  else if (dil.length || laborStart !== null) phase = 'latent';

  const hints: Hint[] = [];
  const deadlines: Deadline[] = [];
  let weakness = false;

  if (parity === null && phase !== 'none') {
    hints.push({
      level: 'info',
      text: 'Укажите, какие это роды по счёту: от этого зависят предельные сроки фаз и второго периода.',
      source: SRC_ARD,
    });
  }

  // --- Латентная фаза (п. 2.2)
  if (laborStart !== null && parity) {
    const limit = LATENT_MAX[parity];
    const end = activeStart ?? lastDil?.at ?? null;
    if (end !== null && end - laborStart > limit) {
      weakness = true;
      hints.push({
        level: 'alert',
        text:
          `Латентная фаза — ${dur(end - laborStart)}, больше ${dur(limit)} у ${parityGen(parity)}. ` +
          'Заподозрить первичную слабость родовой деятельности. ' +
          'При индуцированных родах латентная фаза значительно продолжительнее.',
        source: `${SRC_ARD}, п. 2.2`,
      });
    } else if (activeStart === null) {
      deadlines.push({ label: `Предел латентной фазы (${dur(limit)})`, at: laborStart + limit });
    }
  }

  // --- Активная фаза: общая длительность (п. 2.2)
  if (activeStart !== null && parity && lastDil) {
    const limit = ACTIVE_MAX[parity];
    const end = fullAt ?? lastDil.at;
    if (end - activeStart > limit) {
      weakness = true;
      hints.push({
        level: 'alert',
        text:
          `Активная фаза — ${dur(end - activeStart)}, больше ${dur(limit)} у ${parityGen(parity)}. ` +
          'Заподозрить первичную слабость родовой деятельности.',
        source: `${SRC_ARD}, п. 2.2`,
      });
    } else if (fullAt === null) {
      deadlines.push({ label: `Предел активной фазы (${dur(limit)})`, at: activeStart + limit });
    }
  }

  // --- Время на одном открытии (п. 2.3) и остановка при излившихся водах (п. 2.2, 3.2)
  if (phase === 'active' && lastDil && (lastDil.dilation as number) >= 5 && lastDil.dilation !== 10) {
    const d = lastDil.dilation as number;
    const since = plateauStart(dil, (p) => p.dilation).at;
    const limit = PLATEAU_LIMIT[d];
    const stalled = lastDil.at - since;
    if (stalled >= limit) {
      weakness = true;
      hints.push({
        level: 'alert',
        text:
          `Открытие ${d} см держится ${dur(stalled)} (с ${at(since)}), порог — ${dur(limit)}. ` +
          'Указывает на аномалию родовой деятельности по типу слабости или дискоординации.',
        source: `${SRC_ARD}, п. 2.3`,
      });
    } else {
      deadlines.push({ label: `Открытие ${d} см без прогресса (${dur(limit)})`, at: since + limit });
    }

    if (waters !== null) {
      const from = Math.max(since, waters);
      const span = lastDil.at - from;
      if (span >= RUPTURED_ARREST) {
        const counts = points.filter((p) => p.contractions !== null && p.at >= from && p.at <= lastDil.at);
        const adequate =
          counts.length > 0 &&
          counts.every((p) => (p.contractions as number) > WEAK_CONTRACTIONS && p.length !== 'lt20');
        if (adequate) {
          if (span > RUPTURED_ARREST) hints.push({
            level: 'alert',
            text:
              `Нет динамики открытия ${dur(span)} при излившихся водах и адекватных схватках. ` +
              'В активной фазе при отсутствии динамики более 4 ч адекватных схваток ' +
              'или 6 ч родостимуляции рекомендовано родоразрешение путём кесарева сечения.',
            source: `${SRC_ARD}, п. 3.2`,
          });
        } else {
          weakness = true;
          hints.push({
            level: 'alert',
            text:
              `Слабость активной фазы: нет динамики открытия ${dur(span)} при излившихся водах` +
              (counts.length ? '.' : ' (схватки за этот отрезок не отмечены).'),
            source: `${SRC_ARD}, п. 2.2`,
          });
        }
      } else {
        deadlines.push({ label: 'Нет динамики 4 ч при излившихся водах', at: from + RUPTURED_ARREST });
      }
    }
  }

  // --- Родостимуляция без динамики (п. 3.2)
  if (oxytocin !== null && phase === 'active' && lastDil) {
    const before = [...dil].reverse().find((p) => p.at <= oxytocin) ?? dil.find((p) => p.at >= oxytocin);
    const span = lastDil.at - oxytocin;
    if (before && (lastDil.dilation as number) <= (before.dilation as number) && span > OXYTOCIN_ARREST) {
      hints.push({
        level: 'alert',
        text:
          `Родостимуляция окситоцином ${dur(span)} без динамики открытия. ` +
          'Рекомендовано родоразрешение путём кесарева сечения.',
        source: `${SRC_ARD}, п. 3.2`,
      });
    } else if (span <= OXYTOCIN_ARREST) {
      deadlines.push({ label: '6 ч родостимуляции', at: oxytocin + OXYTOCIN_ARREST });
    }
  }

  // --- Схватки (п. 2.2; тахисистолия — «Нормальные роды»)
  const counts = points.filter((p) => p.contractions !== null);
  const last = counts[counts.length - 1];
  const prev = counts[counts.length - 2];
  if (last && (phase === 'active' || phase === 'second')) {
    const n = last.contractions as number;
    const len = last.length ? `, ${LENGTH_LABELS[last.length]}` : '';
    if (n > STRONG_CONTRACTIONS && prev && (prev.contractions as number) > STRONG_CONTRACTIONS) {
      hints.push({
        level: 'alert',
        text:
          'Тахисистолия: более 5 схваток за 10 минут в двух подсчётах подряд.' +
          (oxytocin !== null
            ? ' Дозу окситоцина уменьшить или прекратить введение до исчезновения тахисистолии; ' +
              'при отсутствии эффекта решить вопрос о токолизе.'
            : ''),
        source: oxytocin !== null ? `${SRC_ARD}, п. 3.1` : SRC_NORMAL,
      });
    } else if (n > STRONG_CONTRACTIONS || last.length === 'gt60') {
      hints.push({
        level: 'warn',
        text: `Схватки ${n} за 10 мин${len}: более 5 за 10 минут и/или дольше 60 с — признаки чрезмерно сильной родовой деятельности.`,
        source: `${SRC_ARD}, п. 2.2`,
      });
    } else if (phase === 'active' && (n <= WEAK_CONTRACTIONS || last.length === 'lt20')) {
      weakness = true;
      hints.push({
        level: 'warn',
        text: `Схватки ${n} за 10 мин${len}: 2 и менее за 10 минут или короче 20 с — признак слабости родовой деятельности.`,
        source: `${SRC_ARD}, п. 2.2`,
      });
    }
  }

  // --- Второй период (п. 2.2)
  if (fullAt !== null && parity) {
    const limit = SECOND_MAX[parity][input.epidural ? 'epidural' : 'plain'];
    const end = born ?? lastAt ?? fullAt;
    if (end - fullAt > limit) {
      hints.push({
        level: 'alert',
        text:
          `Второй период — ${dur(end - fullAt)}, больше ${dur(limit)} у ${parityGen(parity)}` +
          `${input.epidural ? ' с ЭА' : ' без ЭА'}. Заподозрить слабость родовой деятельности во втором периоде.`,
        source: `${SRC_ARD}, п. 2.2`,
      });
    } else if (born === null) {
      deadlines.push({ label: `Предел второго периода (${dur(limit)})`, at: fullAt + limit });
    }
  }

  if (phase === 'second' && fullAt !== null) {
    const heads = points.filter((p) => p.head !== null && p.at >= fullAt);
    if (heads.length) {
      const lastHead = heads[heads.length - 1];
      const since = plateauStart(heads, (p) => p.head).at;
      const span = lastHead.at - since;
      if ((lastHead.head as number) > 0 && span > HEAD_ARREST) {
        hints.push({
          level: 'alert',
          text:
            `Головка не продвигается ${dur(span)} во втором периоде (${lastHead.head}/5 над лоном). ` +
            'Вторичная слабость родовой деятельности, если нет признаков клинически узкого таза. ' +
            'Перед кесаревым сечением оценить возможность оперативного вагинального родоразрешения.' +
            (waters === null ? ' Плодный пузырь цел — показана амниотомия.' : ''),
          source: `${SRC_ARD}, п. 2.2, 3.2; ${SRC_NORMAL}`,
        });
      }
    }
  }

  // --- Скорость раскрытия в активной фазе
  let rate: number | null = null;
  if (activeStart !== null && lastDil && lastDil.at > activeStart) {
    const first = dil.find((p) => p.at === activeStart) as Point;
    rate = (((lastDil.dilation as number) - (first.dilation as number)) / (lastDil.at - activeStart)) * H;
    if (phase === 'active' && rate < MIN_RATE) {
      hints.push({
        level: 'info',
        text: `Средняя скорость раскрытия в активной фазе — ${formatRate(rate)}, ниже ${formatRate(MIN_RATE)}.`,
        source: SRC_NORMAL,
      });
    }
  }

  deadlines.sort((a, b) => a.at - b.at);
  return {
    points,
    phase,
    activeStart,
    fullAt,
    dilation: lastDil?.dilation ?? null,
    rate,
    hints,
    deadlines,
    weakness: weakness && (phase === 'latent' || phase === 'active'),
  };
}

function parityGen(p: Parity): string {
  return p === 'first' ? 'первородящей' : 'повторнородящей';
}

export function formatRate(cmPerHour: number): string {
  return `${cmPerHour.toFixed(1).replace('.', ',')} см/ч`;
}

/** Порядковый номер записи для новых осмотров. */
export function newRecordId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyRecord(id: string, date: string, time: string): PartoRecord {
  return { id, date, time, dilation: null, head: null, contractions: null, length: null };
}
