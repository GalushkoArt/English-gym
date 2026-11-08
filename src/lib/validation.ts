// Structural + coverage checks for a topic file. Used by scripts/validate.ts and tests.
import { countGaps, resolveStrict, splitOption, wordsOf, type Dict } from './lexicon.ts';
import { LEVELS, type Level, type Question } from './types.ts';

export interface Issue {
  level: 'error' | 'warn';
  where: string;
  msg: string;
}

export interface TopicCheck {
  issues: Issue[];
  missing: string[];
  unused: string[];
  level?: Level;
  stats: {
    questions: number;
    exam: number;
    glossary: number;
    opts: Record<2 | 3 | 4, number>;
    types: Record<'gap' | 'pick' | 'same', number>;
  };
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export function checkTopic(
  data: unknown,
  fileId: string,
  core: Dict,
  seenIds: Map<string, string> = new Map(),
): TopicCheck {
  const issues: Issue[] = [];
  const err = (where: string, msg: string) => issues.push({ level: 'error', where, msg });
  const warn = (where: string, msg: string) => issues.push({ level: 'warn', where, msg });
  const stats: TopicCheck['stats'] = {
    questions: 0,
    exam: 0,
    glossary: 0,
    opts: { 2: 0, 3: 0, 4: 0 },
    types: { gap: 0, pick: 0, same: 0 },
  };
  const result: TopicCheck = { issues, missing: [], unused: [], stats };

  if (!data || typeof data !== 'object') {
    err('topic', 'not an object');
    return result;
  }
  const t = data as Record<string, unknown>;

  if (t.id !== fileId) err('id', `must equal file name "${fileId}"`);
  if (!LEVELS.includes(t.level as Level)) err('level', 'must be B1, B2 or C1');
  else {
    result.level = t.level as Level;
    if (!fileId.toLowerCase().startsWith(String(t.level).toLowerCase() + '-'))
      warn('id', 'id should start with the level prefix, e.g. "b2-…"');
  }
  if (typeof t.order !== 'number') err('order', 'must be a number');
  for (const k of ['title', 'titleRu', 'summary', 'source'] as const) if (!isStr(t[k])) err(k, 'required string');

  // rules
  if (!Array.isArray(t.rules) || t.rules.length < 2) err('rules', 'need at least 2 rule blocks');
  else
    t.rules.forEach((r: any, i: number) => {
      if (!isStr(r?.title) || !isStr(r?.body)) err(`rules[${i}]`, 'title and body required');
      if (!Array.isArray(r?.examples) || r.examples.length < 1) err(`rules[${i}]`, 'at least 1 example');
      else
        r.examples.forEach((e: any, j: number) => {
          if (!isStr(e?.en) || !isStr(e?.ru)) err(`rules[${i}].examples[${j}]`, 'en and ru required');
        });
    });

  if (!Array.isArray(t.cheat) || t.cheat.length < 3 || !t.cheat.every(isStr)) err('cheat', 'need ≥3 strings');
  if (!Array.isArray(t.mistakes) || t.mistakes.length < 2) err('mistakes', 'need ≥2 items');
  else
    t.mistakes.forEach((m: any, i: number) => {
      if (!isStr(m?.wrong) || !isStr(m?.right) || !isStr(m?.note)) err(`mistakes[${i}]`, 'wrong/right/note required');
    });
  if (!Array.isArray(t.cards) || t.cards.length < 4) err('cards', 'need ≥4 flashcards');
  else
    t.cards.forEach((c: any, i: number) => {
      if (!isStr(c?.front) || !isStr(c?.back)) err(`cards[${i}]`, 'front/back required');
    });

  const glossary: Dict = {};
  if (!t.glossary || typeof t.glossary !== 'object' || Array.isArray(t.glossary)) err('glossary', 'must be an object');
  else
    for (const [k, v] of Object.entries(t.glossary as Record<string, unknown>)) {
      if (!isStr(v)) err(`glossary.${k}`, 'translation must be a non-empty string');
      else glossary[k] = v;
    }
  stats.glossary = Object.keys(glossary).length;

  const dicts = [glossary, core];
  const missing = new Set<string>();
  const usedKeys = new Set<string>();
  const qTexts = new Set<string>();

  const checkQ = (q: Question, where: string) => {
    if (!q || typeof q !== 'object') return err(where, 'not an object');
    if (!isStr(q.id)) err(where, 'id required');
    else {
      const prev = seenIds.get(q.id);
      if (prev) err(where, `duplicate id "${q.id}" (also in ${prev})`);
      seenIds.set(q.id, fileId);
    }
    if (!['gap', 'pick', 'same'].includes(q.type)) return err(where, `bad type "${q.type}"`);
    stats.types[q.type]++;
    if (typeof q.q !== 'string') return err(where, 'q must be a string');
    for (const k of ['correct', 'hint', 'explain', 'tr'] as const) if (!isStr(q[k])) err(where, `${k} required`);
    if (q.task !== undefined && !isStr(q.task)) err(where, 'task must be a non-empty string when present');
    if (!Array.isArray(q.wrong) || q.wrong.length < 1 || q.wrong.length > 3 || !q.wrong.every(isStr)) {
      err(where, 'wrong must have 1–3 non-empty strings');
      return;
    }
    const total = q.wrong.length + 1;
    stats.opts[total as 2 | 3 | 4]++;
    const opts = [q.correct, ...q.wrong].map(norm);
    if (new Set(opts).size !== opts.length) err(where, 'options must be distinct');

    const gaps = countGaps(q.q);
    if (q.type === 'gap') {
      if (gaps < 1) err(where, 'gap question needs "___" in q');
      if (gaps > 1)
        for (const o of [q.correct, ...q.wrong])
          if (splitOption(o, gaps).length !== gaps) err(where, `option "${o}" must have ${gaps} parts separated by " / "`);
    } else {
      if (gaps) err(where, `${q.type} question must not contain "___"`);
      if (q.type === 'same' && !isStr(q.q)) err(where, 'same question needs an English sentence in q');
      if (!q.task) warn(where, `${q.type} question without task — default instruction will be used`);
    }
    if (isStr(q.q)) {
      const key = norm(q.q);
      if (qTexts.has(key) && q.type === 'gap') err(where, 'duplicate q text');
      qTexts.add(key);
    }
    if (isStr(q.hint) && q.type === 'gap' && q.correct.length >= 3) {
      const c = q.correct.toLowerCase();
      const h = q.hint.toLowerCase();
      if (new RegExp(`(^|[^a-z])${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(h))
        warn(where, `hint seems to contain the answer "${q.correct}"`);
    }
    // Options are shuffled at runtime, so hints/explanations must never point at a position.
    const POSITIONAL = /(перв|втор|трет|четв[её]рт|последн)\S*\s+(вариант|опци)|вариант\S*\s+(№|номер|[1-4АБВГ]\b)/i;
    for (const k of ['hint', 'explain'] as const)
      if (isStr(q[k]) && POSITIONAL.test(q[k])) warn(where, `${k} refers to an option by position — options are shuffled; name it by content`);
    for (const w of wordsOf(q.q)) {
      const r = resolveStrict(w.text, w.start, dicts);
      if (!r) {
        const base = w.text.replace(/’/g, "'").replace(/'s$/i, '');
        missing.add(w.start ? base.toLowerCase() : base);
      }
      else if (Object.prototype.hasOwnProperty.call(glossary, r.key)) usedKeys.add(r.key);
    }
  };

  if (!Array.isArray(t.questions) || t.questions.length < 12) err('questions', 'need ≥12 practice questions');
  else t.questions.forEach((q: Question, i: number) => checkQ(q, `questions[${i}]${q?.id ? ' ' + q.id : ''}`));
  stats.questions = Array.isArray(t.questions) ? t.questions.length : 0;

  if (!Array.isArray(t.exam) || t.exam.length < 4) err('exam', 'need ≥4 exam questions');
  else t.exam.forEach((q: Question, i: number) => checkQ(q, `exam[${i}]${q?.id ? ' ' + q.id : ''}`));
  stats.exam = Array.isArray(t.exam) ? t.exam.length : 0;

  const total = stats.questions + stats.exam;
  if (total >= 10) {
    for (const n of [2, 3, 4] as const)
      if (stats.opts[n] === 0) warn('questions', `no questions with ${n} options — mix 2, 3 and 4`);
  }

  if (missing.size) {
    const list = [...missing].sort((a, b) => a.localeCompare(b));
    err('glossary', `${list.length} word(s) not translatable: ${list.join(', ')}`);
    result.missing = list;
  }
  result.unused = Object.keys(glossary).filter((k) => !usedKeys.has(k));
  return result;
}
