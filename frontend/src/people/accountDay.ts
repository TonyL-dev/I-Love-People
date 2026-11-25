import { useCallback, useSyncExternalStore } from 'react';

function dayFormatter(timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function today(timezone: string) {
  const parts = dayFormatter(timezone).formatToParts();
  return ['year', 'month', 'day']
    .map((key) => parts.find(({ type }) => type === key)?.value)
    .join('-');
}

export function useAccountDay(timezone: string) {
  const subscribe = useCallback(
    (notify: () => void) => {
      const formatter = dayFormatter(timezone);
      let timer: number | undefined;

      function schedule() {
        window.clearTimeout(timer);
        if (document.hidden) return;
        const now = Date.now();
        const day = formatter.format(now);
        let low = now;
        let high = now + 36 * 60 * 60 * 1000;
        // Search for the next calendar-day boundary in this timezone, including DST days.
        while (high - low > 1) {
          const middle = Math.floor((low + high) / 2);
          if (formatter.format(middle) === day) low = middle;
          else high = middle;
        }
        timer = window.setTimeout(check, high - now);
      }

      function check() {
        if (!document.hidden) notify();
        schedule();
      }

      schedule();
      document.addEventListener('visibilitychange', check);
      window.addEventListener('focus', check);
      return () => {
        window.clearTimeout(timer);
        document.removeEventListener('visibilitychange', check);
        window.removeEventListener('focus', check);
      };
    },
    [timezone],
  );
  return useSyncExternalStore(subscribe, () => today(timezone));
}
