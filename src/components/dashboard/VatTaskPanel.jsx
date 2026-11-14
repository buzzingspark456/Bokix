import React from 'react';
import Drawer from '../Drawer';
import { CheckCircle2, ChevronRight } from '../icons';
import { t } from '../../i18n';

// Uppgiftspanelen för momsen (2026-11-14). Öppnas från Att göra på
// startsidan i stället för att hoppa direkt till Moms och skatt: beloppet,
// datumet och de tre stegen (bokför, lämna in, betala) på ett ställe.
// "Markera som inlämnad" skriver samma company.taxFilings som Skatt och
// bokslut → Översikt, så det finns bara en sanning. Direktinlämning till
// Skatteverket kommer när Bokix kan ansluta (kräver AB, F-skatt och moms).

const fmtKr = (n) => `${Math.round(Math.abs(n)).toLocaleString('sv-SE')} kr`;
const fmtDay = (d) => (d instanceof Date ? d : new Date(d)).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' });

function Step({ n, done, title, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: '12px', padding: '14px 0', borderTop: '1px solid var(--border-light)' }}>
      <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800,
        background: done ? 'var(--status-green-bg)' : 'var(--bg-muted)', color: done ? 'var(--status-green-text)' : 'var(--text-secondary)' }}>
        {done ? <CheckCircle2 size={16} /> : n}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>{title}</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{children}</div>
      </div>
    </div>
  );
}

const primaryBtn = { display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '10px', padding: '9px 14px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer', fontFamily: 'inherit' };
const ghostBtn = { ...primaryBtn, background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)' };

export default function VatTaskPanel({ task, filedAt, isOpen, onClose, onOpenVat, onToggleFiled }) {
  if (!task) return null;
  const toPay = (task.amount || 0) >= 0;
  const late = task.daysLeft < 0;
  const when = late ? t('task.vat_sen') : task.daysLeft === 0 ? t('task.idag') : task.daysLeft === 1 ? t('task.imorgon') : t('task.om_dagar', { days: task.daysLeft });
  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={task.title} width="460px">
      <div style={{ display: 'grid', gap: '6px' }}>
        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{t('task.period', { start: task.start, end: task.end })}</div>
        <div style={{ border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 18px', background: 'var(--bg-card)', display: 'grid', gap: '6px', marginTop: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>{toPay ? t('task.att_betala') : t('task.att_fa_tillbaka')}</span>
            <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', background: filedAt ? 'var(--status-green-bg)' : late ? 'var(--status-red-bg)' : 'var(--status-amber-bg, var(--bg-muted))', color: filedAt ? 'var(--status-green-text)' : late ? 'var(--status-red-text)' : 'var(--status-amber-text, var(--text-main))' }}>
              {filedAt ? t('task.inlamnad') : when}
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{fmtKr(task.amount || 0)}</div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{t('task.senast', { date: fmtDay(task.dueDate) })}</div>
          {(task.output || task.input) ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '6px', fontVariantNumeric: 'tabular-nums' }}>
              <span>{t('task.utgaende')}</span><span>{fmtKr(task.output || 0)}</span>
              <span>{t('task.ingaende')}</span><span>−{fmtKr(task.input || 0)}</span>
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: '10px' }}>
          <Step n={1} done={task.booked} title={t('task.steg1')}>
            {task.booked ? t('task.steg1_klar') : t('task.steg1_text')}
            <div><button type="button" style={task.booked ? ghostBtn : primaryBtn} onClick={onOpenVat}>{t('task.oppna_moms')} <ChevronRight size={14} /></button></div>
          </Step>
          <Step n={2} done={Boolean(filedAt)} title={t('task.steg2')}>
            {filedAt ? t('task.steg2_klar', { date: filedAt }) : t('task.steg2_text')}
            {onToggleFiled && (
              <div><button type="button" style={filedAt ? ghostBtn : primaryBtn} onClick={onToggleFiled}>{filedAt ? t('task.angra_inlamnad') : t('task.markera_inlamnad')}</button></div>
            )}
            <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>{t('task.direkt_senare')}</div>
          </Step>
          <Step n={3} done={false} title={toPay ? t('task.steg3_betala') : t('task.steg3_tillbaka')}>
            {toPay ? t('task.steg3_betala_text', { amount: fmtKr(task.amount || 0), date: fmtDay(task.dueDate) }) : t('task.steg3_tillbaka_text')}
          </Step>
        </div>
      </div>
    </Drawer>
  );
}
