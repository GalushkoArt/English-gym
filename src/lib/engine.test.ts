import { describe, expect, it } from 'vitest';
import { countGaps, resolve, resolveStrict, splitOption, tokenize, wordsOf } from './lexicon.ts';
import { answer, clearedCount, createSession, current, isFinished, next, progress, spreadPick, summarize } from './session.ts';
import {
  BOX_INTERVALS,
  currentStreak,
  dueReview,
  emptyState,
  gradeCard,
  migrate,
  recordReviewCorrect,
  recordTopicSession,
  recordWrong,
  touchActivity,
} from './store.ts';
import { plural, sessionMessage } from './feedback.ts';
import type { Question } from './types.ts';

const q = (id: string, correct = 'is', wrong = ['are', 'be']): Question => ({
  id,
  type: 'gap',
  q: `It ___ fine (${id}).`,
  correct,
  wrong,
  hint: 'h',
  explain: 'e',
  tr: 't',
});

describe('lexicon', () => {
  it('tokenizes words, gaps, speakers and sentence starts', () => {
    const segs = tokenize("A: Where's Tom?\nB: He ___ to the bank. Sorry, it's late.");
    expect(segs.filter((s) => s.kind === 'label').map((s) => (s as { text: string }).text)).toEqual(['A', 'B']);
    expect(segs.filter((s) => s.kind === 'gap')).toHaveLength(1);
    const words = wordsOf("Where's Tom? He ___ to the bank. Sorry, it's late.");
    expect(words.map((w) => w.text)).toEqual(["Where's", 'Tom', 'He', 'to', 'the', 'bank', 'Sorry', "it's", 'late']);
    expect(words.find((w) => w.text === 'Sorry')!.start).toBe(true);
    expect(words.find((w) => w.text === 'Tom')!.start).toBe(false);
  });

  it('does not treat numbers as words', () => {
    expect(wordsOf('In the 1990s, 25 people came.').map((w) => w.text)).toEqual(['In', 'the', 'people', 'came']);
  });

  it('counts gaps and splits multi-gap options', () => {
    expect(countGaps('If I ___ , I ___ .')).toBe(2);
    expect(splitOption('had / would have', 2)).toEqual(['had', 'would have']);
    expect(splitOption('and / or', 1)).toEqual(['and / or']);
  });

  it('resolves case-aware and strips possessives', () => {
    const core = { may: 'может', May: 'май', tom: 'x', Tom: 'Том' };
    expect(resolveStrict('May', false, [core])!.ru).toBe('май');
    expect(resolveStrict('May', true, [core])!.ru).toBe('может');
    expect(resolveStrict("Tom's", false, [core])!.ru).toContain('Том');
    expect(resolveStrict('walked', false, [{ walk: 'идти' }])).toBeNull();
    expect(resolve('walked', false, [{ walk: 'идти' }])!.approx).toBe(true);
  });
});

describe('session', () => {
  const rng = () => 0.42;

  it('re-queues wrong answers at the end until solved', () => {
    let s = createSession(
      ['a', 'b', 'c'].map((id) => ({ topicId: 't', question: q(id) })),
      { mode: 'topic', rng, now: 0 },
    );
    expect(s.queue).toHaveLength(3);
    const first = current(s)!.qid;
    s = answer(s, 'are', rng);
    expect(s.answer?.correct).toBe(false);
    expect(s.queue).toHaveLength(4);
    expect(s.queue[3].qid).toBe(first);
    expect(s.queue[3].options.sort()).toEqual(['are', 'be', 'is']);
    s = next(s);
    s = next(answer(s, 'is', rng));
    s = next(answer(s, 'is', rng));
    expect(isFinished(s)).toBe(false);
    expect(clearedCount(s)).toBe(2);
    expect(progress(s)).toBeCloseTo(2 / 3);
    s = next(answer(s, 'is', rng), 1000);
    expect(isFinished(s)).toBe(true);
    const sum = summarize(s);
    expect(sum.firstTry).toBe(2);
    expect(sum.mistakes).toEqual([first]);
    expect(sum.accuracy).toBeCloseTo(2 / 3);
  });

  it('exam mode does not repeat questions', () => {
    let s = createSession([{ topicId: 't', question: q('a') }], { mode: 'exam', repeatWrong: false, rng });
    s = next(answer(s, 'are', rng));
    expect(isFinished(s)).toBe(true);
    expect(summarize(s).accuracy).toBe(0);
  });

  it('ignores a second answer to the same card', () => {
    let s = createSession([{ topicId: 't', question: q('a') }], { mode: 'topic', rng });
    s = answer(s, 'is', rng);
    const again = answer(s, 'are', rng);
    expect(again).toBe(s);
  });

  it('spreadPick covers groups evenly', () => {
    const groups = [
      [1, 2, 3, 4],
      [10, 20, 30, 40],
      [100, 200],
    ];
    const pick = spreadPick(groups, 6, Math.random);
    expect(pick).toHaveLength(6);
    expect(pick.filter((x) => x < 10)).toHaveLength(2);
    expect(pick.filter((x) => x >= 10 && x < 100)).toHaveLength(2);
    expect(pick.filter((x) => x >= 100)).toHaveLength(2);
  });
});

