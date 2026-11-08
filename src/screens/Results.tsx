import { TOPICS, TOPIC_BY_ID } from '../content/index.ts';
import { countGaps, splitOption } from '../lib/lexicon.ts';
import { formatDuration, pct, plural, sessionMessage } from '../lib/feedback.ts';
import type { Built } from '../lib/builders.ts';
import type { Mode, SessionState, Summary } from '../lib/session.ts';
import { isCompleted, useProgress } from '../lib/store.ts';
import { go } from '../lib/router.ts';
import { Icon } from '../components/Icon.tsx';
import { Ring, StatTile } from '../components/ui.tsx';
import { TappableText } from '../components/TappableText.tsx';

export function SessionResults({
  mode,
  built,
  session,
  summary,
  topicId,
  prevBest,
  onRestart,
}: {
  mode: Mode;
  built: Built;
  session: SessionState;
  summary: Summary;
  topicId?: string;
  prevBest: number | null;
  onRestart: () => void;
}) {
  const progress = useProgress();
  const msg = sessionMessage(mode, summary);
  const topic = topicId ? TOPIC_BY_ID[topicId] : null;
  const nextTopic =
    topic &&
    TOPICS.slice(TOPICS.indexOf(topic) + 1).find((t) => !isCompleted(progress, t.id)) ;
  const improved = prevBest !== null && summary.accuracy > prevBest;

  return (
    <div className="page results">
      <div className="results-grid">
        <section className="card results-hero">
          <div className="results-kicker">{built.title}</div>
          <Ring value={summary.accuracy} size={148} stroke={12}>
            <span className="ring-num">{pct(summary.accuracy)}</span>
            <span className="ring-cap">с первой попытки</span>
          </Ring>
          <h1>{msg.title}</h1>
          <p className="results-text">{msg.text}</p>
          {mode === 'topic' && prevBest !== null && (
            <p className="muted small">
              {improved ? `Лучший результат по теме обновлён: было ${pct(prevBest)}.` : `Лучший результат по теме: ${pct(Math.max(prevBest, summary.accuracy))}.`}
            </p>
          )}
          <div className="stat-row">
            <StatTile label="С первой попытки" value={`${summary.firstTry} / ${summary.total}`} />
            <StatTile label="Исправлено после ошибки" value={summary.mistakes.length} />
            <StatTile label="Подсказок" value={summary.hints} />
            <StatTile label="Время" value={formatDuration(summary.durationMs)} />
          </div>
          <div className="results-actions">
            {nextTopic && (
              <button type="button" className="btn primary" onClick={() => go({ name: 'topic', id: nextTopic.id })}>
                Следующая тема <Icon name="arrowRight" size={18} />
              </button>
            )}
            <button type="button" className={`btn ${nextTopic ? 'ghost' : 'primary'}`} onClick={onRestart}>
              <Icon name="refresh" size={18} /> Ещё раз
            </button>
            {topic && (
              <button type="button" className="btn ghost" onClick={() => go({ name: 'cards', id: topic.id })}>
                <Icon name="cards" size={18} /> Флеш-карты
              </button>
            )}
            <button type="button" className="btn ghost" onClick={() => go({ name: 'home' })}>
              На главную
            </button>
          </div>
        </section>

        <section className="card results-review">
          <h2>
            {summary.mistakes.length
              ? `Разбор: ${summary.mistakes.length} ${plural(summary.mistakes.length, ['вопрос', 'вопроса', 'вопросов'])} с ошибкой`
              : 'Разбор'}
          </h2>
          {summary.mistakes.length === 0 ? (
            <p className="muted">Ошибок не было. Разборы всех вопросов доступны во время тренировки после ответа.</p>
          ) : (
            <ol className="review-list">
              {summary.mistakes.map((qid) => {
                const { question: q, topicId: tid } = session.pool[qid];
                const t = TOPIC_BY_ID[tid];
                const gaps = countGaps(q.q);
                const wrongChosen = [...new Set(session.outcomes[qid].chosen.filter((c) => c !== q.correct))];
                return (
                  <li key={qid} className="review-item">
                    {mode !== 'topic' && <div className="muted small">{t.title}</div>}
                    {q.q.trim() ? (
                      <div className="review-q" lang="en">
                        <TappableText text={q.q} glossary={t.glossary} fill={gaps ? splitOption(q.correct, gaps) : null} />
                      </div>
                    ) : (
                      <div className="review-q" lang="en">
                        {q.correct}
                      </div>
                    )}
                    {!gaps && q.q.trim() && (
                      <div className="review-answer">
                        <Icon name="check" size={16} /> <span lang="en">{q.correct}</span>
                      </div>
                    )}
                    {wrongChosen.length > 0 && (
                      <div className="review-wrong">
                        <Icon name="x" size={16} /> <span lang="en">{wrongChosen.join(' · ')}</span>
                      </div>
                    )}
                    <p className="review-explain">{q.explain}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
