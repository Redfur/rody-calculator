import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  formatClock,
  formatDayMonth,
  parseDate,
  suggestDate,
  toMinutes,
  todayString,
  type EventKey,
  type FieldValue,
} from '../calc';
import { EventFields } from '../components/EventFields';
import { fieldHandlers } from '../components/fieldHandlers';
import { AlertIcon, ChartIcon, DripIcon, DropIcon, InfoIcon, PersonIcon, PlusIcon } from '../components/Icons';
import { PartogramChart } from '../components/PartogramChart';
import {
  LENGTH_LABELS,
  PHASE_LABELS,
  SRC_ARD,
  SRC_NORMAL,
  analyze,
  emptyRecord,
  formatRate,
  newRecordId,
  type Analysis,
  type ContractionLength,
  type Hint,
  type PartoRecord,
} from '../partogram';
import type { Saved } from '../storage';
import { OF, withField } from './PeriodsScreen';

interface Props {
  state: Saved;
  setState: Dispatch<SetStateAction<Saved>>;
}

type Parto = Saved['parto'];

const pad2 = (n: number) => String(n).padStart(2, '0');
function nowField(): FieldValue {
  const d = new Date();
  return { date: todayString(d), time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}` };
}

export function PartogramScreen({ state, setState }: Props) {
  const { fields, parto } = state;
  const today = todayString();
  const [editing, setEditing] = useState<string | null>(null);

  const setParto = (fn: (p: Parto) => Parto) => setState((s) => ({ ...s, parto: fn(s.parto) }));
  const minutes = (k: EventKey) => toMinutes(fields[k].date, fields[k].time);
  const oxytocin = parto.oxyOpen ? toMinutes(parto.oxytocin.date, parto.oxytocin.time) : null;

  const analysis = useMemo(
    () =>
      analyze({
        records: parto.records,
        parity: parto.parity,
        epidural: parto.epidural,
        laborStart: minutes('contractions'),
        waters: minutes('waters'),
        oxytocin,
        born: minutes('fetus'),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parto, fields],
  );

  const shared = (key: EventKey) =>
    fieldHandlers(fields[key], (patch) => setState((s) => withField(s, key, patch)), suggestDate(fields, key, today));

  // ---------- Осмотры ----------
  const lastDate = [...parto.records].reverse().find((r) => parseDate(r.date))?.date;
  const recordSuggestion = lastDate ?? (parseDate(fields.contractions.date) ? fields.contractions.date : today);

  const addRecord = () => {
    const id = newRecordId();
    setParto((p) => ({ ...p, records: [...p.records, emptyRecord(id, '', '')] }));
    setEditing(id);
  };
  const updateRecord = (id: string, patch: Partial<PartoRecord>) =>
    setParto((p) => ({ ...p, records: p.records.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const removeRecord = (id: string) => {
    setParto((p) => ({ ...p, records: p.records.filter((r) => r.id !== id) }));
    setEditing(null);
  };
  const closeEditor = () => {
    setParto((p) => ({
      ...p,
      records: p.records.filter((r) => {
        if (r.id !== editing) return true;
        const empty = r.dilation === null && r.head === null && r.contractions === null && r.length === null;
        return !(empty && toMinutes(r.date, r.time) === null);
      }),
    }));
    setEditing(null);
  };

  const sorted = [...parto.records].sort((a, b) => {
    const ta = toMinutes(a.date, a.time) ?? Infinity;
    const tb = toMinutes(b.date, b.time) ?? Infinity;
    return tb - ta;
  });

  return (
    <>
      <section className="card" aria-labelledby="pg-woman">
        <div className="card-h">
          <span className="ico neutral">
            <PersonIcon />
          </span>
          <div>
            <h2 id="pg-woman" className="card-title card-t">
              Роженица
            </h2>
            <div className="card-s">От этого зависят предельные сроки</div>
          </div>
        </div>
        <div className="seg-ctl" role="radiogroup" aria-label="Роды по счёту">
          {(['first', 'repeat'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={parto.parity === v}
              className={parto.parity === v ? 'seg-btn on' : 'seg-btn'}
              onClick={() => setParto((p) => ({ ...p, parity: v }))}
            >
              {v === 'first' ? 'Первородящая' : 'Повторнородящая'}
            </button>
          ))}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={parto.epidural}
          className="switch-row"
          onClick={() => setParto((p) => ({ ...p, epidural: !p.epidural }))}
        >
          <span>Эпидуральная анальгезия</span>
          <span className={parto.epidural ? 'switch on' : 'switch'} aria-hidden="true" />
        </button>
      </section>

      <section className="card" aria-label="События">
        <div>
          <label className="card-t" htmlFor="pg-contractions-time">
            Начало регулярных схваток
          </label>
          <div className="card-s">Общее с вкладкой «Периоды»</div>
          <EventFields id="pg-contractions" of={OF.contractions} {...shared('contractions')} />
        </div>
        <div>
          <div className="card-h">
            <span className="ico water">
              <DropIcon />
            </span>
            <label className="card-t" htmlFor="pg-waters-time">
              Излитие вод / амниотомия
            </label>
          </div>
          <EventFields id="pg-waters" of={OF.waters} {...shared('waters')} />
          {minutes('waters') === null && <div className="card-s pad-top">Не отмечено — плодный пузырь считается целым</div>}
        </div>
      </section>

      <OxytocinCard parto={parto} setParto={setParto} suggestion={recordSuggestion} />

      <section className="card" aria-labelledby="pg-exams">
        <div className="card-h split">
          <div>
            <h2 id="pg-exams" className="card-title card-t">
              Осмотры
            </h2>
            <div className="card-s">
              {parto.records.length ? `Записей: ${parto.records.length}` : 'Раскрытие, головка, схватки'}
            </div>
          </div>
          <button type="button" className="btn-ghost with-icon" onClick={addRecord} disabled={editing !== null}>
            <PlusIcon />
            Добавить
          </button>
        </div>
        {sorted.map((r) =>
          r.id === editing ? (
            <RecordEditor
              key={r.id}
              record={r}
              suggestion={recordSuggestion}
              onChange={(patch) => updateRecord(r.id, patch)}
              onDone={closeEditor}
              onDelete={() => removeRecord(r.id)}
            />
          ) : (
            <button
              key={r.id}
              type="button"
              className="rec"
              onClick={() => setEditing(r.id)}
              disabled={editing !== null}
              aria-label={`Изменить осмотр: ${recordSummary(r)}`}
            >
              <span className="rec-t">{recordTime(r)}</span>
              <span className="rec-v">{recordValues(r)}</span>
            </button>
          ),
        )}
      </section>

      <HintsCard analysis={analysis} watersKnown={minutes('waters') !== null} oxytocin={oxytocin} />

      <section className="card" aria-labelledby="pg-chart">
        <div className="card-h split">
          <div className="card-h-main">
            <span className="ico accent">
              <ChartIcon />
            </span>
            <div>
              <h2 id="pg-chart" className="card-title card-t">
                Партограмма
              </h2>
              <div className="card-s">
                {PHASE_LABELS[analysis.phase]}
                {analysis.dilation !== null && ` · ${analysis.dilation} см`}
                {analysis.rate !== null && ` · ${formatRate(analysis.rate)}`}
              </div>
            </div>
          </div>
        </div>
        <PartogramChart analysis={analysis} waters={minutes('waters')} oxytocin={oxytocin} />
      </section>
    </>
  );
}

// ---------- Окситоцин ----------

function OxytocinCard({
  parto,
  setParto,
  suggestion,
}: {
  parto: Parto;
  setParto: (fn: (p: Parto) => Parto) => void;
  suggestion: string;
}) {
  const addRef = useRef<HTMLButtonElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const focus = useRef<'open' | 'close' | null>(null);
  useEffect(() => {
    if (focus.current === 'open') timeRef.current?.focus();
    if (focus.current === 'close') addRef.current?.focus();
    focus.current = null;
  }, [parto.oxyOpen]);

  const set = (patch: Partial<FieldValue>) => setParto((p) => ({ ...p, oxytocin: { ...p.oxytocin, ...patch } }));

  return (
    <section className="card" aria-labelledby="pg-oxy">
      <div className="card-h split">
        <div className="card-h-main">
          <span className={parto.oxyOpen ? 'ico accent' : 'ico neutral'}>
            <DripIcon />
          </span>
          <div>
            <h2 id="pg-oxy" className="card-title card-t">
              Родостимуляция окситоцином
            </h2>
            {!parto.oxyOpen && <div className="card-s">Не проводится</div>}
          </div>
        </div>
        {parto.oxyOpen ? (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              focus.current = 'close';
              setParto((p) => ({ ...p, oxyOpen: false, oxytocin: { date: '', time: '' } }));
            }}
          >
            Убрать
          </button>
        ) : (
          <button
            type="button"
            className="btn-ghost"
            ref={addRef}
            onClick={() => {
              focus.current = 'open';
              setParto((p) => ({ ...p, oxyOpen: true }));
            }}
          >
            Добавить
          </button>
        )}
      </div>
      {parto.oxyOpen && (
        <div>
          <label className="sub-label" htmlFor="pg-oxy-time">
            Начало
          </label>
          <EventFields
            id="pg-oxy"
            of="начала родостимуляции"
            flush
            timeRef={timeRef}
            {...fieldHandlers(parto.oxytocin, set, suggestion)}
          />
        </div>
      )}
    </section>
  );
}

// ---------- Редактор осмотра ----------

function Chips<T extends string | number>({
  label,
  options,
  value,
  onChange,
  wide,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T | null;
  onChange: (v: T | null) => void;
  wide?: boolean;
}) {
  return (
    <div className="chips-block">
      <div className="sub-label">{label}</div>
      <div className={wide ? 'chips wide' : 'chips'} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={value === o.value ? 'chip on' : 'chip'}
            onClick={() => onChange(value === o.value ? null : o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

function RecordEditor({
  record,
  suggestion,
  onChange,
  onDone,
  onDelete,
}: {
  record: PartoRecord;
  suggestion: string;
  onChange: (patch: Partial<PartoRecord>) => void;
  onDone: () => void;
  onDelete: () => void;
}) {
  const timeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (record.time === '') timeRef.current?.focus();
    // только при открытии редактора
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const timeOk = toMinutes(record.date, record.time) !== null;

  return (
    <div className="editor" role="group" aria-label="Осмотр">
      <div>
        <div className="editor-h">
          <label className="sub-label" htmlFor={`rec-${record.id}-time`}>
            Время осмотра
          </label>
          <button type="button" className="link-btn" onClick={() => onChange(nowField())}>
            Сейчас
          </button>
        </div>
        <EventFields
          id={`rec-${record.id}`}
          of="осмотра"
          flush
          timeRef={timeRef}
          {...fieldHandlers(record, onChange, suggestion, () => timeRef.current?.blur())}
        />
      </div>
      <Chips
        label="Раскрытие, см"
        options={range(0, 10).map((v) => ({ value: v, label: String(v) }))}
        value={record.dilation}
        onChange={(dilation) => onChange({ dilation })}
      />
      <Chips
        label="Головка: пятых над лоном"
        options={range(0, 5)
          .reverse()
          .map((v) => ({ value: v, label: `${v}/5` }))}
        value={record.head}
        onChange={(head) => onChange({ head })}
      />
      <Chips
        label="Схваток за 10 минут"
        options={range(0, 7).map((v) => ({ value: v, label: v === 7 ? '7+' : String(v) }))}
        value={record.contractions}
        onChange={(contractions) => onChange({ contractions })}
      />
      <Chips
        label="Продолжительность схватки"
        wide
        options={(Object.keys(LENGTH_LABELS) as ContractionLength[]).map((v) => ({ value: v, label: LENGTH_LABELS[v] }))}
        value={record.length}
        onChange={(length) => onChange({ length })}
      />
      {!timeOk && <div className="card-s">Без даты и времени осмотр не попадёт в расчёт.</div>}
      <div className="editor-actions">
        <button type="button" className="btn-ghost" onClick={onDelete}>
          Удалить
        </button>
        <button type="button" className="btn-primary small" onClick={onDone}>
          Готово
        </button>
      </div>
    </div>
  );
}

function recordTime(r: PartoRecord): string {
  const t = toMinutes(r.date, r.time);
  return t === null ? 'Время не указано' : `${formatDayMonth(t)} ${formatClock(t)}`;
}

function recordValues(r: PartoRecord): string {
  const parts: string[] = [];
  if (r.dilation !== null) parts.push(`${r.dilation} см`);
  if (r.head !== null) parts.push(`головка ${r.head}/5`);
  if (r.contractions !== null) parts.push(`${r.contractions === 7 ? '7+' : r.contractions} сх./10 мин`);
  if (r.length) parts.push(LENGTH_LABELS[r.length]);
  return parts.join(' · ') || '—';
}

function recordSummary(r: PartoRecord): string {
  return `${recordTime(r)}, ${recordValues(r)}`;
}

// ---------- Подсказки ----------

function HintIcon({ level }: { level: Hint['level'] }) {
  return level === 'info' ? <InfoIcon /> : <AlertIcon />;
}

function HintsCard({
  analysis,
  watersKnown,
  oxytocin,
}: {
  analysis: Analysis;
  watersKnown: boolean;
  oxytocin: number | null;
}) {
  const { hints, deadlines, weakness } = analysis;
  return (
    <section className="card" aria-labelledby="pg-hints">
      <div>
        <h2 id="pg-hints" className="card-title card-t">
          Подсказки по клиническим рекомендациям
        </h2>
        <div className="card-s">
          {hints.length === 0 && analysis.phase !== 'none'
            ? 'Отклонений по введённым данным нет'
            : analysis.phase === 'none'
              ? 'Появятся после первого осмотра'
              : `Найдено: ${hints.length}`}
        </div>
      </div>

      {hints.length > 0 && (
        <ul className="hints" aria-live="polite">
          {hints.map((h, i) => (
            <li key={i} className={`hint ${h.level}`}>
              <HintIcon level={h.level} />
              <div>
                <p>{h.text}</p>
                <p className="hint-src">{h.source}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {weakness && (
        <div className="tactic">
          <div className="tactic-t">Тактика при слабости родовой деятельности</div>
          <ul>
            {!watersKnown && (
              <li>
                Плодный пузырь цел: перед родостимуляцией окситоцином — амниотомия (критерий качества КР).
              </li>
            )}
            {oxytocin === null ? (
              <li>
                Решить вопрос о родостимуляции окситоцином. После амниотомии раннее начало родостимуляции
                предпочтительнее отсроченного (через 2 ч).
              </li>
            ) : (
              <li>Родостимуляция идёт с {formatClock(oxytocin)}: титровать по характеру схваток.</li>
            )}
            <li>
              Предпочтительны низкие дозы: 5 МЕ (1 мл) в 50 мл 0,9 % NaCl через инфузомат, старт 1,8 мл/ч
              (3 мЕД/мин); или 5 МЕ в 400 мл — с 6 кап/мин.
            </li>
            <li>
              Увеличивать скорость каждые 20–30 мин на 1 шаг до 4–5 схваток за 10 минут, затем зафиксировать
              минимально эффективную дозу.
            </li>
            <li>33 мЕД/мин (19,8 мл/ч) — предельно опасный уровень.</li>
          </ul>
          <p className="hint-src">{SRC_ARD}, п. 3.1</p>
        </div>
      )}

      {deadlines.length > 0 && (
        <div>
          <div className="sub-label">Контрольные сроки</div>
          {deadlines.map((d) => (
            <div className="kv" key={d.label}>
              <span className="k">{d.label}</span>
              <span className="v">
                {formatDayMonth(d.at)} {formatClock(d.at)}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="disclaimer">
        Подсказки построены по тексту {SRC_ARD} (2024) и {SRC_NORMAL} (2024) Минздрава России. Это справка: решение
        принимает врач с учётом клинической картины.
      </p>
    </section>
  );
}
