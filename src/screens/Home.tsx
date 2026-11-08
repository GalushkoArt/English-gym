import { useState } from 'react';
import { LEVEL_INFO, TOPICS, topicsOf } from '../content/index.ts';
import { LEVELS, type Level, type Topic } from '../lib/types.ts';
import {
  completedIds,
  dueReview,
  isCardDue,
  masteryOf,
  MASTERY_LABEL,
  needsRefresh,
  useProgress,
  type ProgressState,
} from '../lib/store.ts';
import { RECAP_MIN_TOPICS } from '../lib/builders.ts';
import { getQuestion } from '../content/index.ts';
import { pct, plural } from '../lib/feedback.ts';
import { go } from '../lib/router.ts';
import { Icon, type IconName } from '../components/Icon.tsx';
import { LevelBadge, Meter } from '../components/ui.tsx';

const TAB_KEY = 'english-gym:level-tab';

export function dueCardCount(s: ProgressState): number {
  let n = 0;
  for (const t of TOPICS) {
    if (!s.topics[t.id]) continue;
    t.cards.forEach((_, i) => {
      if (isCardDue(s, `${t.id}#${i}`)) n++;
    });
  }
  return n;
}

function recommend(s: ProgressState): { topic: Topic; reason: 'continue' | 'next' | 'refresh' } | null {
  const started = TOPICS.find((t) => s.topics[t.id] && !s.topics[t.id].completedAt);
  if (started) return { topic: started, reason: 'continue' };
  // a completed topic that is due for spacing beats a new one: retention first
  const refresh = TOPICS.find((t) => needsRefresh(s.topics[t.id]));
  if (refresh) return { topic: refresh, reason: 'refresh' };
  const next = TOPICS.find((t) => !s.topics[t.id]?.completedAt);
  if (next) return { topic: next, reason: 'next' };
  return null;
}

