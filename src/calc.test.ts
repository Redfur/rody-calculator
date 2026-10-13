import { describe, expect, it } from 'vitest';
import {
  buildCopyText,
  compute,
  durationText,
  emptyFields,
  enoxCourseText,
  formatDateTime,
  formatDuration,
  maskDate,
  maskTime,
  parseDate,
  parseTime,
  shiftDate,
  suggestDate,
  type EventKey,
  type Fields,
} from './calc';

function fields(values: Partial<Record<EventKey, [string, string]>>): Fields {
  const f = emptyFields();
  for (const [k, [date, time]] of Object.entries(values) as [EventKey, [string, string]][]) {
    f[k] = { date, time };
  }
  return f;
}

const FULL = fields({
  contractions: ['13.10.2026', '22:40'],
  pushing: ['14.10.2026', '06:50'],
  fetus: ['14.10.2026', '07:25'],
  placenta: ['14.10.2026', '07:35'],
  waters: ['14.10.2026', '04:30'],
});

const CESAREAN = fields({
  fetus: ['14.10.2026', '10:24'],
  placenta: ['14.10.2026', '10:27'],
  waters: ['14.10.2026', '10:23'],
  opStart: ['14.10.2026', '10:12'],
  opEnd: ['14.10.2026', '11:02'],
});

describe('полный пример', () => {
  const r = compute(FULL, false);

  it('считает периоды', () => {
    expect(durationText(r.total)).toBe('8 ч 55 мин');
    expect(durationText(r.p1)).toBe('8 ч 10 мин');
    expect(durationText(r.p2)).toBe('35 мин');
    expect(durationText(r.p3)).toBe('10 мин');
    expect(durationText(r.dry)).toBe('2 ч 55 мин');
    expect(r.op).toBeNull();
    expect(r.errors).toEqual([]);
  });

  it('18 часов безводного периода', () => {
    expect(formatDateTime(r.dryMark!)).toBe('14.10.2026 в 22:30');
  });

  it('эноксапарин от рождения плода + 12 ч', () => {
    expect(r.enox.source).toBe('birth');
    expect(formatDateTime(r.enox.start!)).toBe('14.10.2026 в 19:25');
    expect(r.enox.courses.map(enoxCourseText)).toEqual([
      'до 24.10.2026 в 19:25, сб',
      'до 25.11.2026 в 19:25, ср',
    ]);
  });

  it('шкала в масштабе времени', () => {
    expect(r.scale.status).toBe('ok');
    expect(r.scale.pieces).toEqual([
      { kind: 'p1', minutes: 490 },
      { kind: 'p2', minutes: 35 },
      { kind: 'p3', minutes: 10 },
    ]);
    expect(r.scale.water!.left).toBeCloseTo(350 / 535);
    expect(r.scale.water!.width).toBeCloseTo(175 / 535);
    expect(r.scale.water!.open).toBe(false);
  });
});

describe('воды до схваток', () => {
  const r = compute(
    fields({
      contractions: ['13.10.2026', '22:40'],
      pushing: ['14.10.2026', '06:50'],
      fetus: ['14.10.2026', '07:25'],
      waters: ['13.10.2026', '12:00'],
    }),
    false,
  );

  it('безводный длиннее 1 периода — не ошибка', () => {
    expect(durationText(r.dry)).toBe('19 ч 25 мин');
    expect(r.errors).toEqual([]);
    expect(formatDateTime(r.dryMark!)).toBe('14.10.2026 в 06:00');
  });

  it('шкала начинается с вод', () => {
    expect(r.scale.pieces[0]).toEqual({ kind: 'gap', minutes: 640 });
    expect(r.scale.water!.left).toBe(0);
  });
});

