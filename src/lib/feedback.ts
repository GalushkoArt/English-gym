// End-of-session messages. Calm, specific, supportive — shown only at the end.
import type { Mode, Summary } from './session.ts';

/** Russian plural: plural(5, ['вопрос', 'вопроса', 'вопросов']). */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export function formatDuration(ms: number): string {
  const totalSec = Math.max(1, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s} с`;
  return s ? `${m} мин ${s} с` : `${m} мин`;
}

export interface ResultMessage {
  title: string;
  text: string;
}

export function sessionMessage(mode: Mode, s: Summary): ResultMessage {
  const n = s.firstTry;
  const t = s.total;
  const errs = s.mistakes.length;
  const errWord = plural(errs, ['вопрос', 'вопроса', 'вопросов']);
  const titles: Record<Mode, string> = {
    topic: 'Тренировка завершена',
    recap: 'Повторение завершено',
    review: 'Работа над ошибками завершена',
    exam: 'Тест завершён',
    blitz: 'Блиц завершён',
  };
  const title = titles[mode];
  const a = s.accuracy;

  if (mode === 'review') {
    if (errs === 0)
      return { title, text: `Все ${t} ${plural(t, ['вопрос', 'вопроса', 'вопросов'])} решены с первой попытки. Они вернутся позже с увеличенным интервалом — так правило переходит в долгую память.` };
    return {
      title,
      text: `${n} из ${t} — с первой попытки. ${errs} ${errWord} остаются в очереди повторения: интервальное повторение работает именно так, нужно несколько встреч с правилом.`,
    };
  }

  if (a === 1)
    return {
      title,
      text: 'Все ответы с первой попытки. Правило работает уверенно — вернитесь к нему через несколько дней, чтобы проверить, что оно держится.',
    };
  if (a >= 0.85)
    return {
      title,
      text: `${n} из ${t} с первой попытки. ${errs} ${errWord} с ошибкой добавлены в «Работу над ошибками» — короткое повторение завтра закрепит результат.`,
    };
  if (a >= 0.65)
    return {
      title,
      text: 'Основа уже есть. Ошибки сосредоточены в нескольких местах — просмотрите разборы ниже и пройдите тренировку ещё раз через день: так правило закрепится лучше.',
    };
  if (a >= 0.4)
    return {
      title,
      text: 'Правило закрепилось пока частично, и это нормальный этап. Перечитайте шпаргалку и разборы ошибок, затем повторите тренировку — второй подход обычно идёт заметно легче.',
    };
  return {
    title,
    text: 'Тема пока даётся непросто — так бывает с правилами, которых нет в русском. Вернитесь к объяснению и примерам, а потом пройдите тренировку ещё раз. Все ошибки уже сохранены для повторения.',
  };
}

export const PASS_THRESHOLD = 0.8;

export function examMessage(level: string, score: number): ResultMessage {
  if (score >= PASS_THRESHOLD)
    return {
      title: `Уровень ${level} подтверждён`,
      text: `Результат ${pct(score)} при пороге ${pct(PASS_THRESHOLD)}. Сертификат сохранён в разделе «Сертификаты».`,
    };
  if (score >= 0.65)
    return {
      title: 'Почти у порога',
      text: `${pct(score)} при пороге ${pct(PASS_THRESHOLD)}. Ниже видно, какие темы просели: повторите их в тренировке и попробуйте снова — в новой попытке будут другие вопросы.`,
    };
  return {
    title: 'Порог пока не пройден',
    text: `${pct(score)} при пороге ${pct(PASS_THRESHOLD)}. Разбор по темам ниже покажет, с чего начать. Пройдите эти темы в тренировке и возвращайтесь к тесту.`,
  };
}

export function blitzMessage(score: number, best: number, prevBest: number): ResultMessage {
  if (score > prevBest && prevBest > 0)
    return { title: 'Новый личный рекорд', text: `${score} — на ${score - prevBest} больше прежнего результата.` };
  if (score > 0 && score === best && prevBest === 0)
    return { title: 'Первый результат записан', text: `${score} ${plural(score, ['верный ответ', 'верных ответа', 'верных ответов'])}. В следующий раз будет с чем сравнить.` };
  return {
    title: 'Блиц завершён',
    text: `${score} ${plural(score, ['верный ответ', 'верных ответа', 'верных ответов'])}. Личный рекорд — ${best}. Ошибки из блица попадают в «Работу над ошибками».`,
  };
}
