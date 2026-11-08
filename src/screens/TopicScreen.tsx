import { TOPIC_BY_ID, TOPICS } from '../content/index.ts';
import { masteryOf, MASTERY_LABEL, needsRefresh, useProgress } from '../lib/store.ts';
import { pct } from '../lib/feedback.ts';
import { go } from '../lib/router.ts';
import { Icon } from '../components/Icon.tsx';
import { LevelBadge, Meter } from '../components/ui.tsx';
import { CheatSheet, Mistakes, RuleBlocks } from '../components/RulesView.tsx';

function daysAgo(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return 'сегодня';
  if (d === 1) return 'вчера';
  return `${d} дн. назад`;
}

export function TopicScreen({ id }: { id: string }) {
  const s = useProgress();
  const topic = TOPIC_BY_ID[id];
  if (!topic) {
    return (
      <div className="page narrow">
        <div className="card empty-state">
          <h1>Тема не найдена</h1>
          <button type="button" className="btn primary" onClick={() => go({ name: 'home' })}>
            На главную
          </button>
        </div>
      </div>
    );
  }
  const p = s.topics[topic.id];
  const m = masteryOf(p);
  const idx = TOPICS.indexOf(topic);
  const prev = TOPICS[idx - 1];
  const next = TOPICS[idx + 1];
  const start = () => go({ name: 'play', mode: 'topic', id: topic.id });

  return (
    <div className="page topic-page">
      <nav className="crumbs" aria-label="Навигация">
        <a href="#/">Темы</a>
        <span aria-hidden="true">/</span>
        <span>{topic.level}</span>
      </nav>

      <div className="topic-grid">
        <article className="topic-main">
          <header className={`topic-head level-edge-${topic.level}`}>
            <LevelBadge level={topic.level} />
            <h1>{topic.title}</h1>
            <p className="topic-ru">{topic.titleRu}</p>
            <p className="muted">{topic.summary}</p>
          </header>

          <section className="card">
            <h2 className="card-title">Шпаргалка</h2>
            <CheatSheet topic={topic} />
          </section>

          <section className="card">
            <h2 className="card-title">Правило</h2>
            <RuleBlocks topic={topic} />
            <p className="source muted small">Источник: {topic.source}</p>
          </section>

          <section className="card">
            <h2 className="card-title">Типичные ошибки русскоговорящих</h2>
            <Mistakes topic={topic} />
          </section>

          <nav className="topic-pager">
            {prev ? (
              <a href={`#/topic/${prev.id}`} className="pager-link">
                <Icon name="arrowLeft" size={16} />
                <span>
                  <span className="muted small">{prev.level}</span> {prev.title}
                </span>
              </a>
            ) : (
              <span />
            )}
            {next && (
              <a href={`#/topic/${next.id}`} className="pager-link next">
                <span>
                  <span className="muted small">{next.level}</span> {next.title}
                </span>
                <Icon name="arrowRight" size={16} />
              </a>
            )}
          </nav>
        </article>

        <aside className="topic-side">
          <div className="card sticky-card">
            <h2 className="card-title">Тренировка</h2>
            <p className="muted small">
              {topic.questions.length} вопросов. Ошибки возвращаются в конец очереди, пока не будут решены.
            </p>
            <button type="button" className="btn primary wide" onClick={start}>
              <Icon name="play" size={16} /> {p?.completedAt ? 'Пройти ещё раз' : 'Начать тренировку'}
            </button>
            <button type="button" className="btn ghost wide" onClick={() => go({ name: 'cards', id: topic.id })}>
              <Icon name="cards" size={18} /> Флеш-карты · {topic.cards.length}
            </button>
            <div className="topic-stats">
              <div className="ts-row">
                <span className="muted">Статус</span>
                <span className={`tc-status s-${m}`}>{MASTERY_LABEL[m]}</span>
              </div>
              {p?.completedAt && (
                <>
                  <div className="ts-row">
                    <span className="muted">Лучший результат</span>
                    <span>{pct(p.best)}</span>
                  </div>
                  <Meter value={p.best} tone={topic.level} size="sm" label="Лучший результат" />
                  <div className="ts-row">
                    <span className="muted">Тренировок</span>
                    <span>{p.sessions}</span>
                  </div>
                  <div className="ts-row">
                    <span className="muted">Последняя</span>
                    <span>{daysAgo(p.lastAt)}</span>
                  </div>
                  {needsRefresh(p) && <p className="small warn-text">Прошло достаточно времени — повторите тему, чтобы правило не забылось.</p>}
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      <div className="mobile-cta">
        <button type="button" className="btn primary wide" onClick={start}>
          <Icon name="play" size={16} /> {p?.completedAt ? 'Пройти ещё раз' : 'Начать тренировку'}
        </button>
      </div>
    </div>
  );
}