describe('store helpers', () => {
  it('moves review items through Leitner boxes', () => {
    const s = emptyState();
    recordWrong(s, 'q1', 0);
    expect(dueReview(s, 0)).toEqual(['q1']);
    recordReviewCorrect(s, 'q1', 10);
    expect(s.review.q1.box).toBe(1);
    expect(dueReview(s, 11)).toEqual([]);
    expect(dueReview(s, 10 + BOX_INTERVALS[1])).toEqual(['q1']);
    // answering early does not promote
    recordReviewCorrect(s, 'q1', 20);
    expect(s.review.q1.box).toBe(1);
    let t = 10 + BOX_INTERVALS[1];
    for (let i = 0; i < 10 && s.review.q1; i++) {
      recordReviewCorrect(s, 'q1', t);
      t += 40 * 86400000;
    }
    expect(s.review.q1).toBeUndefined();
  });

  it('tracks daily streaks', () => {
    const s = emptyState();
    const day = 86400000;
    const t0 = new Date(2026, 0, 10, 12).getTime();
    touchActivity(s, t0);
    touchActivity(s, t0 + 1000);
    touchActivity(s, t0 + day);
    expect(s.activity.streak).toBe(2);
    expect(currentStreak(s, t0 + day)).toBe(2);
    expect(currentStreak(s, t0 + 3 * day)).toBe(0);
    touchActivity(s, t0 + 4 * day);
    expect(s.activity.streak).toBe(1);
    expect(s.activity.bestStreak).toBe(2);
  });

  it('records topic sessions and flashcards', () => {
    const s = emptyState();
    recordTopicSession(s, 't', 0.6, 5);
    recordTopicSession(s, 't', 0.9, 6);
    expect(s.topics.t).toMatchObject({ sessions: 2, best: 0.9, last: 0.9, completedAt: 5 });
    gradeCard(s, 't#0', true, 0);
    expect(s.cards['t#0'].box).toBe(1);
    gradeCard(s, 't#0', false, 0);
    expect(s.cards['t#0'].box).toBe(0);
  });

  it('migrates partial saved state', () => {
    const s = migrate({ topics: { a: { sessions: 1, best: 1, last: 1, lastAt: 1 } }, settings: { theme: 'dark' } });
    expect(s.settings.showTranslation).toBe(true);
    expect(s.settings.theme).toBe('dark');
    expect(s.review).toEqual({});
  });
});

describe('feedback', () => {
  it('uses Russian plural forms', () => {
    expect(plural(1, ['вопрос', 'вопроса', 'вопросов'])).toBe('вопрос');
    expect(plural(3, ['вопрос', 'вопроса', 'вопросов'])).toBe('вопроса');
    expect(plural(11, ['вопрос', 'вопроса', 'вопросов'])).toBe('вопросов');
    expect(plural(22, ['вопрос', 'вопроса', 'вопросов'])).toBe('вопроса');
  });

  it('keeps end messages calm (no exclamation marks)', () => {
    for (const acc of [0, 0.3, 0.5, 0.7, 0.9, 1]) {
      const m = sessionMessage('topic', {
        total: 10,
        firstTry: Math.round(acc * 10),
        accuracy: acc,
        mistakes: [],
        hints: 0,
        durationMs: 1,
        bestStreak: 0,
      });
      expect(m.text).not.toContain('!');
    }
  });
});
