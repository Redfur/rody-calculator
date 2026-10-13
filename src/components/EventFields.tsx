import { useState, type ChangeEvent, type Ref } from 'react';
import { finalizeDate, maskDate, maskTime, parseDate, parseTime, type FieldValue } from '../calc';
import { ChevronLeft, ChevronRight } from './Icons';

/** Позиция курсора после `digits` цифр в отформатированной строке. */
function caretAfterDigits(s: string, digits: number): number {
  if (digits === 0) return 0;
  let seen = 0;
  for (let i = 0; i < s.length; i++) {
    if (/\d/.test(s[i]) && ++seen === digits) return i + 1;
  }
  return s.length;
}

/**
 * Применяет маску прямо к DOM-узлу и сохраняет позицию курсора: React увидит,
 * что значение в DOM уже совпадает с новым состоянием, и не сбросит курсор в конец.
 */
function applyMask(e: ChangeEvent<HTMLInputElement>, mask: (raw: string) => string) {
  const el = e.target;
  const raw = el.value;
  const caret = el.selectionStart ?? raw.length;
  const digitsBefore = raw.slice(0, caret).replace(/\D/g, '').length;
  const next = mask(raw);
  if (next !== raw) {
    el.value = next;
    const pos = caretAfterDigits(next, digitsBefore);
    try {
      el.setSelectionRange(pos, pos);
    } catch {
      // некоторые типы полей не поддерживают выделение
    }
  }
  const inserting = (e.nativeEvent as InputEvent).inputType?.startsWith('insert') ?? true;
  return { value: next, inserting, atEnd: (el.selectionStart ?? next.length) === next.length };
}

export type FieldMark = 'none' | 'bad';

interface Props {
  id: string;
  /** Родительный падеж для подписей: «начала схваток». */
  of: string;
  value: FieldValue;
  /** Дата, которая подставится при вводе времени; видна, пока поле времени в фокусе. */
  suggestion: string;
  mark: FieldMark;
  flush?: boolean;
  timeRef?: Ref<HTMLInputElement>;
  labelledBy?: string;
  onDate: (date: string) => void;
  onTime: (time: string, complete: boolean) => void;
  onShift: (days: 1 | -1) => void;
}

export function EventFields({ id, of, value, suggestion, mark, flush, timeRef, onDate, onTime, onShift }: Props) {
  const [focus, setFocus] = useState<'date' | 'time' | null>(null);

  const dateOk = parseDate(value.date) !== null;
  const timeOk = parseTime(value.time) !== null;
  // Неполные данные подсвечиваются мягко и только после ухода с поля.
  const dateIncomplete = (value.date !== '' && !dateOk) || (value.date === '' && timeOk);
  const timeIncomplete = value.time !== '' && !timeOk;
  const dateSoft = dateIncomplete && focus !== 'date';
  const timeSoft = timeIncomplete && focus !== 'time';
  const bad = mark === 'bad';

  const dateClass = ['date', bad ? 'bad' : dateSoft ? 'soft' : ''].filter(Boolean).join(' ');
  const timeClass = ['time', bad ? 'bad' : timeSoft ? 'soft' : ''].filter(Boolean).join(' ');

  return (
    <div className={flush ? 'fields flush' : 'fields'}>
      <div className={dateClass}>
        <button type="button" aria-label={`Дата ${of}: на день раньше`} onClick={() => onShift(-1)}>
          <ChevronLeft />
        </button>
        <input
          id={`${id}-date`}
          className={dateOk && !timeOk ? 'auto' : undefined}
          value={value.date}
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="next"
          placeholder={focus === 'time' && value.date === '' ? suggestion : 'дд.мм.гггг'}
          maxLength={10}
          aria-label={`Дата ${of}`}
          aria-invalid={bad || dateSoft ? true : undefined}
          onFocus={(e) => {
            setFocus('date');
            // Тап по пустой дате сразу подставляет дату: от предыдущего события или сегодняшнюю.
            if (value.date === '' && suggestion) {
              const el = e.currentTarget;
              el.value = suggestion;
              el.select();
              onDate(suggestion);
            }
          }}
          onBlur={() => {
            setFocus(null);
            const fixed = finalizeDate(value.date);
            if (fixed !== value.date) onDate(fixed);
          }}
          onChange={(e) => onDate(applyMask(e, maskDate).value)}
        />
        <button type="button" aria-label={`Дата ${of}: на день позже`} onClick={() => onShift(1)}>
          <ChevronRight />
        </button>
      </div>
      <input
        id={`${id}-time`}
        ref={timeRef}
        className={timeClass}
        value={value.time}
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="next"
        placeholder="чч:мм"
        maxLength={5}
        aria-label={`Время ${of}`}
        aria-invalid={bad || timeSoft ? true : undefined}
        onFocus={() => setFocus('time')}
        onBlur={() => setFocus(null)}
        onChange={(e) => {
          const r = applyMask(e, maskTime);
          onTime(r.value, r.inserting && r.atEnd && parseTime(r.value) !== null);
        }}
      />
    </div>
  );
}
