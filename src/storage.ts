import { ALL_EVENTS, emptyFields, type Fields } from './calc';

const KEY = 'rody-calculator';
const SCHEMA = 1;

export interface Saved {
  fields: Fields;
  opOpen: boolean;
}

export function emptyState(): Saved {
  return { fields: emptyFields(), opOpen: false };
}

/** Читает сохранённое состояние. Без хранилища или при битых данных — пустое. */
export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const data = JSON.parse(raw);
    if (!data || data.v !== SCHEMA || typeof data.fields !== 'object') return emptyState();
    const fields = emptyFields();
    for (const k of ALL_EVENTS) {
      const f = data.fields[k];
      if (f && typeof f.date === 'string' && typeof f.time === 'string') {
        fields[k] = { date: f.date, time: f.time };
      }
    }
    return { fields, opOpen: data.opOpen === true };
  } catch {
    return emptyState();
  }
}

export function save(state: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: SCHEMA, fields: state.fields, opOpen: state.opOpen }));
  } catch {
    // Хранилище недоступно (приватный режим и т. п.) — работаем без него.
  }
}
