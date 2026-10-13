import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  CHAIN,
  DRY_PERIOD_MARK_HOURS,
  ENOX_COURSES_DAYS,
  ENOX_OFFSET_AFTER_BIRTH_HOURS,
  ENOX_OFFSET_AFTER_OPERATION_HOURS,
  buildCopyText,
  compute,
  durationText,
  emptyFields,
  enoxCourseText,
  formatDateTime,
  formatTick,
  parseDate,
  pluralDays,
  shiftDate,
  suggestDate,
  todayString,
  type Duration,
  type Enox,
  type EventKey,
  type FieldValue,
  type Result,
  type Scale,
} from './calc';
import { EventFields } from './components/EventFields';
import { AlertIcon, CheckIcon, ClockIcon, CopyIcon, DropIcon, SyringeIcon } from './components/Icons';
import { emptyState, load, save, type Saved } from './storage';
import { useServiceWorkerUpdate } from './useServiceWorkerUpdate';

const TITLES: Record<EventKey, string> = {
  contractions: 'Начало схваток',
  pushing: 'Начало потуг',
  fetus: 'Рождение плода',
  placenta: 'Рождение плаценты',
  waters: 'Излитие вод / амниотомия',
  opStart: 'Начало',
  opEnd: 'Конец',
};

/** Родительный падеж для подписей полей: «Дата начала схваток». */
const OF: Record<EventKey, string> = {
  contractions: 'начала схваток',
  pushing: 'начала потуг',
  fetus: 'рождения плода',
  placenta: 'рождения плаценты',
  waters: 'излития вод',
  opStart: 'начала операции',
  opEnd: 'конца операции',
};

const PERIOD_LABELS = ['1 период', '2 период', '3 период'];

function withField(s: Saved, key: EventKey, patch: Partial<FieldValue>): Saved {
  return { ...s, fields: { ...s.fields, [key]: { ...s.fields[key], ...patch } } };
}

function DurationValue({ d, className }: { d: Duration; className: string }) {
  const mod = d.kind === 'empty' ? ' none' : d.kind === 'error' ? ' bad-text' : '';
  return <span className={className + mod}>{durationText(d)}</span>;
}

