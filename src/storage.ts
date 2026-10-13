import { ALL_EVENTS, emptyFields, type FieldValue, type Fields } from './calc';
import { findAntibiotic } from './antibiotics';
import { LENGTH_LABELS, type ContractionLength, type Parity, type PartoRecord } from './partogram';

const KEY = 'rody-calculator';
const SCHEMA = 2;

export type Tab = 'periods' | 'partogram' | 'antibiotics';
export const TABS: readonly Tab[] = ['periods', 'partogram', 'antibiotics'];

export interface Saved {
  tab: Tab;
  fields: Fields;
  opOpen: boolean;
  abx: { drug: string | null; start: FieldValue };
  parto: {
    parity: Parity | null;
    epidural: boolean;
    oxyOpen: boolean;
    oxytocin: FieldValue;
    records: PartoRecord[];
  };
}

const blankField = (): FieldValue => ({ date: '', time: '' });

export function emptyState(tab: Tab = 'periods'): Saved {
  return {
    tab,
    fields: emptyFields(),
    opOpen: false,
    abx: { drug: null, start: blankField() },
    parto: { parity: null, epidural: false, oxyOpen: false, oxytocin: blankField(), records: [] },
  };
}

const isStr = (x: unknown): x is string => typeof x === 'string';
const field = (x: any): FieldValue => (x && isStr(x.date) && isStr(x.time) ? { date: x.date, time: x.time } : blankField());
const numOrNull = (x: unknown, min: number, max: number) =>
  typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max ? x : null;

function record(x: any): PartoRecord | null {
  if (!x || !isStr(x.id)) return null;
  const f = field(x);
  return {
    id: x.id,
    date: f.date,
    time: f.time,
    dilation: numOrNull(x.dilation, 0, 10),
    head: numOrNull(x.head, 0, 5),
    contractions: numOrNull(x.contractions, 0, 10),
    length: isStr(x.length) && x.length in LENGTH_LABELS ? (x.length as ContractionLength) : null,
  };
}

/** Читает сохранённое состояние. Без хранилища или при битых данных — пустое. Схема v1 переносится. */
export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const data = JSON.parse(raw);
    if (!data || (data.v !== 1 && data.v !== SCHEMA) || typeof data.fields !== 'object') return emptyState();

    const state = emptyState();
    for (const k of ALL_EVENTS) state.fields[k] = field(data.fields[k]);
    state.opOpen = data.opOpen === true;
    if (data.v === 1) return state;

    if ((TABS as readonly string[]).includes(data.tab)) state.tab = data.tab;
    const abx = data.abx ?? {};
    state.abx = { drug: findAntibiotic(abx.drug)?.id ?? null, start: field(abx.start) };
    const p = data.parto ?? {};
    state.parto = {
      parity: p.parity === 'first' || p.parity === 'repeat' ? p.parity : null,
      epidural: p.epidural === true,
      oxyOpen: p.oxyOpen === true,
      oxytocin: field(p.oxytocin),
      records: Array.isArray(p.records) ? p.records.map(record).filter((r: PartoRecord | null) => r !== null) : [],
    };
    return state;
  } catch {
    return emptyState();
  }
}

export function save(state: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: SCHEMA, ...state }));
  } catch {
    // Хранилище недоступно (приватный режим и т. п.) — работаем без него.
  }
}
