import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TOPIC_BY_ID } from '../content/index.ts';
import { countGaps, splitOption } from '../lib/lexicon.ts';
import type { Level, Question } from '../lib/types.ts';
import {
  answer as answerFn,
  clearedCount,
  createSession,
  current,
  isFinished,
  next as nextFn,
  pendingRepeats,
  summarize,
  takeHint,
  type Mode,
  type SessionState,
} from '../lib/session.ts';
import {
  getState,
  recordReviewCorrect,
  recordTopicSession,
  recordWrong,
  touchActivity,
  update,
  useProgress,
} from '../lib/store.ts';
import { buildExam, buildRecap, buildReview, buildTopic, type Built } from '../lib/builders.ts';
import { PASS_THRESHOLD } from '../lib/feedback.ts';
import { go } from '../lib/router.ts';
import { TappableText } from '../components/TappableText.tsx';
import { Icon } from '../components/Icon.tsx';
import { Confirm, Drawer, Meter } from '../components/ui.tsx';
import { CheatSheet, RuleReference } from '../components/RulesView.tsx';
import { SessionResults } from './Results.tsx';
import { ExamResults } from './ExamResults.tsx';

type PlayMode = Exclude<Mode, 'blitz'>;

const DEFAULT_TASK: Record<Question['type'], string> = {
  gap: 'Выберите вариант для пропуска',
  pick: 'Выберите грамматически верное предложение',
  same: 'Выберите вариант с тем же смыслом',
};

function build(mode: PlayMode, arg?: string): Built {
  const s = getState();
  switch (mode) {
    case 'topic':
      return buildTopic(arg ?? '');
    case 'recap':
      return buildRecap(s);
    case 'review':
      return buildReview(s);
    case 'exam':
      return buildExam(arg ?? '');
  }
}

