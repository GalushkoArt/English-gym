import { useEffect } from 'react';
import { useRoute, type Route } from './lib/router.ts';
import { currentStreak, update, useProgress, type Settings } from './lib/store.ts';
import { plural } from './lib/feedback.ts';
import { Icon } from './components/Icon.tsx';
import { WordPopover } from './components/TappableText.tsx';
import { Home } from './screens/Home.tsx';
import { TopicScreen } from './screens/TopicScreen.tsx';
import { Play } from './screens/Play.tsx';
import { Blitz } from './screens/Blitz.tsx';
import { Flashcards } from './screens/Flashcards.tsx';
import { Certs } from './screens/Certs.tsx';
import { Stats } from './screens/Stats.tsx';

const NEXT_THEME: Record<Settings['theme'], Settings['theme']> = { auto: 'light', light: 'dark', dark: 'auto' };
const THEME_LABEL: Record<Settings['theme'], string> = { auto: 'как в системе', light: 'светлая', dark: 'тёмная' };

function applyTheme(t: Settings['theme']) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

function screen(route: Route) {
  switch (route.name) {
    case 'home':
      return <Home />;
    case 'topic':
      return <TopicScreen id={route.id} />;
    case 'play':
      if (route.mode === 'blitz') return <Blitz />;
      if (route.mode === 'topic') return <Play mode="topic" arg={route.id} />;
      if (route.mode === 'exam') return <Play mode="exam" arg={route.level} />;
      return <Play mode={route.mode} />;
    case 'cards':
      return <Flashcards id={route.id} />;
    case 'certs':
      return <Certs />;
    case 'stats':
      return <Stats />;
  }
}

export function App() {
  const [route, nonce] = useRoute();
  const s = useProgress();
  const focusMode = route.name === 'play' || route.name === 'cards';
  const streak = currentStreak(s);

  useEffect(() => applyTheme(s.settings.theme), [s.settings.theme]);

  const cycleTheme = () =>
    update((d) => {
      d.settings.theme = NEXT_THEME[d.settings.theme];
    });

  return (
    <div className={`app${focusMode ? ' focus' : ''}`}>
      {!focusMode && (
        <header className="topbar">
          <div className="topbar-inner">
            <a href="#/" className="brand" aria-label="English Gym — на главную">
              <img src="/favicon.svg" alt="" width={28} height={28} />
              <span className="brand-name">English Gym</span>
            </a>
            <nav className="nav" aria-label="Разделы">
              <a href="#/" className={route.name === 'home' || route.name === 'topic' ? 'active' : ''}>
                <Icon name="list" size={18} />
                <span>Темы</span>
              </a>
              <a href="#/certs" className={route.name === 'certs' ? 'active' : ''}>
                <Icon name="award" size={18} />
                <span>Сертификаты</span>
              </a>
              <a href="#/stats" className={route.name === 'stats' ? 'active' : ''}>
                <Icon name="chart" size={18} />
                <span>Прогресс</span>
              </a>
            </nav>
            <div className="topbar-tools">
              {streak > 0 && (
                <span className="streak-chip" title={`${streak} ${plural(streak, ['день', 'дня', 'дней'])} подряд с занятиями`}>
                  <Icon name="flame" size={16} />
                  {streak}
                </span>
              )}
              <button
                type="button"
                className="icon-btn"
                onClick={cycleTheme}
                aria-label={`Тема оформления: ${THEME_LABEL[s.settings.theme]}. Переключить`}
                title={`Тема: ${THEME_LABEL[s.settings.theme]}`}
              >
                <Icon name={s.settings.theme === 'auto' ? 'auto' : s.settings.theme === 'light' ? 'sun' : 'moon'} />
              </button>
            </div>
          </div>
        </header>
      )}
      <div className="view" key={nonce}>
        {screen(route)}
      </div>
      <WordPopover />
    </div>
  );
}
