import { describe, expect, it } from 'vitest';
import { toMinutes } from './calc';
import { analyze, type PartoInput, type PartoRecord } from './partogram';

const m = (date: string, time: string) => toMinutes(date, time) as number;

let seq = 0;
function rec(date: string, time: string, values: Partial<PartoRecord>): PartoRecord {
  return { id: String(++seq), date, time, dilation: null, head: null, contractions: null, length: null, ...values };
}

function input(records: PartoRecord[], extra: Partial<PartoInput> = {}): PartoInput {
  return {
    records,
    parity: 'first',
    epidural: false,
    laborStart: null,
    waters: null,
    oxytocin: null,
    born: null,
    ...extra,
  };
}

const D = '14.10.2026';
const alerts = (a: ReturnType<typeof analyze>) => a.hints.filter((h) => h.level === 'alert');

describe('партограмма: нормальные роды', () => {
  const a = analyze(
    input(
      [
        rec(D, '04:00', { dilation: 5, head: 3, contractions: 3, length: '20to40' }),
        rec(D, '08:00', { dilation: 8, head: 1, contractions: 4, length: '40to60' }),
        rec(D, '10:00', { dilation: 10, head: 0, contractions: 4, length: '40to60' }),
      ],
      { laborStart: m('13.10.2026', '20:00'), born: m(D, '10:50') },
    ),
  );

  it('фазы и скорость', () => {
    expect(a.phase).toBe('born');
    expect(a.activeStart).toBe(m(D, '04:00'));
    expect(a.fullAt).toBe(m(D, '10:00'));
    expect(a.rate).toBeCloseTo(5 / 6);
  });

  it('без тревожных подсказок', () => {
    expect(alerts(a)).toEqual([]);
    expect(a.weakness).toBe(false);
  });
});

describe('партограмма: подсказки КР', () => {
  it('открытие 6 см держится 5 ч — п. 2.3', () => {
    const a = analyze(
      input([
        rec(D, '08:00', { dilation: 5 }),
        rec(D, '09:00', { dilation: 6 }),
        rec(D, '14:00', { dilation: 6 }),
      ]),
    );
    expect(a.phase).toBe('active');
    expect(alerts(a)[0].text).toContain('Открытие 6 см держится 5 ч 00 мин');
    expect(alerts(a)[0].source).toContain('п. 2.3');
    expect(a.weakness).toBe(true);
  });

  it('до порога — контрольное время', () => {
    const a = analyze(input([rec(D, '09:00', { dilation: 7 }), rec(D, '10:00', { dilation: 7 })]));
    expect(alerts(a)).toEqual([]);
    const d = a.deadlines.find((x) => x.label.startsWith('Открытие 7 см'));
    expect(d?.at).toBe(m(D, '12:00'));
  });

  it('воды излились, 4 ч без динамики, слабые схватки — слабость активной фазы', () => {
    const a = analyze(
      input(
        [
          rec(D, '08:00', { dilation: 6 }),
          rec(D, '10:00', { contractions: 2, length: '20to40' }),
          rec(D, '12:00', { dilation: 6 }),
        ],
        { waters: m(D, '08:00') },
      ),
    );
    expect(alerts(a).some((h) => h.text.startsWith('Слабость активной фазы'))).toBe(true);
    expect(a.weakness).toBe(true);
  });

  it('адекватные схватки, более 4 ч без динамики — кесарево сечение (п. 3.2)', () => {
    const a = analyze(
      input(
        [
          rec(D, '08:00', { dilation: 6 }),
          rec(D, '09:00', { contractions: 4, length: '40to60' }),
          rec(D, '11:00', { contractions: 4, length: '40to60' }),
          rec(D, '12:30', { dilation: 6 }),
        ],
        { waters: m(D, '07:00') },
      ),
    );
    const cs = alerts(a).find((h) => h.source.endsWith('п. 3.2'));
    expect(cs?.text).toContain('кесарева сечения');
  });

  it('затяжная латентная фаза у первородящей (> 20 ч)', () => {
    const a = analyze(input([rec(D, '00:30', { dilation: 3 })], { laborStart: m('13.10.2026', '00:00') }));
    expect(a.phase).toBe('latent');
    expect(alerts(a)[0].text).toContain('Латентная фаза — 24 ч 30 мин');
  });

  it('у повторнородящей предел латентной фазы 14 ч', () => {
    const a = analyze(input([rec(D, '02:00', { dilation: 2 })], { parity: 'repeat', laborStart: m(D, '00:00') }));
    expect(a.deadlines[0].at).toBe(m(D, '14:00'));
  });

  it('второй период > 3 ч без ЭА; с ЭА — 4 ч', () => {
    const recs = [rec(D, '10:00', { dilation: 10 }), rec(D, '13:10', { head: 0 })];
    expect(alerts(analyze(input(recs)))[0].text).toContain('Второй период — 3 ч 10 мин');
    const ea = analyze(input(recs, { epidural: true }));
    expect(alerts(ea)).toEqual([]);
    expect(ea.deadlines[0].at).toBe(m(D, '14:00'));
  });

  it('головка не продвигается > 1 ч во втором периоде', () => {
    const a = analyze(
      input([rec(D, '10:00', { dilation: 10, head: 2 }), rec(D, '11:10', { head: 2 })], { waters: m(D, '09:00') }),
    );
    expect(alerts(a)[0].text).toContain('Головка не продвигается 1 ч 10 мин');
  });

  it('тахисистолия на фоне окситоцина', () => {
    const a = analyze(
      input([rec(D, '08:00', { dilation: 6, contractions: 6 }), rec(D, '08:30', { contractions: 6 })], {
        oxytocin: m(D, '07:00'),
        waters: m(D, '06:00'),
      }),
    );
    const t = alerts(a).find((h) => h.text.startsWith('Тахисистолия'));
    expect(t?.text).toContain('Дозу окситоцина уменьшить');
  });

  it('6 ч родостимуляции без динамики — п. 3.2', () => {
    const a = analyze(
      input([rec(D, '08:00', { dilation: 6 }), rec(D, '14:40', { dilation: 6 })], {
        oxytocin: m(D, '08:30'),
        waters: m(D, '08:00'),
      }),
    );
    expect(alerts(a).some((h) => h.text.startsWith('Родостимуляция окситоцином 6 ч 10 мин'))).toBe(true);
  });

  it('без паритета — просит указать', () => {
    const a = analyze(input([rec(D, '08:00', { dilation: 4 })], { parity: null }));
    expect(a.hints[0].level).toBe('info');
  });

  it('записи с неполным временем не учитываются', () => {
    const a = analyze(input([rec(D, '08:', { dilation: 4 })]));
    expect(a.points).toEqual([]);
    expect(a.phase).toBe('none');
  });
});
