import type { Level, Question, Topic } from '../lib/types.ts';
import { LEVELS } from '../lib/types.ts';
import type { Dict } from '../lib/lexicon.ts';
import coreJson from './core.json';

const modules = import.meta.glob<Topic>('./topics/*.json', { eager: true, import: 'default' });

const levelRank = (l: Level) => LEVELS.indexOf(l);

export const TOPICS: Topic[] = Object.values(modules).sort(
  (a, b) => levelRank(a.level) - levelRank(b.level) || a.order - b.order,
);

export const TOPIC_BY_ID: Record<string, Topic> = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

export const CORE: Dict = coreJson as Dict;

/** Union of all topic glossaries — a fallback when a word is missing locally. */
export const SHARED_GLOSSARY: Dict = (() => {
  const out: Dict = {};
  for (const t of TOPICS) for (const [k, v] of Object.entries(t.glossary ?? {})) if (!(k in out)) out[k] = v;
  return out;
})();

export interface QRef {
  topic: Topic;
  question: Question;
  exam: boolean;
}

const Q_INDEX: Record<string, QRef> = {};
for (const topic of TOPICS) {
  for (const question of topic.questions) Q_INDEX[question.id] = { topic, question, exam: false };
  for (const question of topic.exam) Q_INDEX[question.id] = { topic, question, exam: true };
}

export function getQuestion(id: string): QRef | undefined {
  return Q_INDEX[id];
}

export function topicsOf(level: Level): Topic[] {
  return TOPICS.filter((t) => t.level === level);
}

export const LEVEL_INFO: Record<Level, { name: string; blurb: string }> = {
  B1: { name: 'Intermediate', blurb: 'Базовые времена, модальные, условные, артикли' },
  B2: { name: 'Upper-Intermediate', blurb: 'Перфектные формы, пассив, косвенная речь, нереальные условия' },
  C1: { name: 'Advanced', blurb: 'Инверсия, эмфаза, причастные обороты, формальный стиль' },
};
