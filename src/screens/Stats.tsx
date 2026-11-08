import { useRef, useState } from 'react';
import { TOPICS } from '../content/index.ts';
import {
  completedIds,
  currentStreak,
  dayKey,
  emptyState,
  getState,
  replaceState,
  update,
  useProgress,
  type Settings,
} from '../lib/store.ts';
import { pct, plural } from '../lib/feedback.ts';
import { Icon } from '../components/Icon.tsx';
import { Confirm, StatTile } from '../components/ui.tsx';

const WEEKS = 8;

export function Stats() {
  const s = useProgress();
  const [confirmReset, setConfirmReset] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const done = completedIds(s).length;
  const streak = currentStreak(s);
  const acc = s.totals.answered ? s.totals.correct / s.totals.answered : 0;
  const solid = TOPICS.filter((t) => (s.topics[t.id]?.best ?? 0) >= 0.85).length;

  // activity grid: last WEEKS weeks, Monday-first columns
  const active = new Set(s.activity.days);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(today);
  start.setDate(today.getDate() - dow - (WEEKS - 1) * 7);
  const cells: { key: string; on: boolean; future: boolean; label: string }[] = [];
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = dayKey(d.getTime());
    cells.push({
      key,
      on: active.has(key),
      future: d > today,
      label: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
    });
  }
  const activeDays = cells.filter((c) => c.on).length;

  const setSetting = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    update((d) => {
      d.settings[k] = v;
    });

  const setTheme = (t: Settings['theme']) => {
    setSetting('theme', t);
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `english-gym-progress-${dayKey(Date.now())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const importData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.version !== 1 || typeof data.topics !== 'object') throw new Error('format');
      replaceState(data);
      setImportMsg('Прогресс загружен.');
    } catch {
      setImportMsg('Не удалось прочитать файл: это не файл прогресса English Gym.');
    }
  };

  return (
    <div className="page stats-page">
      <header className="page-head">
        <h1>Прогресс и настройки</h1>
      </header>

      <section className="stat-row wide">
        <StatTile label="Пройдено тем" value={`${done} / ${TOPICS.length}`} sub={`закреплено ${solid}`} />
        <StatTile label="Ответов" value={s.totals.answered.toLocaleString('ru-RU')} sub={`точность ${pct(acc)}`} />
        <StatTile
          label="Дней подряд"
          value={streak}
          sub={`рекорд ${s.activity.bestStreak} ${plural(s.activity.bestStreak, ['день', 'дня', 'дней'])}`}
        />
        <StatTile label="Тренировок" value={s.totals.sessions} sub={`≈ ${s.totals.minutes} мин`} />
      </section>

      <div className="stats-grid">
        <section className="card">
          <h2 className="card-title">Активность за {WEEKS} недель</h2>
          <p className="muted small">
            Занятий: {activeDays} {plural(activeDays, ['день', 'дня', 'дней'])}. Короткие ежедневные подходы закрепляют правила лучше, чем
            редкие длинные.
          </p>
          <div className="activity" role="img" aria-label={`Активных дней за ${WEEKS} недель: ${activeDays}`}>
            {cells.map((c) => (
              <span key={c.key} className={`act-cell${c.on ? ' on' : ''}${c.future ? ' future' : ''}`} title={`${c.label}${c.on ? ' — занятие' : ''}`} />
            ))}
          </div>
          <div className="act-legend small muted">
            <span>
              <i className="act-cell" /> нет занятий
            </span>
            <span>
              <i className="act-cell on" /> было занятие
            </span>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Настройки</h2>
          <div className="setting">
            <span>Тема оформления</span>
            <div className="segmented" role="radiogroup" aria-label="Тема оформления">
              {(
                [
                  ['auto', 'Авто'],
                  ['light', 'Светлая'],
                  ['dark', 'Тёмная'],
                ] as const
              ).map(([v, label]) => (
                <button key={v} type="button" role="radio" aria-checked={s.settings.theme === v} className={s.settings.theme === v ? 'active' : ''} onClick={() => setTheme(v)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="setting">
            <span>
              Перевод предложения после ответа
              <span className="muted small block">Слова в заданиях переводятся по нажатию всегда</span>
            </span>
            <input type="checkbox" className="switch" checked={s.settings.showTranslation} onChange={(e) => setSetting('showTranslation', e.target.checked)} />
          </label>
        </section>

        <section className="card">
          <h2 className="card-title">Данные</h2>
          <p className="muted small">Прогресс хранится только в этом браузере. Чтобы перенести его на другое устройство, сохраните файл и загрузите его там.</p>
          <div className="data-actions">
            <button type="button" className="btn ghost" onClick={exportData}>
              <Icon name="download" size={18} /> Сохранить файл
            </button>
            <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={18} /> Загрузить файл
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importData(f);
                e.target.value = '';
              }}
            />
            <button type="button" className="btn ghost danger-text" onClick={() => setConfirmReset(true)}>
              <Icon name="trash" size={18} /> Сбросить прогресс
            </button>
          </div>
          {importMsg && <p className="small">{importMsg}</p>}
        </section>
      </div>

      <Confirm
        open={confirmReset}
        title="Сбросить весь прогресс?"
        text="Будут удалены результаты тем, очередь повторения, флеш-карты и сертификаты. Это действие нельзя отменить."
        confirmLabel="Сбросить"
        danger
        onConfirm={() => {
          const settings = getState().settings;
          replaceState({ ...emptyState(), settings });
          setConfirmReset(false);
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