export default function App() {
  const [state, setState] = useState<Saved>(load);
  const { fields, opOpen } = state;
  const result = useMemo(() => compute(fields, opOpen), [fields, opOpen]);
  const updateReady = useServiceWorkerUpdate();

  useEffect(() => save(state), [state]);

  const timeRefs = useRef<Partial<Record<EventKey, HTMLInputElement | null>>>({});
  const addOpRef = useRef<HTMLButtonElement>(null);
  const focusAfterOp = useRef<'open' | 'close' | null>(null);

  useEffect(() => {
    if (focusAfterOp.current === 'open') timeRefs.current.opStart?.focus();
    if (focusAfterOp.current === 'close') addOpRef.current?.focus();
    focusAfterOp.current = null;
  }, [opOpen]);

  const order: EventKey[] = [...CHAIN, 'waters', ...(opOpen ? (['opStart', 'opEnd'] as const) : [])];

  const focusNext = (key: EventKey) => {
    const next = order[order.indexOf(key) + 1];
    const el = next ? timeRefs.current[next] : null;
    if (el) {
      el.focus();
      el.select();
    } else {
      timeRefs.current[key]?.blur();
    }
  };

  const today = todayString();

  const handlers = (key: EventKey) => ({
    onDate: (date: string) => setState((s) => withField(s, key, { date })),
    onTime: (time: string, complete: boolean) => {
      setState((s) => {
        const patch: Partial<FieldValue> = { time };
        if (time && s.fields[key].date === '') patch.date = suggestDate(s.fields, key, todayString());
        return withField(s, key, patch);
      });
      if (complete) focusNext(key);
    },
    onShift: (days: 1 | -1) =>
      setState((s) => {
        const cur = s.fields[key].date;
        const base = parseDate(cur) ? cur : suggestDate(s.fields, key, todayString());
        return withField(s, key, { date: shiftDate(base, days) ?? base });
      }),
  });

  const fieldProps = (key: EventKey) => ({
    id: key,
    of: OF[key],
    value: fields[key],
    suggestion: suggestDate(fields, key, today),
    mark: result.bad.has(key) ? ('bad' as const) : ('none' as const),
    timeRef: (el: HTMLInputElement | null) => {
      timeRefs.current[key] = el;
    },
    ...handlers(key),
  });

  // ---------- Очистка в два нажатия ----------
  const [clearArmed, setClearArmed] = useState(false);
  const clearTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(clearTimer.current), []);
  const onClear = () => {
    window.clearTimeout(clearTimer.current);
    if (clearArmed) {
      setState(emptyState());
      setClearArmed(false);
    } else {
      setClearArmed(true);
      clearTimer.current = window.setTimeout(() => setClearArmed(false), 3000);
    }
  };

  const openOp = () => {
    focusAfterOp.current = 'open';
    setState((s) => ({ ...s, opOpen: true }));
  };
  const closeOp = () => {
    focusAfterOp.current = 'close';
    const blank = emptyFields();
    setState((s) => ({ ...s, opOpen: false, fields: { ...s.fields, opStart: blank.opStart, opEnd: blank.opEnd } }));
  };

  const periods = [result.p1, result.p2, result.p3];

  return (
    <main className={updateReady ? 'app has-update' : 'app'}>
      <header className="top">
        <div>
          <div className="eyebrow">Калькулятор</div>
          <h1>Периоды родов</h1>
        </div>
        <button type="button" className={clearArmed ? 'btn-danger' : 'btn-ghost'} onClick={onClear}>
          {clearArmed ? 'Точно очистить?' : 'Очистить'}
        </button>
      </header>

      <section className="card" aria-label="События родов">
        <div className="spine">
          {CHAIN.map((key, i) => {
            const period = periods[i] as Duration | undefined;
            const line = !period
              ? null
              : period.kind === 'value'
                ? `ln p${i + 1}`
                : period.kind === 'error'
                  ? 'ln bad'
                  : 'ln';
            const dot = result.bad.has(key) ? 'dot bad' : result.minutes[key] !== null ? 'dot' : 'dot empty';
            return (
              <Fragment key={key}>
                <div className="ev">
                  <div className="rail">
                    <span className={dot} />
                    {line && <span className={line} />}
                  </div>
                  <div>
                    <label className="ev-label" htmlFor={`${key}-time`}>
                      {TITLES[key]}
                    </label>
                    <EventFields {...fieldProps(key)} />
                  </div>
                </div>
                {period && line && (
                  <div className="seg">
                    <div className="rail">
                      <span className={line} />
                    </div>
                    <div className="seg-body">
                      <span className={period.kind === 'error' ? 'tag bad' : 'tag'}>
                        <span className={`sw p${i + 1}`} />
                        {PERIOD_LABELS[i]}
                      </span>
                      <DurationValue d={period} className="dur" />
                    </div>
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      </section>

      <section className="card" aria-labelledby="waters-title">
        <div className="card-h">
          <span className="ico water">
            <DropIcon />
          </span>
          <div>
            <label id="waters-title" className="card-t" htmlFor="waters-time">
              {TITLES.waters}
            </label>
            <div className="card-s">Начало безводного промежутка</div>
          </div>
        </div>
        <EventFields {...fieldProps('waters')} flush />
        <div className="kv">
          <span className="k">{DRY_PERIOD_MARK_HOURS} ч безводного периода</span>
          {result.dryMark === null ? (
            <span className="v none">—</span>
          ) : (
            <span className="v">{formatDateTime(result.dryMark)}</span>
          )}
        </div>
      </section>

      <section className="card" aria-labelledby="op-title">
        <div className="card-h split">
          <div className="card-h-main">
            <span className={opOpen ? 'ico accent' : 'ico neutral'}>
              <ClockIcon />
            </span>
            <div>
              <h2 id="op-title" className="card-title card-t">
                Операция
              </h2>
              {!opOpen && <div className="card-s">Не было</div>}
            </div>
          </div>
          {opOpen ? (
            <button type="button" className="btn-ghost" onClick={closeOp}>
              Убрать
            </button>
          ) : (
            <button type="button" className="btn-ghost" ref={addOpRef} onClick={openOp}>
              Добавить
            </button>
          )}
        </div>
        {opOpen && (
          <>
            {(['opStart', 'opEnd'] as const).map((key) => (
              <div key={key}>
                <label className="sub-label" htmlFor={`${key}-time`}>
                  {TITLES[key]}
                </label>
                <EventFields {...fieldProps(key)} flush />
              </div>
            ))}
            <div className="kv">
              <span className="k">Продолжительность операции</span>
              <DurationValue d={result.op!} className="v" />
            </div>
          </>
        )}
      </section>

      <ResultCard result={result} opOpen={opOpen} />

      <EnoxCard enox={result.enox} />

      <p className="foot">Работает без интернета. Данные хранятся только на этом телефоне.</p>

      {updateReady && (
        <div className="update" role="status">
          <span>Доступна новая версия</span>
          <button type="button" onClick={() => window.location.reload()}>
            Обновить
          </button>
        </div>
      )}
    </main>
  );
}

// ---------- Результат ----------

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // переходим к запасному варианту
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

function ResultCard({ result, opOpen }: { result: Result; opOpen: boolean }) {
  const [copy, setCopy] = useState<'idle' | 'done' | 'fail'>('idle');
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onCopy = async () => {
    const ok = await copyToClipboard(buildCopyText(result));
    setCopy(ok ? 'done' : 'fail');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopy('idle'), 2000);
  };

  const rows: Array<{ label: string; marker: string; d: Duration }> = [
    { label: '1 период', marker: 'sw p1', d: result.p1 },
    { label: '2 период', marker: 'sw p2', d: result.p2 },
    { label: '3 период', marker: 'sw p3', d: result.p3 },
    { label: 'Безводный промежуток', marker: 'wsw', d: result.dry },
  ];
  if (opOpen && result.op) rows.push({ label: 'Продолжительность операции', marker: 'sw op', d: result.op });

  return (
    <section className="card" aria-label="Результат">
      {result.errors.length > 0 && (
        <div className="alert" role="alert">
          <AlertIcon />
          <div>
            {result.errors.map((e) => (
              <p key={e.event}>{e.message}</p>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="total-k">Общая продолжительность родов</div>
        <div
          className={
            result.total.kind === 'value' ? 'total-v' : result.total.kind === 'error' ? 'total-v bad-text' : 'total-v none'
          }
        >
          {durationText(result.total)}
        </div>
      </div>
      <dl className="lines">
        {rows.map((r) => (
          <div className="row" key={r.label}>
            <dt>
              <span className={r.marker} />
              {r.label}
            </dt>
            <DurationDd d={r.d} />
          </div>
        ))}
      </dl>
      <ScaleView scale={result.scale} />
      <button
        type="button"
        className={copy === 'idle' ? 'btn-primary' : copy === 'done' ? 'btn-done' : 'btn-done fail'}
        onClick={onCopy}
      >
        {copy === 'done' ? <CheckIcon /> : <CopyIcon />}
        {copy === 'done' ? 'Скопировано' : copy === 'fail' ? 'Не удалось скопировать' : 'Скопировать'}
      </button>
      <span className="sr-only" aria-live="polite">
        {copy === 'done' ? 'Результат скопирован' : copy === 'fail' ? 'Не удалось скопировать' : ''}
      </span>
    </section>
  );
}

function DurationDd({ d }: { d: Duration }) {
  const cls = d.kind === 'empty' ? 'none' : d.kind === 'error' ? 'bad' : undefined;
  return <dd className={cls}>{durationText(d)}</dd>;
}

function ScaleView({ scale }: { scale: Scale }) {
  if (scale.status === 'error') return <div className="scale-off">Шкала появится, когда исправите ошибку.</div>;
  if (scale.status === 'empty' || scale.start === null || scale.end === null) {
    return (
      <div className="scale-off">Шкала появится, когда будут введены начало схваток и рождение плаценты.</div>
    );
  }
  const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
  return (
    <figure className="scale" aria-label={scale.description}>
      <div aria-hidden="true">
        <div className="track">
          {scale.pieces.map((p, i) => (
            <span key={i} className={p.kind === 'gap' ? undefined : p.kind} style={{ flex: `${p.minutes} 0 0` }} />
          ))}
        </div>
        {scale.water && (
          <div className="wtrack">
            <span
              className={scale.water.open ? 'wbar open' : 'wbar'}
              style={{ left: pct(scale.water.left), width: pct(scale.water.width) }}
            />
          </div>
        )}
        <div className="ticks">
          <span>{formatTick(scale.start)}</span>
          <span>{formatTick(scale.end)}</span>
        </div>
      </div>
    </figure>
  );
}

// ---------- Эноксапарин ----------

function enoxSubtitle(enox: Enox): string {
  if (enox.status === 'empty') return 'Даты появятся после ввода рождения плода';
  if (enox.status === 'error') return 'Даты появятся, когда исправите ошибку';
  if (enox.source === 'operation') {
    return ENOX_OFFSET_AFTER_OPERATION_HOURS
      ? `Отсчёт: окончание операции + ${ENOX_OFFSET_AFTER_OPERATION_HOURS} ч`
      : 'Отсчёт: окончание операции';
  }
  return `Отсчёт: рождение плода + ${ENOX_OFFSET_AFTER_BIRTH_HOURS} ч`;
}

function EnoxCard({ enox }: { enox: Enox }) {
  const none = <span className="v none">—</span>;
  return (
    <section className="card" aria-labelledby="enox-title">
      <div className="card-h">
        <span className="ico accent">
          <SyringeIcon />
        </span>
        <div>
          <h2 id="enox-title" className="card-title card-t">
            Эноксапарин
          </h2>
          <div className="card-s">{enoxSubtitle(enox)}</div>
        </div>
      </div>
      <div className="kv">
        <span className="k">Начало отсчёта</span>
        {enox.start === null ? none : <span className="v">{formatDateTime(enox.start)}</span>}
      </div>
      {ENOX_COURSES_DAYS.map((days, i) => {
        const course = enox.courses[i];
        return (
          <div className="kv" key={days}>
            <span className="k">{pluralDays(days)}</span>
            {course ? <span className="v">{enoxCourseText(course)}</span> : none}
          </div>
        );
      })}
    </section>
  );
}
