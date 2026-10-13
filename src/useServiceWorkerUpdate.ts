import { useEffect, useState } from 'react';

/**
 * Регистрирует service worker (только в продакшен-сборке) и сообщает,
 * что активировалась новая версия приложения.
 */
export function useServiceWorkerUpdate(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    const sw = navigator.serviceWorker;
    // При первой установке контроллера ещё нет — тогда плашка не нужна.
    const hadController = sw.controller !== null;
    const onChange = () => {
      if (hadController) setReady(true);
    };
    sw.addEventListener('controllerchange', onChange);
    sw.register('./sw.js').catch(() => {
      // без service worker приложение просто работает онлайн
    });
    return () => sw.removeEventListener('controllerchange', onChange);
  }, []);

  return ready;
}
