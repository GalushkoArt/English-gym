// Progress store: persisted to localStorage, exposed to React via useSyncExternalStore.
import { useSyncExternalStore } from 'react';
import type { Level } from './types.ts';

export const STORAGE_KEY = 'english-gym:v1';
const DAY = 24 * 60 * 60 * 1000;

/** Leitner intervals (by box) for mistakes and flashcards. */
export const BOX_INTERVALS = [0, 1 * DAY, 3 * DAY, 7 * DAY, 16 * DAY];
export const MAX_BOX = BOX_INTERVALS.length; // reaching it = learned

export interface TopicProgress {
  sessions: number;
  /** Best first-try accuracy 0..1. */
  best: number;
  last: number;
  lastAt: number;
  completedAt?: number;
  rulesOpenedAt?: number;
}

export interface ReviewItem {
  box: number;
  due: number;
  wrong: number;
}

export interface CertResult {
  level: Level;
  score: number; // 0..1
  correct: number;
  total: number;
  date: number;
  name: string;
  id: string;
}

export interface ExamAttempt {
  level: Level;
  score: number;
  date: number;
  passed: boolean;
}

export interface Settings {
  theme: 'auto' | 'light' | 'dark';
  name: string;
  showTranslation: boolean;
}

export interface ProgressState {
  version: 1;
  topics: Record<string, TopicProgress>;
  /** Questions answered wrong at least once — spaced review queue. */
  review: Record<string, ReviewItem>;
  /** Flashcards: key `${topicId}#${index}`. */
  cards: Record<string, ReviewItem>;
  certs: Partial<Record<Level, CertResult>>;
  attempts: ExamAttempt[];
  activity: { days: string[]; streak: number; bestStreak: number };
  totals: { answered: number; correct: number; sessions: number; minutes: number };
  blitzBest: number;
  settings: Settings;
}

export function emptyState(): ProgressState {
  return {
    version: 1,
    topics: {},
    review: {},
    cards: {},
    certs: {},
    attempts: [],
    activity: { days: [], streak: 0, bestStreak: 0 },
    totals: { answered: 0, correct: 0, sessions: 0, minutes: 0 },
    blitzBest: 0,
    settings: { theme: 'auto', name: '', showTranslation: true },
  };
}

function load(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return migrate(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

export function migrate(raw: unknown): ProgressState {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<ProgressState>;
  return {
    ...base,
    ...r,
    version: 1,
    activity: { ...base.activity, ...(r.activity ?? {}) },
    totals: { ...base.totals, ...(r.totals ?? {}) },
    settings: { ...base.settings, ...(r.settings ?? {}) },
    topics: r.topics ?? {},
    review: r.review ?? {},
    cards: r.cards ?? {},
    certs: r.certs ?? {},
    attempts: Array.isArray(r.attempts) ? r.attempts : [],
  };
}

let state: ProgressState = typeof localStorage === 'undefined' ? emptyState() : load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode) — progress lives for this tab only */
  }
}

export function getState(): ProgressState {
  return state;
}

export function update(fn: (draft: ProgressState) => ProgressState | void) {
  const draft: ProgressState = structuredClone(state);
  const next = fn(draft) ?? draft;
  state = next;
  persist();
  listeners.forEach((l) => l());
}

export function replaceState(next: ProgressState) {
  state = migrate(next);
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useProgress(): ProgressState {
  return useSyncExternalStore(subscribe, getState, getState);
}

// ---------- domain helpers (pure, operate on a draft) ----------

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function touchActivity(s: ProgressState, now = Date.now()) {
  const today = dayKey(now);
  const days = s.activity.days;
  if (days[days.length - 1] === today) return;
  const yesterday = dayKey(now - DAY);
  s.activity.streak = days[days.length - 1] === yesterday ? s.activity.streak + 1 : 1;
  s.activity.bestStreak = Math.max(s.activity.bestStreak, s.activity.streak);
  days.push(today);
  if (days.length > 400) days.splice(0, days.length - 400);
}

/** Streak to display: resets visually if the last activity was before yesterday. */
export function currentStreak(s: ProgressState, now = Date.now()): number {
  const last = s.activity.days[s.activity.days.length - 1];
  if (!last) return 0;
  if (last === dayKey(now) || last === dayKey(now - DAY)) return s.activity.streak;
  return 0;
}

export function recordWrong(s: ProgressState, qid: string, now = Date.now()) {
  const item = s.review[qid] ?? { box: 0, due: now, wrong: 0 };
  item.box = 0;
  item.due = now;
  item.wrong += 1;
  s.review[qid] = item;
}

/** Correct answer for a question that is in the review queue: promote it. */
export function recordReviewCorrect(s: ProgressState, qid: string, now = Date.now()) {
  const item = s.review[qid];
  if (!item) return;
  if (item.due > now) return; // not due yet — answering early doesn't promote
  item.box += 1;
  if (item.box >= MAX_BOX) delete s.review[qid];
  else item.due = now + BOX_INTERVALS[item.box];
}

export function dueReview(s: ProgressState, now = Date.now()): string[] {
  return Object.entries(s.review)
    .filter(([, r]) => r.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

export function gradeCard(s: ProgressState, key: string, remembered: boolean, now = Date.now()) {
  const item = s.cards[key] ?? { box: 0, due: now, wrong: 0 };
  if (remembered) {
    item.box = Math.min(item.box + 1, MAX_BOX);
    item.due = now + (BOX_INTERVALS[item.box] ?? 30 * DAY);
  } else {
    item.box = 0;
    item.wrong += 1;
    item.due = now;
  }
  s.cards[key] = item;
}

export function isCardDue(s: ProgressState, key: string, now = Date.now()): boolean {
  const c = s.cards[key];
  return !c || c.due <= now;
}

/** After a topic session: update mastery. */
export function recordTopicSession(s: ProgressState, topicId: string, accuracy: number, now = Date.now()) {
  const t = s.topics[topicId] ?? { sessions: 0, best: 0, last: 0, lastAt: 0 };
  t.sessions += 1;
  t.best = Math.max(t.best, accuracy);
  t.last = accuracy;
  t.lastAt = now;
  if (!t.completedAt) t.completedAt = now;
  s.topics[topicId] = t;
}

export function isCompleted(s: ProgressState, topicId: string): boolean {
  return Boolean(s.topics[topicId]?.completedAt);
}

export function completedIds(s: ProgressState): string[] {
  return Object.entries(s.topics)
    .filter(([, t]) => t.completedAt)
    .map(([id]) => id);
}

/** Days after which a completed topic is worth refreshing, growing with each session. */
export function refreshAfterDays(sessions: number): number {
  return [0, 2, 5, 10, 21][Math.min(sessions, 4)] || 30;
}

export function needsRefresh(t: TopicProgress | undefined, now = Date.now()): boolean {
  if (!t?.completedAt) return false;
  return now - t.lastAt > refreshAfterDays(t.sessions) * DAY;
}

export type Mastery = 'new' | 'started' | 'done' | 'solid';

export function masteryOf(t: TopicProgress | undefined): Mastery {
  if (!t) return 'new';
  if (!t.completedAt) return 'started';
  if (t.best >= 0.85 && t.sessions >= 2) return 'solid';
  return 'done';
}

export const MASTERY_LABEL: Record<Mastery, string> = {
  new: 'Не начата',
  started: 'Начата',
  done: 'Пройдена',
  solid: 'Закреплена',
};