export function Play({ mode, arg }: { mode: PlayMode; arg?: string }) {
  const [built] = useState(() => build(mode, arg));
  const [session, setSession] = useState<SessionState>(() =>
    createSession(built.items, { mode, repeatWrong: mode !== 'exam' }),
  );
  const [drawer, setDrawer] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [prevBest] = useState(() => (mode === 'topic' && arg ? getState().topics[arg]?.best ?? null : null));
  const progress = useProgress();
  const recorded = useRef(false);
  const advanceTimer = useRef<number | null>(null);
  const isExam = mode === 'exam';

  const finished = isFinished(session) && session.order.length > 0;
  const item = current(session);
  const sq = item ? session.pool[item.qid] : null;
  const q = sq?.question ?? null;
  const topic = sq ? TOPIC_BY_ID[sq.topicId] : null;
  const outcome = item ? session.outcomes[item.qid] : null;

  // ---- record results once ----
  useEffect(() => {
    if (!finished || recorded.current) return;
    recorded.current = true;
    const sum = summarize(session);
    update((d) => {
      touchActivity(d);
      d.totals.sessions += 1;
      d.totals.minutes += Math.round(sum.durationMs / 60000);
      if (mode === 'topic' && arg) recordTopicSession(d, arg, sum.accuracy);
      if (mode === 'exam' && arg) {
        const level = arg as Level;
        const passed = sum.accuracy >= PASS_THRESHOLD;
        d.attempts.push({ level, score: sum.accuracy, date: Date.now(), passed });
        const prev = d.certs[level];
        if (passed && (!prev || prev.score < sum.accuracy)) {
          d.certs[level] = {
            level,
            score: sum.accuracy,
            correct: sum.firstTry,
            total: sum.total,
            date: Date.now(),
            name: d.settings.name,
            id: `EG-${level}-${Date.now().toString(36).toUpperCase()}`,
          };
        }
      }
    });
  }, [finished, session, mode, arg]);

  useEffect(() => () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
  }, []);

  const choose = useCallback(
    (opt: string) => {
      if (!item || !q || session.answer) return;
      const first = session.outcomes[item.qid].attempts === 0;
      const correct = opt === q.correct;
      setSession((s) => answerFn(s, opt));
      if (first) {
        update((d) => {
          d.totals.answered += 1;
          if (correct) d.totals.correct += 1;
          if (!isExam) {
            if (correct) recordReviewCorrect(d, item.qid);
            else recordWrong(d, item.qid);
          }
        });
      }
      if (isExam) {
        advanceTimer.current = window.setTimeout(() => setSession((s) => nextFn(s)), 380);
      }
    },
    [item, q, session.answer, session.outcomes, isExam],
  );

  const goNext = useCallback(() => setSession((s) => nextFn(s)), []);
  const hint = useCallback(() => setSession((s) => takeHint(s)), []);

  // ---- keyboard ----
  useEffect(() => {
    if (finished) return;
    const onKey = (e: KeyboardEvent) => {
      if (drawer || confirmExit) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (!item) return;
      if (!session.answer) {
        const n = Number(e.key);
        if (n >= 1 && n <= item.options.length) {
          e.preventDefault();
          choose(item.options[n - 1]);
        } else if ((e.key === 'h' || e.key === 'р') && !isExam) {
          e.preventDefault();
          hint();
        }
      } else if (!isExam && (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === ' ')) {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finished, item, session.answer, choose, hint, goNext, drawer, confirmExit, isExam]);

  // move focus to "next" after answering so Enter works for keyboard and screen readers
  const nextBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (session.answer && !isExam) nextBtn.current?.focus({ preventScroll: true });
  }, [session.answer, isExam]);

  const exit = () => {
    const answered = Object.values(session.outcomes).some((o) => o.attempts > 0);
    if (answered && !finished) setConfirmExit(true);
    else leave();
  };
  const leave = () => {
    if (mode === 'topic' && arg) go({ name: 'topic', id: arg });
    else if (mode === 'exam') go({ name: 'certs' });
    else go({ name: 'home' });
  };
  const restart = () => {
    if (mode === 'topic' && arg) go({ name: 'play', mode: 'topic', id: arg });
    else if (mode === 'exam' && arg) go({ name: 'play', mode: 'exam', level: arg });
    else if (mode === 'recap' || mode === 'review') go({ name: 'play', mode });
  };

  const optionLayout = useMemo(() => {
    if (!item || !q) return 'stack';
    const short = item.options.every((o) => o.length <= 26) && q.type === 'gap';
    return short ? `grid n${item.options.length}` : 'stack';
  }, [item, q]);

  if (built.empty || built.items.length === 0) {
    return (
      <div className="page narrow">
        <div className="empty-state card">
          <Icon name={mode === 'recap' ? 'lock' : 'check'} size={28} />
          <h1>{built.title}</h1>
          <p className="muted">{built.empty}</p>
          <button type="button" className="btn primary" onClick={() => go({ name: 'home' })}>
            На главную
          </button>
        </div>
      </div>
    );
  }

  if (finished) {
    const sum = summarize(session);
    return isExam ? (
      <ExamResults level={arg as Level} session={session} summary={sum} onRestart={restart} />
    ) : (
      <SessionResults mode={mode} built={built} session={session} summary={sum} topicId={arg} prevBest={prevBest} onRestart={restart} />
    );
  }

  if (!item || !q || !topic || !outcome) return null;

  const gaps = countGaps(q.q);
  const fill = session.answer && !isExam && gaps ? splitOption(q.correct, gaps) : null;
  const cleared = clearedCount(session);
  const total = session.order.length;
  const repeats = pendingRepeats(session);
  const isRepeat = item.attempt > 0;
  const answeredCount = Object.values(session.outcomes).filter((o) => o.attempts > 0).length;
  const qNumber = isExam ? Math.min(answeredCount + (session.answer ? 0 : 1), total) : null;
  const ans = session.answer;
  const showTranslation = progress.settings.showTranslation;

  return (
    <div className={`play mode-${mode}`}>
      <header className="play-top">
        <button type="button" className="icon-btn" onClick={exit} aria-label="Выйти из тренировки">
          <Icon name="close" />
        </button>
        <div className="play-progress">
          <Meter value={isExam ? answeredCount / total : cleared / total} label="Прогресс сессии" size="lg" tone={isExam ? 'accent' : 'success'} />
        </div>
        <div className="play-count" aria-live="polite">
          {isExam ? (
            <>
              {qNumber}
              <span className="muted"> / {total}</span>
            </>
          ) : (
            <>
              {cleared}
              <span className="muted"> / {total}</span>
            </>
          )}
        </div>
      </header>

      <div className="play-grid">
        <aside className="play-side play-left" aria-label="Ход сессии">
          <SessionMap session={session} isExam={isExam} />
        </aside>

        <main className="play-main">
          <div className="play-meta">
            <span className="chip">{built.title}</span>
            {mode !== 'topic' && !isExam && <span className="chip subtle">{topic.title}</span>}
            {isRepeat && !isExam && (
              <span className="chip warn">
                <Icon name="refresh" size={14} /> Повтор
              </span>
            )}
            {!isExam && session.streak >= 3 && (
              <span className="chip streak" title="Верных ответов подряд">
                Серия {session.streak}
              </span>
            )}
          </div>

          <section className={`q-card${ans ? (ans.correct || isExam ? ' is-answered' : ' is-wrong') : ''}`} key={item.key}>
            <div className="q-task">{q.task ?? DEFAULT_TASK[q.type]}</div>
            {q.q.trim() && (
              <div className={`q-text type-${q.type}`} lang="en">
                <TappableText text={q.q} glossary={topic.glossary} fill={fill} />
              </div>
            )}
            {!isExam && outcome.hint && !ans && (
              <div className="hint-box" role="note">
                <Icon name="bulb" size={18} />
                <span>{q.hint}</span>
              </div>
            )}
          </section>

          <div className={`options ${optionLayout}`} role="group" aria-label="Варианты ответа">
            {item.options.map((o, i) => {
              let state = '';
              if (ans) {
                if (isExam) state = o === ans.chosen ? 'chosen' : 'dim';
                else if (o === q.correct) state = 'correct';
                else if (o === ans.chosen) state = 'wrong';
                else state = 'dim';
              }
              return (
                <button
                  key={`${item.key}-${o}`}
                  type="button"
                  className={`option ${state}`}
                  onClick={() => choose(o)}
                  disabled={Boolean(ans)}
                  aria-pressed={ans?.chosen === o}
                  lang="en"
                >
                  <span className="opt-key" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="opt-text">{o}</span>
                  {state === 'correct' && <Icon name="check" className="opt-icon" />}
                  {state === 'wrong' && <Icon name="x" className="opt-icon" />}
                </button>
              );
            })}
          </div>

          {ans && !isExam && (
            <section className={`feedback ${ans.correct ? 'ok' : 'bad'}`} aria-live="polite">
              <div className="fb-head">
                <span className="fb-icon">
                  <Icon name={ans.correct ? 'check' : 'x'} size={18} />
                </span>
                <strong>{ans.correct ? 'Верно' : 'Неверно'}</strong>
                {!ans.correct && q.type === 'gap' && (
                  <span className="fb-correct">
                    Правильно: <b lang="en">{q.correct}</b>
                  </span>
                )}
              </div>
              {!ans.correct && !outcome.hint && (
                <p className="fb-hint">
                  <Icon name="bulb" size={16} /> {q.hint}
                </p>
              )}
              <p className="fb-explain">{q.explain}</p>
              {showTranslation && <p className="fb-tr">{q.tr}</p>}
              {!ans.correct && (
                <p className="fb-requeue">
                  <Icon name="refresh" size={14} /> Вопрос вернётся в конце — ответьте на него ещё раз.
                  <button type="button" className="link-btn" onClick={() => setDrawer(true)}>
                    Открыть правило
                  </button>
                </p>
              )}
            </section>
          )}
        </main>

        <aside className="play-side play-right" aria-label="Шпаргалка">
          {isExam ? (
            <div className="side-card">
              <h3>Как устроен тест</h3>
              <p className="muted small">
                {total} вопросов из тем уровня {arg}. Без подсказок и повторов. Порог — 80%. Разбор ошибок будет в конце.
              </p>
            </div>
          ) : (
            <div className="side-card">
              <div className="side-head">
                <h3>Шпаргалка</h3>
                <span className="muted small">{topic.title}</span>
              </div>
              <CheatSheet topic={topic} compact />
              <button type="button" className="btn ghost sm" onClick={() => setDrawer(true)}>
                <Icon name="book" size={16} /> Полное правило
              </button>
            </div>
          )}
          <div className="side-card kbd-help">
            <span>
              <kbd>1</kbd>–<kbd>{item.options.length}</kbd> выбрать
            </span>
            {!isExam && (
              <>
                <span>
                  <kbd>H</kbd> подсказка
                </span>
                <span>
                  <kbd>Enter</kbd> дальше
                </span>
              </>
            )}
          </div>
        </aside>
      </div>

      <footer className="play-actions">
        <div className="play-actions-inner">
          {!ans && !isExam && (
            <>
              <button type="button" className="btn ghost" onClick={hint} disabled={outcome.hint}>
                <Icon name="bulb" size={18} /> Подсказка
              </button>
              <button type="button" className="btn ghost rules-btn" onClick={() => setDrawer(true)}>
                <Icon name="book" size={18} /> Правило
              </button>
            </>
          )}
          {!isExam && repeats > 0 && !ans && <span className="muted small repeats">В очереди повторов: {repeats}</span>}
          {ans && !isExam && (
            <button type="button" ref={nextBtn} className="btn primary wide" onClick={goNext}>
              {session.index + 1 >= session.queue.length ? 'Результаты' : 'Дальше'} <Icon name="arrowRight" size={18} />
            </button>
          )}
          {isExam && <span className="muted small">Выберите ответ — переход к следующему вопросу автоматический.</span>}
        </div>
      </footer>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title={topic.title}>
        <RuleReference topic={topic} />
      </Drawer>
      <Confirm
        open={confirmExit}
        title="Прервать сессию?"
        text={isExam ? 'Результат теста не будет засчитан.' : 'Ответы уже учтены в статистике, но тема не будет отмечена пройденной.'}
        confirmLabel="Выйти"
        cancelLabel="Продолжить"
        onConfirm={leave}
        onCancel={() => setConfirmExit(false)}
      />
    </div>
  );
}

