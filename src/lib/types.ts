// Content schema shared by the app, the validator (scripts/validate.ts) and tests.
// Keep this file free of runtime code that Node's type stripping can't handle
// (no enums, no namespaces, no parameter properties).

export type Level = 'B1' | 'B2' | 'C1';

export const LEVELS: readonly Level[] = ['B1', 'B2', 'C1'];

/**
 * gap  — `q` contains one or more "___" gaps; each option fills them
 *        (multiple gaps in one option are separated by " / ").
 * pick — choose the grammatically correct sentence; options are full sentences,
 *        `q` is optional English context.
 * same — choose the sentence closest in meaning to the English sentence in `q`.
 */
export type QuestionType = 'gap' | 'pick' | 'same';

export interface Question {
  id: string;
  type: QuestionType;
  /** Optional Russian instruction; a sensible default is shown per type. */
  task?: string;
  /** English text of the task. Every word in it is tappable for translation. */
  q: string;
  correct: string;
  /** 1–3 wrong options, so a card shows 2, 3 or 4 options in total. */
  wrong: string[];
  /** Russian nudge shown on request before answering. Must not give the answer away. */
  hint: string;
  /** Russian explanation shown after answering (expanded after a mistake). */
  explain: string;
  /** Russian translation of the complete correct sentence. */
  tr: string;
}

export interface Example {
  en: string;
  ru: string;
}

export interface RuleBlock {
  title: string;
  /** Russian. Supports **bold**, blank-line paragraphs and "- " bullet lines. */
  body: string;
  examples: Example[];
}

export interface Flashcard {
  /** Russian question / situation. */
  front: string;
  /** Short answer: formula + English example. Supports **bold** and line breaks. */
  back: string;
}

export interface TypicalMistake {
  wrong: string;
  right: string;
  note: string;
}

export interface Topic {
  id: string;
  level: Level;
  /** Ordering inside the level. */
  order: number;
  title: string;
  titleRu: string;
  /** One-line Russian description shown on the topic card. */
  summary: string;
  /** Reference to the matching Murphy units / open sources. */
  source: string;
  rules: RuleBlock[];
  /** Ultra-short formulas for the cheat sheet. */
  cheat: string[];
  mistakes: TypicalMistake[];
  cards: Flashcard[];
  /** Practice pool. */
  questions: Question[];
  /** Certification-only pool, never shown in practice. */
  exam: Question[];
  /** Word → Russian translation for every word in this topic's `q` texts not covered by the core dictionary. */
  glossary: Record<string, string>;
}
