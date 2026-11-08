// Pure quiz-session engine. A wrong answer re-queues the question at the end
// (with a fresh option order) until it is answered correctly.
import type { Question } from './types.ts';

export type Mode = 'topic' | 'recap' | 'review' | 'exam' | 'blitz';

export interface SessionQuestion {
  topicId: string;
  question: Question;
}

export interface QueueItem {
  key: string; // unique per attempt
  qid: string;
  attempt: number;
  options: string[];
}

export interface Outcome {
  firstTry: boolean | null; // null = not answered yet
  attempts: number;
  hint: boolean;
  chosen: string[];
}

export interface SessionState {
  mode: Mode;
  pool: Record<string, SessionQuestion>;
  order: string[]; // unique qids in initial order
  queue: QueueItem[];
  index: number;
  repeatWrong: boolean;
  outcomes: Record<string, Outcome>;
  answer: { qid: string; chosen: string; correct: boolean } | null;
  streak: number;
  bestStreak: number;
  startedAt: number;
  finishedAt: number | null;
}

export type Rng = () => number;

export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function optionsOf(q: Question): string[] {
  return [q.correct, ...q.wrong];
}

function shuffledOptions(q: Question, rng: Rng, avoid?: string[]): string[] {
  const base = optionsOf(q);
  let out = shuffle(base, rng);
  // when re-asking, try not to repeat the exact same order
  for (let i = 0; avoid && i < 4 && out.join('|') === avoid.join('|'); i++) out = shuffle(base, rng);
  return out;
}

export function createSession(
  items: SessionQuestion[],
  opts: { mode: Mode; repeatWrong?: boolean; rng?: Rng; now?: number; optionTransform?: (q: Question, rng: Rng) => string[] },
): SessionState {
  const rng = opts.rng ?? Math.random;
  const pool: Record<string, SessionQuestion> = {};
  const order: string[] = [];
  for (const it of items) {
    if (pool[it.question.id]) continue;
    pool[it.question.id] = it;
    order.push(it.question.id);
  }
  const outcomes: Record<string, Outcome> = {};
  const queue: QueueItem[] = order.map((qid) => {
    outcomes[qid] = { firstTry: null, attempts: 0, hint: false, chosen: [] };
    const q = pool[qid].question;
    return {
      key: `${qid}#0`,
      qid,
      attempt: 0,
      options: opts.optionTransform ? opts.optionTransform(q, rng) : shuffledOptions(q, rng),
    };
  });
  return {
    mode: opts.mode,
    pool,
    order,
    queue,
    index: 0,
    repeatWrong: opts.repeatWrong ?? true,
    outcomes,
    answer: null,
    streak: 0,
    bestStreak: 0,
    startedAt: opts.now ?? Date.now(),
    finishedAt: null,
  };
}

export function current(s: SessionState): QueueItem | null {
  return s.queue[s.index] ?? null;
}

export function currentQuestion(s: SessionState): SessionQuestion | null {
  const it = current(s);
  return it ? s.pool[it.qid] : null;
}

export function takeHint(s: SessionState): SessionState {
  const it = current(s);
  if (!it || s.answer) return s;
  return { ...s, outcomes: { ...s.outcomes, [it.qid]: { ...s.outcomes[it.qid], hint: true } } };
}

export function answer(s: SessionState, chosen: string, rng: Rng = Math.random): SessionState {
  const it = current(s);
  if (!it || s.answer) return s;
  const q = s.pool[it.qid].question;
  const correct = chosen === q.correct;
  const prev = s.outcomes[it.qid];
  const outcome: Outcome = {
    ...prev,
    attempts: prev.attempts + 1,
    firstTry: prev.firstTry === null ? correct : prev.firstTry,
    chosen: [...prev.chosen, chosen],
  };
  let queue = s.queue;
  if (!correct && s.repeatWrong) {
    queue = [
      ...s.queue,
      {
        key: `${it.qid}#${it.attempt + 1}`,
        qid: it.qid,
        attempt: it.attempt + 1,
        options: shuffledOptions(q, rng, it.options).filter((o) => it.options.includes(o)),
      },
    ];
  }
  const streak = correct ? s.streak + 1 : 0;
  return {
    ...s,
    queue,
    outcomes: { ...s.outcomes, [it.qid]: outcome },
    answer: { qid: it.qid, chosen, correct },
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
  };
}

export function next(s: SessionState, now = Date.now()): SessionState {
  if (!s.answer && current(s)) return s;
  const index = s.index + 1;
  const finished = index >= s.queue.length;
  return { ...s, index, answer: null, finishedAt: finished ? now : s.finishedAt };
}

export function isFinished(s: SessionState): boolean {
  return s.index >= s.queue.length;
}

/** Number of distinct questions answered correctly (cleared). */
export function clearedCount(s: SessionState): number {
  let n = 0;
  for (const qid of s.order) {
    const o = s.outcomes[qid];
    if (s.repeatWrong ? o.chosen.includes(s.pool[qid].question.correct) : o.attempts > 0) n++;
  }
  return n;
}

export function progress(s: SessionState): number {
  return s.order.length ? clearedCount(s) / s.order.length : 0;
}

/** Items still waiting in the queue after the current one, that are re-asks. */
export function pendingRepeats(s: SessionState): number {
  return s.queue.slice(s.index + (s.answer ? 1 : 0)).filter((i) => i.attempt > 0).length;
}

export interface Summary {
  total: number;
  firstTry: number;
  accuracy: number;
  mistakes: string[]; // qids answered wrong at least once
  hints: number;
  durationMs: number;
  bestStreak: number;
}

export function summarize(s: SessionState): Summary {
  const total = s.order.length;
  let firstTry = 0;
  let hints = 0;
  const mistakes: string[] = [];
  for (const qid of s.order) {
    const o = s.outcomes[qid];
    if (o.firstTry) firstTry++;
    else if (o.attempts > 0) mistakes.push(qid);
    if (o.hint) hints++;
  }
  return {
    total,
    firstTry,
    accuracy: total ? firstTry / total : 0,
    mistakes,
    hints,
    durationMs: (s.finishedAt ?? Date.now()) - s.startedAt,
    bestStreak: s.bestStreak,
  };
}

/** Pick `count` items spread evenly across groups (round-robin over shuffled groups). */
export function spreadPick<T>(groups: T[][], count: number, rng: Rng = Math.random): T[] {
  const gs = shuffle(
    groups.filter((g) => g.length).map((g) => shuffle(g, rng)),
    rng,
  );
  const out: T[] = [];
  let round = 0;
  while (out.length < count) {
    let added = false;
    for (const g of gs) {
      if (round < g.length && out.length < count) {
        out.push(g[round]);
        added = true;
      }
    }
    if (!added) break;
    round++;
  }
  return shuffle(out, rng);
}
