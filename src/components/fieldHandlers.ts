import { parseDate, shiftDate, type FieldValue } from '../calc';

/**
 * Обработчики для одиночного поля «дата + время» (антибиотик, окситоцин, осмотр).
 * Пустая дата при вводе времени и при нажатии ‹ › берётся из `suggestion`.
 */
export function fieldHandlers(
  value: FieldValue,
  set: (patch: Partial<FieldValue>) => void,
  suggestion: string,
  onComplete?: () => void,
) {
  return {
    value,
    suggestion,
    mark: 'none' as const,
    onDate: (date: string) => set({ date }),
    onTime: (time: string, complete: boolean) => {
      set(time && value.date === '' ? { time, date: suggestion } : { time });
      if (complete) onComplete?.();
    },
    onShift: (days: 1 | -1) => {
      const base = parseDate(value.date) ? value.date : suggestion;
      set({ date: shiftDate(base, days) ?? base });
    },
  };
}
