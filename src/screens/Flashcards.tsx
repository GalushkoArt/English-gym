import { useCallback, useEffect, useState } from 'react';
import { TOPICS, TOPIC_BY_ID } from '../content/index.ts';
import type { Flashcard } from '../lib/types.ts';
import { getState, gradeCard, isCardDue, touchActivity, update } from '../lib/store.ts';
import { shuffle } from '../lib/session.ts';
import { plural } from '../lib/feedback.ts';
import { go } from '../lib/router.ts';
import { Icon } from '../components/Icon.tsx';
import { Meter } from '../components/ui.tsx';
import { RichText } from '../components/RichText.tsx';

interface Item {
  key: string;
  topicId: string;
  card: Flashcard;
  repeat: boolean;
}

const DUE_LIMIT = 20;

function buildCards(id: string): { title: string; items: Item[] } {
  if (id === 'due') {
    const s = getState();
    const items: Item[] = [];
    for (const t of TOPICS) {
      if (!s.topics[t.id]) continue;
      t.cards.forEach((card, i) => {
        const key = `${t.id}#${i}`;
        if (isCardDue(s, key)) items.push({ key, topicId: t.id, card, repeat: false });
      });
    }
    return { title: 'Флеш-карты к повторению', items: shuffle(items).slice(0, DUE_LIMIT) };
  }
  const t = TOPIC_BY_ID[id];
  if (!t) return { title: 'Флеш-карты', items: [] };
  return {
    title: t.title,
    items: t.cards.map((card, i) => ({ key: `${t.id}#${i}`, topicId: t.id, card, repeat: false })),
  };
}

export function Flashcards({ id }: { id: string }) {
  const [{ title, items: initial }] = useState(() => buildCards(id));
  const [queue, setQueue] = useState<Item[]>(initial);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [firstTry, setFirstTry] = useState(0);
  const [graded, setGraded] = useState<Set<string>>(new Set());
  const total = initial.length;
  const item = queue[index];
  const done = index >= queue.length;

  useEffect(() => {
    if (done && total > 0) update((d) => touchActivity(d));
  }, [done, total]);

  const grade = useCallback(
    (remembered: boolean) => {
      if (!item || !flipped) return;
      if (!graded.has(item.key)) {
        update((d) => gradeCard(d, item.key, remembered));
        setGraded((g) => new Set(g).add(item.key));
        if (remembered) setFirstTry((n) => n + 1);
      }
      if (remembered) setKnown((k) => new Set(k).add(item.key));
      else setQueue((q) => [...q, { ...item, repeat: true }]);
      setFlipped(false);
      setIndex((i) => i + 1);
    },
    [item, flipped, graded],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if (!flipped) {
          e.preventDefault();
          setFlipped(true);
        }
      } else if (flipped && (e.key === '1' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        grade(false);
      } else if (flipped && (e.key === '2' || e.key === 'ArrowRight')) {
        e.preventDefault();
        grade(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, flipped, grade]);

  const back = () => (id === 'due' ? go({ name: 'home' }) : go({ name: 'topic', id }));

  if (total === 0) {
    return (
      <div className="page narrow">
        <div className="card empty-state">
          <Icon name="cards" size={28} />
          <h1>Сейчас повторять нечего</h1>
          <p className="muted">Карты появляются для тем, которые вы начали, и возвращаются по интервалам: через 1, 3, 7 и 16 дней.</p>
          <button type="button" className="btn primary" onClick={() => go({ name: 'home' })}>
            На главную
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="page narrow">
        <div className="card results-hero">
          <div className="results-kicker">{title}</div>
          <h1>Карты пройдены</h1>
          <p className="results-text">
            С первого раза: {firstTry} из {total}.{' '}
            {firstTry === total
              ? 'Все карты вернутся позже с увеличенным интервалом.'
              : `${total - firstTry} ${plural(total - firstTry, ['карта вернётся', 'карты вернутся', 'карт вернутся'])} раньше остальных — так трудные правила повторяются чаще.`}
          </p>
          <div className="results-actions">
            {id !== 'due' && (
              <button type="button" className="btn primary" onClick={() => go({ name: 'play', mode: 'topic', id })}>
                <Icon name="play" size={16} /> Тренировка по теме
              </button>
            )}
            <button type="button" className="btn ghost" onClick={back}>
              {id === 'due' ? 'На главную' : 'К теме'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const topic = TOPIC_BY_ID[item.topicId];
  return (
    <div className="play flash">
      <header className="play-top">
        <button type="button" className="icon-btn" onClick={back} aria-label="Закрыть флеш-карты">
          <Icon name="close" />
        </button>
        <div className="play-progress">
          <Meter value={known.size / total} label="Запомнено карт" size="lg" tone="success" />
        </div>
        <div className="play-count">
          {known.size}
          <span className="muted"> / {total}</span>
        </div>
      </header>

      <main className="flash-main">
        <div className="play-meta">
          <span className="chip">{id === 'due' ? topic.title : 'Флеш-карты'}</span>
          {item.repeat && (
            <span className="chip warn">
              <Icon name="refresh" size={14} /> Повтор
            </span>
          )}
        </div>
        <div
          role="button"
          tabIndex={0}
          className={`flashcard${flipped ? ' flipped' : ''}`}
          onClick={() => setFlipped((f) => !f)}
          aria-pressed={flipped}
          key={`${item.key}-${index}`}
        >
          <div className="fc-inner">
            <div className="fc-face fc-front" aria-hidden={flipped}>
              <span className="fc-label">Вопрос</span>
              <span className="fc-text">{item.card.front}</span>
              <span className="fc-tap muted small">Нажмите, чтобы проверить себя</span>
            </div>
            <div className="fc-face fc-back" aria-hidden={!flipped}>
              <span className="fc-label">Ответ</span>
              <RichText text={item.card.back} className="fc-text" />
            </div>
          </div>
        </div>
        <div className="flash-actions">
          {flipped ? (
            <>
              <button type="button" className="btn ghost" onClick={() => grade(false)}>
                <Icon name="refresh" size={18} /> Повторить
              </button>
              <button type="button" className="btn primary" onClick={() => grade(true)}>
                <Icon name="check" size={18} /> Помню
              </button>
            </>
          ) : (
            <button type="button" className="btn primary wide" onClick={() => setFlipped(true)}>
              Показать ответ
            </button>
          )}
        </div>
        <p className="muted small center kbd-hint">
          <kbd>Space</kbd> перевернуть · <kbd>1</kbd> повторить · <kbd>2</kbd> помню
        </p>
      </main>
    </div>
  );
}
