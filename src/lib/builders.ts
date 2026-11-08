// Assemble question sets for each mode.
import { TOPICS, TOPIC_BY_ID, getQuestion, topicsOf } from '../content/index.ts';
import type { Level } from './types.ts';
import { LEVELS } from './types.ts';
import { completedIds, dueReview, type ProgressState } from './store.ts';
import { shuffle, spreadPick, type Rng, type SessionQuestion } from './session.ts';

export const RECAP_MIN_TOPICS = 5;
export const RECAP_SIZE = 15;
export const REVIEW_SIZE = 15;
export const EXAM_SIZE = 30;

export interface Built {
  title: string;
  subtitle?: string;
  items: SessionQuestion[];
  empty?: string;
}

export function buildTopic(id: string, rng: Rng = Math.random): Built {
  const topic = TOPIC_BY_ID[id];
  if (!topic) return { title: 'Тема не найдена', items: [], empty: 'Такой темы нет.' };
  return {
    title: topic.title,
    subtitle: topic.titleRu,
    items: shuffle(topic.questions, rng).map((question) => ({ topicId: topic.id, question })),
  };
}

export function buildRecap(s: ProgressState, rng: Rng = Math.random): Built {
  const ids = completedIds(s).filter((id) => TOPIC_BY_ID[id]);
  if (ids.length < RECAP_MIN_TOPICS)
    return {
      title: 'Повторение',
      items: [],
      empty: `Повторение откроется после ${RECAP_MIN_TOPICS} пройденных тем. Сейчас пройдено: ${ids.length}.`,
    };
  const groups = ids.map((id) => TOPIC_BY_ID[id].questions.map((question) => ({ topicId: id, question })));
  return {
    title: 'Повторение',
    subtitle: `Случайные вопросы из ${ids.length} пройденных тем`,
    items: spreadPick(groups, RECAP_SIZE, rng),
  };
}

export function buildReview(s: ProgressState, now = Date.now()): Built {
  const ids = dueReview(s, now)
    .map((id) => getQuestion(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r && !r.exam))
    .slice(0, REVIEW_SIZE);
  if (!ids.length)
    return {
      title: 'Работа над ошибками',
      items: [],
      empty: 'Сейчас повторять нечего. Вопросы, в которых были ошибки, появятся здесь в нужный день.',
    };
  return {
    title: 'Работа над ошибками',
    subtitle: 'Вопросы, в которых раньше были ошибки',
    items: ids.map((r) => ({ topicId: r.topic.id, question: r.question })),
  };
}

/** Certification: 30 questions from exam pools. B2/C1 also include some of the level below. */
export function buildExam(level: string, rng: Rng = Math.random): Built {
  if (!LEVELS.includes(level as Level)) return { title: 'Тест', items: [], empty: 'Неизвестный уровень.' };
  const lv = level as Level;
  const main = topicsOf(lv);
  const lowerLevel = LEVELS[LEVELS.indexOf(lv) - 1];
  const lower = lowerLevel ? topicsOf(lowerLevel) : [];
  const toGroups = (ts: typeof TOPICS) => ts.map((t) => t.exam.map((question) => ({ topicId: t.id, question })));
  const lowerCount = lower.length ? Math.round(EXAM_SIZE * 0.2) : 0;
  const items = [
    ...spreadPick(toGroups(main), EXAM_SIZE - lowerCount, rng),
    ...spreadPick(toGroups(lower), lowerCount, rng),
  ];
  if (!items.length) return { title: `Тест ${lv}`, items: [], empty: 'Для этого уровня пока нет вопросов.' };
  return {
    title: `Сертификация ${lv}`,
    subtitle: `${items.length} вопросов без подсказок · порог 80%`,
    items: shuffle(items, rng),
  };
}

/** Blitz: questions from completed topics (or all B1 if nothing is completed yet). */
export function buildBlitzPool(s: ProgressState): SessionQuestion[] {
  const ids = completedIds(s).filter((id) => TOPIC_BY_ID[id]);
  const topics = ids.length ? ids.map((id) => TOPIC_BY_ID[id]) : topicsOf('B1');
  return topics.flatMap((t) =>
    t.questions.filter((q) => q.type === 'gap').map((question) => ({ topicId: t.id, question })),
  );
}
