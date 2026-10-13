import type { Dispatch, SetStateAction } from 'react';
import {
  ANTIBIOTICS,
  courseEnds,
  courseLabel,
  doseTime,
  doses,
  dosesByDay,
  findAntibiotic,
} from '../antibiotics';
import { formatDateTime, parseDate, toMinutes, todayString, weekdayShort, type FieldValue } from '../calc';
import { EventFields } from '../components/EventFields';
import { fieldHandlers } from '../components/fieldHandlers';
import { PillIcon } from '../components/Icons';
import type { Saved } from '../storage';

interface Props {
  state: Saved;
  setState: Dispatch<SetStateAction<Saved>>;
}

export function AntibioticsScreen({ state, setState }: Props) {
  const { abx, fields, opOpen } = state;
  const drug = findAntibiotic(abx.drug);
  const start = toMinutes(abx.start.date, abx.start.time);

  // Антибиотик часто начинают после операции или родов — дату берём оттуда.
  const suggestion =
    [opOpen ? fields.opEnd.date : '', fields.fetus.date, fields.contractions.date].find((d) => parseDate(d)) ??
    todayString();

  const setStart = (patch: Partial<FieldValue>) =>
    setState((s) => ({ ...s, abx: { ...s.abx, start: { ...s.abx.start, ...patch } } }));

  const ends = drug && start !== null ? courseEnds(start, drug) : [];
  const maxHours = drug ? Math.max(...drug.courseHours) : 0;
  const schedule = drug && start !== null ? dosesByDay(doses(start, drug.intervalHours, maxHours)) : [];
  // Номер последнего введения каждого курса — для пометок в графике.
  const endMarks = new Map(ends.map((e) => [e.last.n, e.hours]));

  return (
    <>
      <section className="card" aria-labelledby="abx-title">
        <div className="card-h">
          <span className="ico accent">
            <PillIcon />
          </span>
          <div>
            <h2 id="abx-title" className="card-title card-t">
              Антибиотик
            </h2>
            <div className="card-s">Выберите препарат</div>
          </div>
        </div>
        <div className="options" role="radiogroup" aria-labelledby="abx-title">
          {ANTIBIOTICS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={abx.drug === a.id}
              className={abx.drug === a.id ? 'option on' : 'option'}
              onClick={() => setState((s) => ({ ...s, abx: { ...s.abx, drug: a.id } }))}
            >
              <span className="option-t">{a.name}</span>
              <span className="option-s">
                {a.dose} · каждые {a.intervalHours} ч
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="abx-start-title">
        <label id="abx-start-title" className="card-t" htmlFor="abx-start-time">
          Первое введение
        </label>
        <EventFields id="abx-start" of="первого введения" flush {...fieldHandlers(abx.start, setStart, suggestion)} />
      </section>

      <section className="card" aria-labelledby="abx-course-title">
        <div>
          <h2 id="abx-course-title" className="card-title card-t">
            Последнее введение
          </h2>
          <div className="card-s">
            {!drug
              ? 'Сначала выберите препарат'
              : start === null
                ? 'Появится после ввода первого введения'
                : `${drug.name} ${drug.dose}, каждые ${drug.intervalHours} ч`}
          </div>
        </div>
        {(drug?.courseHours ?? [48, 72]).map((hours) => {
          const end = ends.find((e) => e.hours === hours);
          return (
            <div className="kv" key={hours}>
              <span className="k">
                {courseLabel(hours)}
                {end && <span className="k-sub">{end.count}-е введение</span>}
              </span>
              {end ? (
                <span className="v">
                  {formatDateTime(end.last.at)}, {weekdayShort(end.last.at)}
                </span>
              ) : (
                <span className="v none">—</span>
              )}
            </div>
          );
        })}
      </section>

      {schedule.length > 0 && (
        <section className="card" aria-labelledby="abx-plan-title">
          <h2 id="abx-plan-title" className="card-title card-t">
            График введений
          </h2>
          <div className="plan">
            {schedule.map((day) => (
              <div className="plan-day" key={day.day}>
                <div className="plan-date">
                  {day.day}, {day.weekday}
                </div>
                <ol className="plan-doses">
                  {day.doses.map((d) => {
                    const end = endMarks.get(d.n);
                    return (
                      <li key={d.n} className={end ? 'dose end' : 'dose'}>
                        <span className="dose-n">{d.n}</span>
                        <span className="dose-t">{doseTime(d)}</span>
                        {end && <span className="dose-tag">конец {courseLabel(end).split(' (')[0]}</span>}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