function SessionMap({ session, isExam }: { session: SessionState; isExam: boolean }) {
  const cur = current(session);
  const cleared = clearedCount(session);
  const firstTry = session.order.filter((id) => session.outcomes[id].firstTry).length;
  const wrong = session.order.filter((id) => session.outcomes[id].firstTry === false).length;
  return (
    <div className="side-card">
      <h3>Сессия</h3>
      <ol className="qmap">
        {session.order.map((qid, i) => {
          const o = session.outcomes[qid];
          const correct = session.pool[qid].question.correct;
          let st = 'pending';
          if (isExam) st = o.attempts > 0 ? 'done' : 'pending';
          else if (o.chosen.includes(correct)) st = o.firstTry ? 'ok' : 'fixed';
          else if (o.attempts > 0) st = 'bad';
          const isCur = cur?.qid === qid;
          return (
            <li key={qid} className={`qdot ${st}${isCur ? ' cur' : ''}`} title={`Вопрос ${i + 1}`}>
              {i + 1}
            </li>
          );
        })}
      </ol>
      {!isExam && (
        <dl className="mini-stats">
          <div>
            <dt>Решено</dt>
            <dd>
              {cleared} / {session.order.length}
            </dd>
          </div>
          <div>
            <dt>С первой попытки</dt>
            <dd>{firstTry}</dd>
          </div>
          <div>
            <dt>С ошибкой</dt>
            <dd>{wrong}</dd>
          </div>
          <div>
            <dt>Лучшая серия</dt>
            <dd>{session.bestStreak}</dd>
          </div>
        </dl>
      )}
      {!isExam && (
        <div className="qmap-legend">
          <span>
            <i className="qdot ok" /> с первой попытки
          </span>
          <span>
            <i className="qdot fixed" /> исправлено
          </span>
          <span>
            <i className="qdot bad" /> ждёт повтора
          </span>
        </div>
      )}
    </div>
  );
}