describe('ошибка даты после полуночи', () => {
  const r = compute(
    fields({
      contractions: ['13.10.2026', '22:40'],
      pushing: ['13.10.2026', '06:50'],
      fetus: ['14.10.2026', '07:25'],
      placenta: ['14.10.2026', '07:35'],
    }),
    false,
  );

  it('1 и 2 период — ошибка, общая считается', () => {
    expect(durationText(r.p1)).toBe('ошибка');
    expect(durationText(r.p2)).toBe('ошибка');
    expect(durationText(r.p3)).toBe('10 мин');
    expect(durationText(r.total)).toBe('8 ч 55 мин');
  });

  it('предлагает сдвинуть дату потуг на +1 день', () => {
    expect(r.errors).toHaveLength(1);
    const e = r.errors[0];
    expect(e.event).toBe('pushing');
    expect(e.hint).toEqual({ event: 'pushing', days: 1, current: '13.10' });
    expect(e.message).toBe(
      'Потуги указаны раньше начала схваток. Похоже, у потуг осталась дата 13.10, проверьте её.',
    );
    expect([...r.bad]).toEqual(['pushing']);
  });

  it('вместо шкалы — заглушка', () => {
    expect(r.scale.status).toBe('error');
  });

  it('без подсказки, если сдвиг не помогает', () => {
    const r2 = compute(
      fields({
        contractions: ['13.10.2026', '22:40'],
        pushing: ['10.10.2026', '06:50'],
      }),
      false,
    );
    expect(r2.errors[0].event).toBe('pushing');
    expect(r2.errors[0].hint).toBeNull();
    expect(r2.errors[0].message).toBe('Потуги указаны раньше начала схваток.');
  });

  it('воды позже плода — ошибка безводного', () => {
    const r3 = compute(fields({ fetus: ['14.10.2026', '07:25'], waters: ['14.10.2026', '09:00'] }), false);
    expect(durationText(r3.dry)).toBe('ошибка');
    expect(r3.errors[0].event).toBe('waters');
    expect(r3.errors[0].message).toBe('Излитие вод указано позже рождения плода.');
  });

  it('конец операции раньше начала', () => {
    const r4 = compute(
      fields({ opStart: ['14.10.2026', '23:50'], opEnd: ['14.10.2026', '00:40'] }),
      true,
    );
    expect(durationText(r4.op!)).toBe('ошибка');
    expect(r4.errors[0].event).toBe('opEnd');
    expect(r4.errors[0].hint?.days).toBe(1);
  });
});

describe('кесарево сечение', () => {
  const r = compute(CESAREAN, true);

  it('считает доступное, остальное —', () => {
    expect(durationText(r.p3)).toBe('3 мин');
    expect(durationText(r.dry)).toBe('1 мин');
    expect(durationText(r.op!)).toBe('50 мин');
    expect(durationText(r.total)).toBe('—');
    expect(durationText(r.p1)).toBe('—');
    expect(durationText(r.p2)).toBe('—');
    expect(r.errors).toEqual([]);
  });

  it('эноксапарин от конца операции без +12 ч', () => {
    expect(r.enox.source).toBe('operation');
    expect(formatDateTime(r.enox.start!)).toBe('14.10.2026 в 11:02');
    expect(r.enox.courses.map(enoxCourseText)).toEqual([
      'до 24.10.2026 в 11:02, сб',
      'до 25.11.2026 в 11:02, ср',
    ]);
  });

  it('если операция свёрнута, её поля не учитываются', () => {
    const closed = compute(CESAREAN, false);
    expect(closed.op).toBeNull();
    expect(closed.enox.source).toBe('birth');
  });
});

describe('формат длительности', () => {
  it.each([
    [0, '0 мин'],
    [3, '3 мин'],
    [59, '59 мин'],
    [60, '1 ч 00 мин'],
    [490, '8 ч 10 мин'],
    [545, '9 ч 05 мин'],
    [720, '12 ч 00 мин'],
    [1570, '26 ч 10 мин'],
  ])('%i → %s', (m, s) => expect(formatDuration(m)).toBe(s));
});

describe('эноксапарин: граничные случаи', () => {
  it('ночные роды сдвигают дату', () => {
    const r = compute(fields({ fetus: ['14.10.2026', '20:00'] }), false);
    expect(formatDateTime(r.enox.start!)).toBe('15.10.2026 в 08:00');
    expect(enoxCourseText(r.enox.courses[0])).toBe('до 25.10.2026 в 08:00, вс');
  });

  it('переход через год', () => {
    const r = compute(fields({ fetus: ['25.12.2026', '15:00'] }), false);
    expect(formatDateTime(r.enox.start!)).toBe('26.12.2026 в 03:00');
    expect(enoxCourseText(r.enox.courses[0])).toBe('до 05.01.2027 в 03:00, вт');
  });

  it('операция добавлена, но конец пуст — отсчёт от плода', () => {
    const r = compute(
      fields({ fetus: ['14.10.2026', '07:25'], opStart: ['14.10.2026', '07:00'] }),
      true,
    );
    expect(r.enox.source).toBe('birth');
    expect(formatDateTime(r.enox.start!)).toBe('14.10.2026 в 19:25');
  });

  it('без источника — пусто', () => {
    const r = compute(emptyFields(), false);
    expect(r.enox.status).toBe('empty');
    expect(r.enox.start).toBeNull();
  });
});

