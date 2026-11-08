# Content guide — English Gym

Every grammar topic is one JSON file in `src/content/topics/<id>.json`. The schema is `Topic`
in `src/lib/types.ts`. Run `npm run validate` (or `node scripts/validate.ts --topic <id> --missing`)
after every edit; it must report **0 errors**.

Audience: adult Russian speakers, levels B1–C1. Grammar follows Raymond Murphy
(*English Grammar in Use*, *Advanced Grammar in Use*) and open sources (British Council
LearnEnglish, Cambridge Dictionary grammar pages). Use **British English** grammar and spelling.

## Tone

- Russian text is plain, precise, friendly, written for adults. No exclamation marks in
  explanations, no emojis, no "Отлично!", no motivational filler, no "давайте разберёмся".
- Explanations name the rule and the signal in the sentence: *«since + момент в прошлом →
  Present Perfect. Past Simple не сочетается со since»*.
- Use English grammar terms as Murphy does (Present Perfect, past participle) with Russian prose.

## File structure

```jsonc
{
  "id": "b2-third-mixed-conditionals",   // = file name, starts with level prefix
  "level": "B2",
  "order": 4,                               // order within the level (given in your assignment)
  "title": "Third & mixed conditionals",    // English title
  "titleRu": "Третий и смешанный тип условных",
  "summary": "Нереальное прошлое и его связь с настоящим",  // ≤ 70 chars, Russian
  "source": "Murphy EGIU 40; British Council: Conditionals",
  "rules": [ /* 3–5 blocks */ ],
  "cheat": [ /* 4–7 one-line formulas */ ],
  "mistakes": [ /* 3–4 typical mistakes of Russian speakers */ ],
  "cards": [ /* 5–6 flashcards */ ],
  "questions": [ /* exactly 15 practice questions */ ],
  "exam": [ /* exactly 5 certification questions, different sentences */ ],
  "glossary": { /* every word in q-texts not in core.json */ }
}
```

### rules

```json
{ "title": "Форма", "body": "**if + had + V3**, would have + V3.\n\n- первая строка\n- вторая строка",
  "examples": [ { "en": "If I had known, I would have called you.", "ru": "Если бы я знал, я бы позвонил." } ] }
```

`body` supports `**bold**`, blank-line paragraphs and lines starting with `- ` (bullets). 2–4 examples per block.
Cover: form, uses (with signal words), contrast with the neighbouring structure, special cases.

### cheat

One line each, formula style, e.g. `"now / at the moment / Look! → am/is/are + V-ing"`.

### mistakes

`{ "wrong": "I am agree with you.", "right": "I agree with you.", "note": "agree — глагол, be не нужен" }` —
real interference errors of Russian speakers (calques, missing articles, wrong tense after *since*, etc.).

### cards (flashcards for spaced recall)

`{ "front": "Чем отличается «I've been reading your book» от «I've read your book»?", "back": "**been reading** — процесс, книга не дочитана.\n**have read** — результат, книга прочитана." }`
Front: a question or situation in Russian. Back: short answer, formula + one English example.

## Questions

```json
{
  "id": "b2-third-mixed-conditionals-p01",
  "type": "gap",
  "q": "If she ___ the instructions more carefully, she wouldn't have broken the machine.",
  "correct": "had read",
  "wrong": ["read", "would read", "has read"],
  "hint": "Речь о прошлом, которое уже не изменить. Какая форма нужна в if-части?",
  "explain": "Third conditional: if + had + V3 → would have + V3. Простое read или would read описывали бы настоящее.",
  "tr": "Если бы она прочитала инструкцию внимательнее, она бы не сломала аппарат."
}
```

- `id`: `<topicId>-p01` … `-p15` for practice, `<topicId>-e01` … `-e05` for exam.
- `type`:
  - `gap` (≈ 70 %) — one gap `___` (three underscores). Two gaps allowed when the rule is
    about the pair (e.g. *if … would*); then **every** option has both parts separated by `" / "`:
    `"correct": "had / would have"`. Options never include words already in the sentence.
  - `pick` (≈ 20 %) — `task` in Russian (e.g. «Выберите грамматически верное предложение»),
    `q` is either `""` or a short English context; options are complete English sentences.
  - `same` (≈ 10 %, mainly B2/C1) — `task`: «Выберите вариант с тем же смыслом», `q` is an
    English sentence; options are sentences, only one keeps the meaning and is grammatical.
- `correct` + `wrong`: **total 2, 3 or 4 options** — mix all three counts in each topic
  (roughly ⅓ each). Use 2 options for clean binary contrasts (*for/since*, *who/which*).
- Exactly one option is correct in British English, with **no reasonable doubt**. Add context
  (time markers, a second clause, a dialogue line) until the distractors are unambiguously wrong.
  Watch for options that are "also possible" (e.g. *will* vs *going to* without evidence,
  *that* vs *which* in defining clauses, American usages like *Did you eat yet?*). If two options
  could be defended, rewrite the sentence.
- Distractors are typical learner errors, not random words. Same form type and similar length.
- Options are lowercase unless they start the sentence; no trailing full stop in gap options;
  full sentences in pick/same end with punctuation.
- Vocabulary: B2 — work, science, cities, health, travel, money, media, technology, culture,
  relationships. Natural adult sentences, 8–22 words. No childish or textbook-cliché content,
  no famous-people trivia, no real brands. Names: prefer those already in `core.json`
  (Tom, Anna, Kate, Mark, Sarah, John, Emma, David, Maria, Alex, Ben, Lucy, James, Laura, Peter,
  Helen, Mike, Jack, Sophie, Daniel, Olga, Ivan, Nick, Rachel, Paul, Chris, Jane, Sam, Lisa, Robert).
- Dialogues: lines separated by `\n`, each starting with `A: ` or `B: `.
- `hint` (Russian): points to the signal or the rule **without naming the answer**.
- `explain` (Russian, 1–3 sentences): why the correct option fits and why the most tempting
  distractor doesn't.
- `tr`: natural Russian translation of the complete correct sentence (for pick/same — of the
  correct option).
- Exam questions test the same rule with fresh sentences (no paraphrases of practice ones), slightly
  harder on average, and must work **without** the hint.
- Within one topic, vary which grammar point each question tests — cover every rule block.

## Glossary (tap-to-translate)

Every word in every `q` (practice + exam) must be translatable. Lookup is **exact surface form**:
first the topic `glossary`, then `src/content/core.json` (≈ 700 frequent words and forms). Possessive
`'s` is stripped automatically. Keys are lowercase, except proper nouns (`"Madrid": "Мадрид"`).

- Add the form exactly as it appears: `"applied": "подал заявку (прош. от apply)"`,
  `"applying": "подавая (заявку)"`, `"rates": "ставки, тарифы"`.
- Translate in the sense used in your sentences (context!), 1–4 Russian words; mark forms:
  `(прош. от …)`, `(3-я форма от …)`, `(мн. ч.)` when useful.
- Hyphenated words are one key: `"well-known": "известный"`.
- Run `node scripts/validate.ts --topic <id> --missing` — it prints the uncovered words as a
  ready-to-fill JSON skeleton. Words inside answer options are **not** looked up (they are not
  tappable), but a correct answer filled into the gap is not tappable either, so only `q` matters.
