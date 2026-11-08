import { TOPIC_BY_ID } from '../content/index.ts';
import { countGaps, splitOption } from '../lib/lexicon.ts';
import { examMessage, formatDuration, pct, PASS_THRESHOLD } from '../lib/feedback.ts';
import type { Level } from '../lib/types.ts';
import type { SessionState, Summary } from '../lib/session.ts';
import { go } from '../lib/router.ts';
import { useProgress } from '../lib/store.ts';
import { Icon } from '../components/Icon.tsx';
import { LevelBadge, Meter, Ring, StatTile } from '../components/ui.tsx';
import { TappableText } from '../components/TappableText.tsx';

export function ExamResults({
  level,
  session,
  summary,
  onRestart,
}: {
  level: Level;
  session: SessionState;
  summary: Summary;
  onRestart: () => void;
}) {
  const progress = useProgress();
  const passed = summary.accuracy >= PASS_THRESHOLD;
  const msg = examMessage(level, summary.accuracy);

  const byTopic = new Map<string, { ok: number; total: number }>();
  for (const qid of session.order) {
    const tid = session.pool[qid].topicId;
    const r = byTopic.get(tid) ?? { ok: 0, total: 0 };
    r.total += 1;
    if (session.outcomes[qid].firstTry) r.ok += 1;
    byTopic.set(tid, r);
  }
  const rows = [...byTopic.entries()]
    .map(([id, r]) => ({ topic: TOPIC_BY_ID[id], ...r, share: r.ok / r.total }))
    .sort((a, b) => a.share - b.share || b.total - a.total);
  const weak = rows.filter((r) => r.share < 1);

  return (
    <div className="page results">
      <div className="results-grid">
        <section className={`card results-hero ${passed ? 'passed' : ''}`}>
          <div className="results-kicker">
            <LevelBadge level={level} /> Сертификационный тест
          </div>
          <Ring value={summary.accuracy} size={148} stroke={12}>
            <span className="ring-num">{pct(summary.accuracy)}</span>
            <span className="ring-cap">порог {pct(PASS_THRESHOLD)}</span>
          </Ring>
          <h1>{msg.title}</h1>
          <p className="results-text">{msg.text}</p>
          <div className="stat-row">
            <StatTile label="Верных ответов" value={`${summary.firstTry} / ${summary.total}`} />
            <StatTile label="Время" value={formatDuration(summary.durationMs)} />
          </div>
          {passed && !progress.settings.name && (
            <p className="muted small">Имя для сертификата можно указать в разделе «Сертификаты».</p>
          )}
          <div className="results-actions">
            {passed ? (
              <button type="button" className="btn primary" onClick={() => go({ name: 'certs' })}>
                <Icon name="award" size={18} /> Открыть сертификат
              </button>
            ) : (
              weak[0] && (
                <button type="button" className="btn primary" onClick={() => go({ name: 'topic', id: weak[0].topic.id })}>
                  Начать с темы «{weak[0].topic.title}»
                </button>
              )
            )}
            <button type="button" className="btn ghost" onClick={onRestart}>
              <Icon name="refresh" size={18} /> Новая попытка
            </button>
            <button type="button" className="btn ghost" onClick={() => go({ name: 'home' })}>
              На главную
            </button>
          </div>
        </section>

        <section className="card results-review">
          <h2>Результат по темам</h2>
          <ul className="topic-breakdown">
            {rows.map((r) => (
              <li key={r.topic.id}>
                <a href={`#/topic/${r.topic.id}`} className="tb-title">
                  <LevelBadge level={r.topic.level} size="sm" /> {r.topic.title}
                </a>
                <span className="tb-score">
                  {r.ok}/{r.total}
                </span>
                <Meter value={r.share} tone={r.topic.level} size="sm" label={`${r.topic.title}: ${r.ok} из ${r.total}`} />
              </li>
            ))}
          </ul>

          {summary.mistakes.length > 0 && (
            <>
              <h2>Разбор ошибок</h2>
              <ol className="review-list">
                {summary.mistakes.map((qid) => {
                  const { question: q, topicId } = session.pool[qid];
                  const t = TOPIC_BY_ID[topicId];
                  const gaps = countGaps(q.q);
                  const chosen = session.outcomes[qid].chosen[0];
                  return (
                    <li key={qid} className="review-item">
                      <div className="muted small">{t.title}</div>
                      {q.q.trim() && (
                        <div className="review-q" lang="en">
                          <TappableText text={q.q} glossary={t.glossary} fill={gaps ? splitOption(q.correct, gaps) : null} />
                        </div>
                      )}
                      {(!gaps || !q.q.trim()) && (
                        <div className="review-answer">
                          <Icon name="check" size={16} /> <span lang="en">{q.correct}</span>
                        </div>
                      )}
                      <div className="review-wrong">
                        <Icon name="x" size={16} /> <span lang="en">{chosen}</span>
                      </div>
                      <p className="review-explain">{q.explain}</p>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