export function Home() {
  const s = useProgress();
  const [tab, setTab] = useState<Level>(() => {
    try {
      const v = sessionStorage.getItem(TAB_KEY);
      if (v === 'B1' || v === 'B2' || v === 'C1') return v;
    } catch {
      /* ignore */
    }
    return 'B1';
  });
  const pickTab = (l: Level) => {
    setTab(l);
    try {
      sessionStorage.setItem(TAB_KEY, l);
    } catch {
      /* ignore */
    }
  };

  const completed = completedIds(s).length;
  const due = dueReview(s).filter((id) => getQuestion(id) && !getQuestion(id)!.exam).length;
  const cardsDue = dueCardCount(s);
  const rec = recommend(s);
  const isNew = Object.keys(s.topics).length === 0;

  return (
    <div className="page home">
      <div className="home-grid">
        <aside className="home-side">
          {rec && (
            <section className={`card continue level-edge-${rec.topic.level}`}>
              <div className="continue-kicker">
                {isNew ? 'С чего начать' : rec.reason === 'continue' ? 'Продолжить' : rec.reason === 'refresh' ? 'Пора освежить' : 'Следующая тема'}
              </div>
              <div className="continue-title">
                <LevelBadge level={rec.topic.level} size="sm" />
                <h2>{rec.topic.title}</h2>
              </div>
              <p className="muted">{rec.topic.titleRu}. {rec.topic.summary}.</p>
              <div className="continue-actions">
                <button type="button" className="btn primary" onClick={() => go({ name: 'topic', id: rec.topic.id })}>
                  {isNew ? 'Открыть первую тему' : 'Открыть тему'} <Icon name="arrowRight" size={18} />
                </button>
              </div>
            </section>
          )}

          <section className="card modes">
            <h2 className="card-title">Тренировки</h2>
            <ModeRow
              icon="target"
              title="Работа над ошибками"
              text={due ? `${due} ${plural(due, ['вопрос ждёт', 'вопроса ждут', 'вопросов ждут'])} повторения` : 'Ошибки возвращаются сюда по интервалам'}
              badge={due || undefined}
              disabled={!due}
              onClick={() => go({ name: 'play', mode: 'review' })}
            />
            <ModeRow
              icon="layers"
              title="Повторение"
              text={
                completed >= RECAP_MIN_TOPICS
                  ? `Случайные вопросы из ${completed} ${plural(completed, ['пройденной темы', 'пройденных тем', 'пройденных тем'])}`
                  : `Откроется после ${RECAP_MIN_TOPICS} пройденных тем`
              }
              locked={completed < RECAP_MIN_TOPICS}
              lockProgress={completed / RECAP_MIN_TOPICS}
              lockLabel={`${completed} / ${RECAP_MIN_TOPICS}`}
              onClick={() => go({ name: 'play', mode: 'recap' })}
            />
            <ModeRow
              icon="cards"
              title="Флеш-карты правил"
              text={cardsDue ? `${cardsDue} ${plural(cardsDue, ['карта', 'карты', 'карт'])} к повторению` : 'Карты открываются по мере изучения тем'}
              badge={cardsDue || undefined}
              disabled={!cardsDue}
              onClick={() => go({ name: 'cards', id: 'due' })}
            />
            <ModeRow
              icon="bolt"
              title="Блиц · 60 секунд"
              text={completed ? `Два варианта, максимум ответов за минуту${s.blitzBest ? ` · рекорд ${s.blitzBest}` : ''}` : 'Пройдите хотя бы одну тему'}
              disabled={!completed}
              onClick={() => go({ name: 'play', mode: 'blitz' })}
            />
            <ModeRow
              icon="award"
              title="Сертификация B1 · B2 · C1"
              text="30 вопросов без подсказок, порог 80%"
              onClick={() => go({ name: 'certs' })}
            />
          </section>

          <section className="card level-progress">
            <h2 className="card-title">Прогресс по уровням</h2>
            {LEVELS.map((l) => {
              const ts = topicsOf(l);
              const done = ts.filter((t) => s.topics[t.id]?.completedAt).length;
              return (
                <div key={l} className="lp-row">
                  <div className="lp-head">
                    <LevelBadge level={l} size="sm" />
                    <span className="lp-name">{LEVEL_INFO[l].name}</span>
                    <span className="lp-count">
                      {done} / {ts.length}
                    </span>
                  </div>
                  <Meter value={ts.length ? done / ts.length : 0} tone={l} label={`${l}: пройдено ${done} из ${ts.length}`} />
                </div>
              );
            })}
          </section>
        </aside>

        <section className="home-topics" aria-label="Темы">
          <div className="level-tabs" role="tablist" aria-label="Уровень">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={tab === l}
                className={`level-tab${tab === l ? ' active' : ''}`}
                onClick={() => pickTab(l)}
              >
                <LevelBadge level={l} size="sm" />
                <span className="lt-name">{LEVEL_INFO[l].name}</span>
              </button>
            ))}
          </div>
          <div className="levels" data-active={tab}>
            {LEVELS.map((l) => (
              <div key={l} className={`level-col${tab === l ? ' active' : ''}`} data-level={l}>
                <header className="level-head">
                  <LevelBadge level={l} />
                  <div>
                    <h2>{LEVEL_INFO[l].name}</h2>
                    <p className="muted small">{LEVEL_INFO[l].blurb}</p>
                  </div>
                </header>
                <ol className="topic-list">
                  {topicsOf(l).map((t, i) => (
                    <TopicCard key={t.id} topic={t} index={i + 1} s={s} />
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ModeRow({
  icon,
  title,
  text,
  badge,
  disabled,
  locked,
  lockProgress,
  lockLabel,
  onClick,
}: {
  icon: IconName;
  title: string;
  text: string;
  badge?: number;
  disabled?: boolean;
  locked?: boolean;
  lockProgress?: number;
  lockLabel?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`mode-row${locked ? ' locked' : ''}`} onClick={onClick} disabled={disabled || locked}>
      <span className="mode-icon">
        <Icon name={locked ? 'lock' : icon} />
      </span>
      <span className="mode-body">
        <span className="mode-title">
          {title}
          {badge ? <span className="count-badge">{badge}</span> : null}
        </span>
        <span className="mode-text">{text}</span>
        {locked && lockProgress !== undefined && (
          <span className="mode-lock">
            <Meter value={lockProgress} size="sm" label={`Открыто ${lockLabel}`} />
            <span className="small muted">{lockLabel}</span>
          </span>
        )}
      </span>
      {!locked && !disabled && <Icon name="arrowRight" size={18} className="mode-arrow" />}
    </button>
  );
}

function TopicCard({ topic, index, s }: { topic: Topic; index: number; s: ProgressState }) {
  const p = s.topics[topic.id];
  const m = masteryOf(p);
  const refresh = needsRefresh(p);
  return (
    <li>
      <a href={`#/topic/${topic.id}`} className={`topic-card m-${m}`}>
        <span className="tc-num" aria-hidden="true">
          {index}
        </span>
        <span className="tc-body">
          <span className="tc-title">{topic.title}</span>
          <span className="tc-ru">{topic.titleRu}</span>
          <span className={`tc-foot${m === 'new' && !refresh ? ' empty' : ''}`}>
            {m !== 'new' && <span className={`tc-status s-${m}`}>{MASTERY_LABEL[m]}</span>}
            {p?.completedAt ? <span className="tc-best">лучший {pct(p.best)}</span> : null}
            {refresh && <span className="chip warn xs">освежить</span>}
          </span>
          {p?.completedAt ? <Meter value={p.best} tone={topic.level} size="sm" label={`Лучший результат ${pct(p.best)}`} /> : null}
        </span>
      </a>
    </li>
  );
}