describe('разбор ввода', () => {
  it('маска времени', () => {
    expect(maskTime('0845')).toBe('08:45');
    expect(maskTime('084')).toBe('08:4');
    expect(maskTime('08')).toBe('08');
    expect(maskTime('8:45')).toBe('08:45');
    expect(parseTime(maskTime('0845'))).toEqual({ h: 8, mi: 45 });
    expect(parseTime(maskTime('2460'))).toBeNull();
    expect(parseTime('23:59')).toEqual({ h: 23, mi: 59 });
    expect(parseTime('08:4')).toBeNull();
  });

  it('маска даты', () => {
    expect(maskDate('13102026')).toBe('13.10.2026');
    expect(maskDate('1310')).toBe('13.10');
    expect(maskDate('131')).toBe('13.1');
  });

  it('проверка существования даты', () => {
    expect(parseDate('31.02.2026')).toBeNull();
    expect(parseDate('29.02.2026')).toBeNull();
    expect(parseDate('29.02.2028')).toEqual({ y: 2028, m: 2, d: 29 });
    expect(parseDate('13.10.26')).toBeNull();
  });

  it('сдвиг даты', () => {
    expect(shiftDate('31.12.2026', 1)).toBe('01.01.2027');
    expect(shiftDate('01.03.2028', -1)).toBe('29.02.2028');
  });

  it('незаполненное время — событие пустое', () => {
    const r = compute(fields({ contractions: ['13.10.2026', '22:4'], placenta: ['14.10.2026', '07:35'] }), false);
    expect(r.minutes.contractions).toBeNull();
    expect(durationText(r.total)).toBe('—');
  });
});

describe('автоподстановка даты', () => {
  const today = '01.01.2030';
  it('от предыдущего события цепочки', () => {
    const f = fields({ contractions: ['13.10.2026', '22:40'] });
    expect(suggestDate(f, 'fetus', today)).toBe('13.10.2026');
    expect(suggestDate(f, 'contractions', today)).toBe(today);
  });
  it('воды — от схваток, иначе от первого заполненного', () => {
    expect(suggestDate(fields({ pushing: ['14.10.2026', ''] }), 'waters', today)).toBe('14.10.2026');
    expect(suggestDate(emptyFields(), 'waters', today)).toBe(today);
  });
  it('операция — от плода, конец — от начала', () => {
    const f = fields({ contractions: ['13.10.2026', ''], fetus: ['14.10.2026', ''] });
    expect(suggestDate(f, 'opStart', today)).toBe('14.10.2026');
    f.opStart = { date: '15.10.2026', time: '' };
    expect(suggestDate(f, 'opEnd', today)).toBe('15.10.2026');
  });
});

describe('текст для копирования', () => {
  it('полный пример — ровно пять строк', () => {
    expect(buildCopyText(compute(FULL, false))).toBe(
      [
        'Общая продолжительность родов: 8 ч 55 мин',
        '1 период: 8 ч 10 мин',
        '2 период: 35 мин',
        '3 период: 10 мин',
        'Безводный промежуток: 2 ч 55 мин',
      ].join('\n'),
    );
  });

  it('кесарево — без операции, 18 часов и эноксапарина', () => {
    const text = buildCopyText(compute(CESAREAN, true));
    expect(text).toBe(
      [
        'Общая продолжительность родов: —',
        '1 период: —',
        '2 период: —',
        '3 период: 3 мин',
        'Безводный промежуток: 1 мин',
      ].join('\n'),
    );
    expect(text.split('\n')).toHaveLength(5);
  });

  it('«ошибка» копируется как —', () => {
    const r = compute(
      fields({
        contractions: ['13.10.2026', '22:40'],
        pushing: ['13.10.2026', '06:50'],
        fetus: ['14.10.2026', '07:25'],
        placenta: ['14.10.2026', '07:35'],
      }),
      false,
    );
    expect(buildCopyText(r)).toContain('1 период: —\n2 период: —');
  });
});
