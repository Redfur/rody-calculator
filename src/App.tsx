import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AntibioticsScreen } from './screens/AntibioticsScreen';
import { PartogramScreen } from './screens/PartogramScreen';
import { PeriodsScreen } from './screens/PeriodsScreen';
import { TABS, emptyState, load, save, type Saved, type Tab } from './storage';
import { useServiceWorkerUpdate } from './useServiceWorkerUpdate';

const TAB_LABELS: Record<Tab, string> = {
  periods: 'Периоды',
  partogram: 'Партограмма',
  antibiotics: 'Антибиотики',
};

export default function App() {
  const [state, setState] = useState<Saved>(load);
  const updateReady = useServiceWorkerUpdate();

  useEffect(() => save(state), [state]);

  // ---------- Очистка в два нажатия: стирает все вкладки, роды начинаются заново ----------
  const [clearArmed, setClearArmed] = useState(false);
  const clearTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(clearTimer.current), []);
  const onClear = () => {
    window.clearTimeout(clearTimer.current);
    if (clearArmed) {
      setState((s) => emptyState(s.tab));
      setClearArmed(false);
    } else {
      setClearArmed(true);
      clearTimer.current = window.setTimeout(() => setClearArmed(false), 3000);
    }
  };

  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const selectTab = (tab: Tab, focus = false) => {
    setState((s) => ({ ...s, tab }));
    if (focus) tabRefs.current[tab]?.focus();
    window.scrollTo({ top: 0 });
  };
  const onTabKey = (e: KeyboardEvent) => {
    const i = TABS.indexOf(state.tab);
    if (e.key === 'ArrowRight') selectTab(TABS[(i + 1) % TABS.length], true);
    if (e.key === 'ArrowLeft') selectTab(TABS[(i + TABS.length - 1) % TABS.length], true);
  };

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

      <div className="tabs" role="tablist" aria-label="Разделы" onKeyDown={onTabKey}>
        {TABS.map((tab) => (
          <button
            key={tab}
            ref={(el) => {
              tabRefs.current[tab] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${tab}`}
            aria-selected={state.tab === tab}
            aria-controls={`panel-${tab}`}
            tabIndex={state.tab === tab ? 0 : -1}
            className={state.tab === tab ? 'tab on' : 'tab'}
            onClick={() => selectTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="panel" role="tabpanel" id={`panel-${state.tab}`} aria-labelledby={`tab-${state.tab}`}>
        {state.tab === 'periods' && <PeriodsScreen state={state} setState={setState} />}
        {state.tab === 'partogram' && <PartogramScreen state={state} setState={setState} />}
        {state.tab === 'antibiotics' && <AntibioticsScreen state={state} setState={setState} />}
      </div>

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
