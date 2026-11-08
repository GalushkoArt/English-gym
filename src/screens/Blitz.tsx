import { useCallback, useEffect, useRef, useState } from 'react';
import { TOPIC_BY_ID } from '../content/index.ts';
import { countGaps, splitOption } from '../lib/lexicon.ts';
import { buildBlitzPool } from '../lib/builders.ts';
import { shuffle, type SessionQuestion } from '../lib/session.ts';
import { getState, recordReviewCorrect, recordWrong, touchActivity, update } from '../lib/store.ts';
import { blitzMessage, plural } from '../lib/feedback.ts';
import { go } from '../lib/router.ts';
import { Icon } from '../components/Icon.tsx';
import { Meter, StatTile } from '../components/ui.tsx';
import { TappableText } from '../components/TappableText.tsx';

const DURATION = 60_000;

interface Card {
  sq: SessionQuestion;
  options: string[];
}

function makeDeck(pool: SessionQuestion[]): Card[] {
  return shuffle(pool).map((sq) => {
    const wrong = sq.question.wrong[Math.floor(Math.random() * sq.question.wrong.length)];
    return { sq, options: shuffle([sq.question.correct, wrong]) };
  });
}

type Phase = 'intro' | 'run' | 'done';

export function Blitz() {
  const [pool] = useState(() => buildBlitzPool(getState()));
  const [phase, setPhase] = useState<Phase>('intro');
  const [deck, setDeck] = useState<Card[]>([]);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [flash, setFlash] = useState<{ chosen: string; ok: boolean } | null>(null);
  const [left, setLeft] = useState(DURATION);
  const [mistakes, setMistakes] = useState<Card[]>([]);
  const [prevBest] = useState(() => getState().blitzBest);
  const deadline = useRef(0);
  const lock = useRef(false);

  const start = () => {
    setDeck(makeDeck(pool));
    setI(0);
    setScore(0);
    setAnswered(0);
    setCombo(0);
    setBestCombo(0);
    setMistakes([]);
    setFlash(null);
    lock.current = false;
    deadline.current = performance.now() + DURATION;
    setLeft(DURATION);
    setPhase('run');
  };

  useEffect(() => {
    if (phase !== 'run') return;
    let raf = 0;
    const tick = () => {
      const l = Math.max(0, deadline.current - performance.now());
      setLeft(l);
      if (l <= 0) setPhase('done');
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // save result once
  const saved = useRef(false);
  useEffect(() => {
    if (phase !== 'done' || saved.current) return;
    saved.current = true;
    update((d) => {
      touchActivity(d);
      d.totals.sessions += 1;
      d.totals.minutes += 1;
      d.blitzBest = Math.max(d.blitzBest, score);
    });
  }, [phase, score]);

  const card = deck.length ? deck[i % deck.length] : null;

  const choose = useCallback(
    (opt: string) => {
      if (phase !== 'run' || !card || lock.current) return;
      lock.current = true;
      const ok = opt === card.sq.question.correct;
      setFlash({ chosen: opt, ok });
      setAnswered((n) => n + 1);
      if (ok) {
        setScore((n) => n + 1);
        setCombo((c) => {
          const v = c + 1;
          setBestCombo((b) => Math.max(b, v));
          return v;
        });
      } else {
        setCombo(0);
        setMistakes((m) => (m.some((x) => x.sq.question.id === card.sq.question.id) ? m : [...m, card]));
      }
      update((d) => {
        d.totals.answered += 1;
        if (ok) {
          d.totals.correct += 1;
          recordReviewCorrect(d, card.sq.question.id);
        } else recordWrong(d, card.sq.question.id);
      });
      window.setTimeout(
        () => {
          setFlash(null);
          setI((n) => n + 1);
          lock.current = false;
        },
        ok ? 220 : 900,
      );
    },
    [phase, card],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (phase === 'intro' && e.key === 'Enter') {
        e.preventDefault();
        start();
        return;
      }
      if (phase !== 'run' || !card) return;
      if (e.key === '1' || e.key === 'ArrowLeft') choose(card.options[0]);
      if (e.key === '2' || e.key === 'ArrowRight') choose(card.options[1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (pool.length === 0) {
    return (
      <div className="page narrow">
        <div className="card empty-state">
          <h1>Блиц недоступен</h1>
          <p className="muted">Пройдите хотя бы одну тему — блиц собирает вопросы из пройденных тем.</p>
          <button type="button" className="btn primary" onClick={() => go({ name: 'home' })}>
            На главную
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="page narrow">
        <div className="card blitz-intro">
          <span className="mode-icon big">
            <Icon name="bolt" size={28} />
          </span>
          <h1>Блиц · 60 секунд</h1>
          <ul className="plain-list">
            <li>Два варианта на каждый вопрос, вопросы из пройденных тем.</li>
            <li>Ошибка не останавливает таймер, но показывает правильный ответ.</li>
            <li>Ошибки попадают в «Работу над ошибками».</li>
          </ul>
          {prevBest > 0 && <p className="muted">Личный рекорд: {prevBest}</p>}
          <div className="results-actions">
            <button type="button" className="btn primary" onClick={start}>
              <Icon name="play" size={16} /> Старт
            </button>
            <button type="button" className="btn ghost" onClick={() => go({ name: 'home' })}>
              Назад
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    const best = Math.max(prevBest, score);
    const msg = blitzMessage(score, best, prevBest);
    return (
      <div className="page results">
        <div className="results-grid">
          <section className="card results-hero">
            <div className="results-kicker">Блиц · 60 секунд</div>
            <div className="hero-number">{score}</div>
            <div className="muted">{plural(score, ['верный ответ', 'верных ответа', 'верных ответов'])}</div>
            <h1>{msg.title}</h1>
            <p className="results-text">{msg.text}</p>
            <div className="stat-row">
              <StatTile label="Всего ответов" value={answered} />
              <StatTile label="Точность" value={answered ? `${Math.round((score / answered) * 100)}%` : '—'} />
              <StatTile label="Лучшая серия" value={bestCombo} />
              <StatTile label="Рекорд" value={best} />
            </div>
            <div className="results-actions">
              <button type="button" className="btn primary" onClick={start}>
                <Icon name="refresh" size={18} /> Ещё раз
              </button>
              <button type="button" className="btn ghost" onClick={() => go({ name: 'home' })}>
                На главную
              </button>
            </div>
          </section>
          <section className="card results-review">
            <h2>{mistakes.length ? 'Ошибки' : 'Разбор'}</h2>
            {mistakes.length === 0 ? (
              <p className="muted">Ошибок не было.</p>
            ) : (
              <ol className="review-list">
                {mistakes.map((m) => {
                  const q = m.sq.question;
                  const t = TOPIC_BY_ID[m.sq.topicId];
                  const gaps = countGaps(q.q);
                  return (
                    <li key={q.id} className="review-item">
                      <div className="muted small">{t.title}</div>
                      <div className="review-q" lang="en">
                        <TappableText text={q.q} glossary={t.glossary} fill={gaps ? splitOption(q.correct, gaps) : null} />
                      </div>
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

  if (!card) return null;
  const q = card.sq.question;
  const t = TOPIC_BY_ID[card.sq.topicId];
  const gaps = countGaps(q.q);
  const secs = Math.ceil(left / 1000);
  return (
    <div className="play blitz">
      <header className="play-top">
        <button type="button" className="icon-btn" onClick={() => setPhase('done')} aria-label="Завершить блиц">
          <Icon name="close" />
        </button>
        <div className="play-progress">
          <Meter value={left / DURATION} label="Оставшееся время" size="lg" tone={secs <= 10 ? 'C1' : 'accent'} />
        </div>
        <div className={`play-count timer${secs <= 10 ? ' low' : ''}`} aria-label={`Осталось ${secs} секунд`}>
          <Icon name="clock" size={16} /> {secs}
        </div>
      </header>
      <main className="blitz-main">
        <div className="blitz-score">
          <span>
            Счёт <b>{score}</b>
          </span>
          {combo >= 3 && <span className="chip streak">Серия {combo}</span>}
        </div>
        <section className="q-card" key={`${q.id}-${i}`}>
          <div className="q-task muted small">{t.title}</div>
          <div className="q-text" lang="en">
            <TappableText text={q.q} glossary={t.glossary} fill={flash && !flash.ok && gaps ? splitOption(q.correct, gaps) : null} />
          </div>
        </section>
        <div className="options grid n2 blitz-options">
          {card.options.map((o, k) => {
            let st = '';
            if (flash) {
              if (o === q.correct) st = 'correct';
              else if (o === flash.chosen) st = 'wrong';
              else st = 'dim';
            }
            return (
              <button key={o} type="button" className={`option ${st}`} onClick={() => choose(o)} disabled={Boolean(flash)} lang="en">
                <span className="opt-key" aria-hidden="true">
                  {k + 1}
                </span>
                <span className="opt-text">{o}</span>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
