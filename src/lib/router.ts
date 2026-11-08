import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'topic'; id: string }
  | { name: 'play'; mode: 'topic'; id: string }
  | { name: 'play'; mode: 'recap' | 'review' | 'blitz' }
  | { name: 'play'; mode: 'exam'; level: string }
  | { name: 'cards'; id: string } // topic id or "due"
  | { name: 'certs' }
  | { name: 'stats' };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [a, b, c] = parts;
  switch (a) {
    case 'topic':
      return b ? { name: 'topic', id: b } : { name: 'home' };
    case 'play':
      if (b === 'topic' && c) return { name: 'play', mode: 'topic', id: c };
      if (b === 'exam' && c) return { name: 'play', mode: 'exam', level: c };
      if (b === 'recap' || b === 'review' || b === 'blitz') return { name: 'play', mode: b };
      return { name: 'home' };
    case 'cards':
      return b ? { name: 'cards', id: b } : { name: 'home' };
    case 'certs':
      return { name: 'certs' };
    case 'stats':
      return { name: 'stats' };
    default:
      return { name: 'home' };
  }
}

export function href(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/';
    case 'topic':
      return `#/topic/${r.id}`;
    case 'play':
      if (r.mode === 'topic') return `#/play/topic/${r.id}`;
      if (r.mode === 'exam') return `#/play/exam/${r.level}`;
      return `#/play/${r.mode}`;
    case 'cards':
      return `#/cards/${r.id}`;
    case 'certs':
      return '#/certs';
    case 'stats':
      return '#/stats';
  }
}

export function go(r: Route) {
  const h = href(r);
  if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = h;
}

/** Returns the current route and a counter that changes on every navigation (used as a remount key). */
export function useRoute(): [Route, number] {
  const [state, setState] = useState<[Route, number]>(() => [parse(location.hash), 0]);
  useEffect(() => {
    const on = () => {
      setState(([, n]) => [parse(location.hash), n + 1]);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return state;
}
