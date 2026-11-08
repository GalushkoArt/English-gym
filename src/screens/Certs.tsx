import { useState } from 'react';
import { LEVEL_INFO, topicsOf } from '../content/index.ts';
import { LEVELS, type Level } from '../lib/types.ts';
import { update, useProgress, type CertResult } from '../lib/store.ts';
import { pct, PASS_THRESHOLD } from '../lib/feedback.ts';
import { EXAM_SIZE } from '../lib/builders.ts';
import { downloadCertificate, formatDate } from '../lib/certificate.ts';
import { go } from '../lib/router.ts';
import { Icon } from '../components/Icon.tsx';
import { LevelBadge, Meter } from '../components/ui.tsx';

export function Certs() {
  const s = useProgress();
  const [name, setName] = useState(s.settings.name);
  const saveName = () => update((d) => void (d.settings.name = name.trim().slice(0, 60)));
  const [printing, setPrinting] = useState<Level | null>(null);

  const print = (l: Level) => {
    setPrinting(l);
    document.body.classList.add('printing-cert');
    window.setTimeout(() => {
      window.print();
      document.body.classList.remove('printing-cert');
      setPrinting(null);
    }, 80);
  };

  return (
    <div className="page certs">
      <header className="page-head">
        <h1>Сертификация</h1>
        <p className="muted">
          Тест на уровень: {EXAM_SIZE} вопросов из отдельного экзаменационного банка — в тренировках они не встречаются. Без подсказок и
          повторов, порог прохождения {pct(PASS_THRESHOLD)}. В тестах B2 и C1 пятая часть вопросов — из уровня ниже.
        </p>
      </header>

      <section className="card name-card">
        <label htmlFor="cert-name" className="card-title">
          Имя на сертификате
        </label>
        <div className="name-row">
          <input
            id="cert-name"
            className="input"
            value={name}
            maxLength={60}
            placeholder="Имя и фамилия"
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
          />
          <button type="button" className="btn ghost" onClick={saveName} disabled={name.trim() === s.settings.name}>
            Сохранить
          </button>
        </div>
      </section>

      <div className="cert-grid">
        {LEVELS.map((l) => {
          const ts = topicsOf(l);
          const done = ts.filter((t) => s.topics[t.id]?.completedAt).length;
          const attempts = s.attempts.filter((a) => a.level === l);
          const best = attempts.reduce((m, a) => Math.max(m, a.score), 0);
          const cert = s.certs[l];
          const ready = ts.length > 0 && done === ts.length;
          return (
            <section key={l} className={`card cert-level level-edge-${l}`}>
              <header className="cert-head">
                <LevelBadge level={l} />
                <div>
                  <h2>{LEVEL_INFO[l].name}</h2>
                  <p className="muted small">{LEVEL_INFO[l].blurb}</p>
                </div>
              </header>
              <div className="ts-row">
                <span className="muted">Пройдено тем уровня</span>
                <span>
                  {done} / {ts.length}
                </span>
              </div>
              <Meter value={ts.length ? done / ts.length : 0} tone={l} size="sm" label={`Пройдено тем ${l}`} />
              {attempts.length > 0 && (
                <div className="ts-row">
                  <span className="muted">Попыток / лучший результат</span>
                  <span>
                    {attempts.length} / {pct(best)}
                  </span>
                </div>
              )}
              {!ready && !cert && (
                <p className="small muted">
                  Тест можно пройти в любой момент, но надёжнее — после всех тем уровня.
                </p>
              )}
              {cert ? (
                <CertificateCard cert={cert} name={cert.name || s.settings.name} printing={printing === l} />
              ) : null}
              <div className="cert-actions">
                <button type="button" className={`btn ${cert ? 'ghost' : 'primary'}`} onClick={() => go({ name: 'play', mode: 'exam', level: l })}>
                  <Icon name="play" size={16} /> {cert ? 'Пройти ещё раз' : attempts.length ? 'Новая попытка' : 'Начать тест'}
                </button>
                {cert && (
                  <>
                    <button type="button" className="btn ghost" onClick={() => downloadCertificate(cert, cert.name || s.settings.name)}>
                      <Icon name="download" size={18} /> PNG
                    </button>
                    <button type="button" className="btn ghost" onClick={() => print(l)}>
                      <Icon name="print" size={18} /> Печать
                    </button>
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p className="muted small center">Сертификат подтверждает результат внутри тренажёра и не является официальным документом.</p>
    </div>
  );
}

function CertificateCard({ cert, name, printing }: { cert: CertResult; name: string; printing: boolean }) {
  return (
    <div className={`certificate level-${cert.level}${printing ? ' cert-print' : ''}`}>
      <div className="cert-top">
        <span>English Gym</span>
        <span>№ {cert.id}</span>
      </div>
      <div className="cert-title">Сертификат</div>
      <div className="cert-sub">о прохождении теста по грамматике английского языка</div>
      <div className="cert-level-row">
        <span className="cert-level-box">{cert.level}</span>
        <span>
          <b>{LEVEL_INFO[cert.level].name}</b>
          <br />
          Результат {pct(cert.score)} · {cert.correct} из {cert.total}
        </span>
      </div>
      <div className="cert-name">{name || 'Участник тренажёра'}</div>
      <div className="cert-date">Дата: {formatDate(cert.date)}</div>
    </div>
  );
}
