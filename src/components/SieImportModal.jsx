import React, { useState, useMemo } from 'react';
import { UploadCloud, AlertCircle, AlertTriangle, X, HelpCircle, CheckCircle2, ArrowRight } from './icons';
import { BRAND } from '../utils/brandColors';
import { AccountSearch } from './shared/SearchInputs';
import { ProgramLogo } from './shared/BrandLogos';
import { MIGRATION_SOURCES, OTHER_PROGRAM_HINT, MENU_MOVED_HINT } from '../utils/migrationSources';
import { t } from '../i18n';
import { checkSieImport, applySieFixes } from '../utils/sieImportCheck';
import { fileFiscalYear, sortFilesByYear, closableImportedYears } from '../utils/sieImportYears';
import { fiscalYearLabel } from '../utils/sieAttachments';
import { numberFormat } from '../utils/intlCache';
import DateField from './shared/DateField';

// ── SIE4-import — ladda upp fil → kontomappning → förhandsgranskning →
// commit. Samma fyrstegsstruktur (modal-overlay/-content/-footer, steg-
// piller, "Tillbaka"/"Avbryt"/steg-specifik primärknapp) som Bank.jsx:s
// ImportWizardModal redan etablerat för bank-CSV-import — samma mönster,
// bara en fil-typ till. src/utils/sieImport.js lazy-importeras här av
// samma skäl bankImport.js redan lazy-laddas från Bank.jsx: hålla
// parsningslogik utanför huvudbunten tills någon faktiskt släpper en fil.
//
// KRITISKT säkerhetskrav (se planen/kravspecen): INGA skrivningar sker
// förrän användaren uttryckligen bekräftar i sista steget. Allt fram
// tills dess är bara parsning/visning i lokalt state.
const STEP_LABELS = [t('ui.steg_program'), t('ui.steg_fil'), t('ui.steg_kontomappning'), t('ui.steg_forhandsgranskning')];

// Programlistan (namn, logotyp och den medvetet hedgade exportvägledningen)
// bor i src/utils/migrationSources.js — samma lista som Settings-fliken och
// den publika /byt-bokforingsprogram-sidan använder, så en tillagd
// leverantör dyker upp på alla tre ställena samtidigt. Se den filens egen
// kommentar för VARFÖR vägledningen är generellt formulerad, och för att
// den aldrig påverkar tolkningslogiken (SIE4 är samma filstandard oavsett
// avsändarprogram).

function fingerprintFile(file, meta) {
  // Enkel, deterministisk "har den här filen redan importerats?"-nyckel
  // — filnamn + filens EGET #GEN-datum (inte dagens datum) räcker för att
  // fånga en oavsiktlig dubbelimport av samma fil utan att kräva en
  // riktig innehålls-hash.
  const safeName = (file?.name || 'okand-fil').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `sie_import_${safeName}_${meta?.generatedDate || 'okant-datum'}`;
}

export default function SieImportModal({ accounts = [], verifications = [], company = null, onImport, onCloseYears, onOpenAttachments, onClose }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [sieMod, setSieMod] = useState(null); // lazy-laddad src/utils/sieImport.js
  // Inlästa filer, äldst räkenskapsår först: [{ name, parsed }], där parsed
  // är parseSieFile()-resultatet. Flera filer = flytt i ett steg, en per år.
  const [files, setFiles] = useState([]);
  const [accountRows, setAccountRows] = useState([]); // kontomappningens arbetsstate
  // Rättelser användaren valt i förhandsgranskningen (sieImportCheck.js),
  // per fil: { [index]: { bookOpeningDifference, roundOff, skipUnbalanced } }.
  const [fixesByFile, setFixesByFile] = useState({});
  // Avslutade år som kan stängas direkt efter importen (sista steget).
  const [closableYears, setClosableYears] = useState([]);
  // Vilka verifikationer som importeras: allt, ett räkenskapsår eller egna
  // datum (2026-11-05: många vill bara ha 2025 ur en fil som också har 2026).
  const [period, setPeriod] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const loadSieModule = async () => {
    if (sieMod) return sieMod;
    const mod = await import('../utils/sieImport.js');
    setSieMod(mod);
    return mod;
  };

  const existingByCode = useMemo(() => new Map(accounts.map(a => [a.code, a])), [accounts]);

  const handleFiles = async (fileList) => {
    const picked = [...(fileList || [])];
    if (picked.length === 0) return;
    setBusy(true); setError('');
    try {
      const mod = await loadSieModule();
      const read = [];
      for (const file of picked) {
        const result = mod.parseSieFile(await file.arrayBuffer());
        if (result.accounts.length === 0 && result.verifications.length === 0) {
          const msg = t('ui.hittade_varken_konton_eller_verifikationer_i_fil');
          throw new Error(picked.length > 1 ? `${file.name}: ${msg}` : msg);
        }
        read.push({ name: file.name, parsed: result });
      }
      const sorted = sortFilesByYear(read);
      setFiles(sorted);
      setFixesByFile({});
      // Bygg kontomappningens arbetsrader — en per importerat konto (ur
      // alla filer, det nyaste årets namn gäller), jämfört mot det här
      // företagets BEFINTLIGA kontoplan. Aldrig en blind 1:1-matchning:
      // varje avvikelse (namn skiljer sig, eller koden saknas helt) flaggas
      // explicit för steg 2.
      const byCode = new Map();
      for (const f of sorted) for (const a of f.parsed.accounts) byCode.set(a.code, a);
      const rows = [...byCode.values()].map(a => {
        const existing = existingByCode.get(a.code);
        if (!existing) return { code: a.code, importedName: a.name, existingName: null, status: 'new', add: true, remapTo: '' };
        if (existing.name === a.name) return { code: a.code, importedName: a.name, existingName: existing.name, status: 'match', add: false, remapTo: '' };
        return { code: a.code, importedName: a.name, existingName: existing.name, status: 'name-conflict', add: false, remapTo: '' };
      });
      setAccountRows(rows);
      setStep(2);
    } catch (e) {
      setError(e.message || t('ui.kunde_inte_lasa_eller_tolka_filen'));
    } finally {
      setBusy(false);
    }
  };

  // Kontomappningens resultat, härlett en gång inför förhandsgranskningen
  // — vilka nya konton som faktiskt ska läggas till, och vilken kodmappning
  // (importerad kod → målkod) verifikationsraderna ska skrivas om med.
  const mappingResult = useMemo(() => {
    const accountsToAdd = [];
    const codeRemap = {};
    for (const row of accountRows) {
      if (row.remapTo) {
        codeRemap[row.code] = row.remapTo;
      } else if (row.status === 'new' && row.add) {
        accountsToAdd.push({ code: row.code, name: row.importedName });
      }
    }
    return { accountsToAdd, codeRemap };
  }, [accountRows]);

  const yearOptions = useMemo(() => {
    const byKey = new Map();
    for (const { parsed } of files) {
      for (const v of parsed.verifications) {
        const fy = parsed.fiscalYears.find(y => y.start <= v.date && v.date <= y.end);
        const start = fy ? fy.start : `${v.date.slice(0, 4)}-01-01`;
        const end = fy ? fy.end : `${v.date.slice(0, 4)}-12-31`;
        byKey.set(`${start}|${end}`, { start, end, label: fiscalYearLabel(start, end) });
      }
    }
    return [...byKey.values()].sort((a, b) => a.start.localeCompare(b.start));
  }, [files]);
  const range = useMemo(() => {
    if (period === 'custom') return { from: customFrom || '', to: customTo || '' };
    const fy = yearOptions.find(y => `${y.start}|${y.end}` === period);
    return fy ? { from: fy.start, to: fy.end } : { from: '', to: '' };
  }, [period, customFrom, customTo, yearOptions]);
  const inRange = (date) => (!range.from || date >= range.from) && (!range.to || date <= range.to);

  const previews = useMemo(() => files.map(({ name: fileName, parsed }, index) => {
    const fixes = fixesByFile[index] || {};
    const { accountsToAdd, codeRemap } = mappingResult;
    const remapAccount = (code) => codeRemap[code] || code;
    const accountsByCode = new Map([...accounts, ...accountsToAdd].map(a => [a.code, a]));

    // Räkenskapsåret sparas per verifikation: det gamla programmets
    // verifikatnummer börjar om varje år, så underlagskopplingen
    // (SieAttachmentsModal) måste veta vilket år "A31" hör till.
    const fiscalYearOf = (date) => parsed.fiscalYears.find(fy => fy.start <= date && date <= fy.end);
    const importVerifications = parsed.verifications.filter(v => inRange(v.date)).map(v => ({
      series: v.series,
      date: v.date,
      description: v.description,
      sieNumber: v.sieNumber,
      ...(fiscalYearOf(v.date) ? { sieFiscalYearStart: fiscalYearOf(v.date).start, sieFiscalYearEnd: fiscalYearOf(v.date).end } : {}),
      rows: v.rows.map(r => ({ ...r, account: remapAccount(r.account), accountName: accountsByCode.get(remapAccount(r.account))?.name || r.account })),
    }));

    const fiscalYearZero = fileFiscalYear(parsed);
    // Ingående balans hör till räkenskapsårets första dag: den följer med när
    // den dagen ligger i perioden.
    const openingVerification = sieMod && fiscalYearZero && inRange(fiscalYearZero.start)
      ? sieMod.buildOpeningVerification(parsed.openingBalances, fiscalYearZero.start, { accountsByCode })
      : null;
    if (openingVerification) {
      openingVerification.rows = openingVerification.rows.map(r => ({ ...r, account: remapAccount(r.account) }));
    }

    // Vad som inte går ihop, och de rättelser användaren valt.
    const check = checkSieImport({ opening: openingVerification, verifications: importVerifications, companyType: parsed.meta?.companyType, accountsByCode });
    const fixed = applySieFixes({ opening: openingVerification, verifications: importVerifications }, check, fixes);
    // Det som fortfarande stoppar importen.
    const blocking = {
      opening: Boolean(check.opening && (!fixes.bookOpeningDifference || check.opening.cause === 'result_accounts')),
      rounding: Boolean(check.rounding && !fixes.roundOff),
      unbalanced: Boolean(check.unbalanced && !fixes.skipUnbalanced),
    };
    const dupTag = fingerprintFile({ name: fileName }, parsed.meta);
    // Samma fil kan importeras i omgångar (2025 nu, 2026 sedan): bara samma
    // period räknas som en dubblett.
    const alreadyImported = verifications.some(v => (v.sourceId || '').startsWith(dupTag) && inRange(v.date));

    return {
      accountsToAdd,
      verificationsToImport: fixed.verifications,
      openingVerification: fixed.opening,
      check,
      blocking,
      blocked: blocking.opening || blocking.rounding || blocking.unbalanced,
      warnings: parsed.warnings,
      alreadyImported,
      sourceTag: dupTag,
      fiscalYear: fiscalYearZero,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [files, mappingResult, accounts, sieMod, verifications, fixesByFile, range]);

  const setFixesFor = (index) => (updater) => setFixesByFile(prev => ({
    ...prev,
    [index]: typeof updater === 'function' ? updater(prev[index] || {}) : updater,
  }));
  const countOf = (p) => p.verificationsToImport.length + (p.openingVerification ? 1 : 0);
  const totalCount = previews.reduce((s, p) => s + countOf(p), 0);

  const handleCommit = () => {
    if (previews.length === 0) return;
    setBusy(true);
    try {
      // Äldst först: varje års ingående balans räknas då mot året före
      // (App.jsx kör sieOpeningReconcile efter varje fil). Nya konton
      // läggs till med den första filen.
      previews.forEach((p, i) => {
        const toCommit = p.openingVerification ? [...p.verificationsToImport, p.openingVerification] : p.verificationsToImport;
        if (toCommit.length === 0 && i > 0) return;
        onImport(toCommit, i === 0 ? p.accountsToAdd : [], p.sourceTag);
      });
      const years = onCloseYears ? closableImportedYears(previews.map(p => p.fiscalYear), company) : [];
      // Sista steget: stäng avslutade år och/eller koppla underlag (SIE-filen
      // har aldrig med kvittobilder).
      if (years.length > 0 || onOpenAttachments) {
        setClosableYears(years);
        setStep(4);
      } else {
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const hasIncompleteMapping = accountRows.some(r => !r.add && r.status === 'new' && !r.remapTo);
  const canCommit = previews.length > 0 && totalCount > 0 && previews.every(p => !p.blocked) && !hasIncompleteMapping;
  const yearLabelOf = (p, i) => (p.fiscalYear ? fiscalYearLabel(p.fiscalYear.start, p.fiscalYear.end) : files[i]?.name);
  const closableLabel = joinYears(closableYears.map(y => y.label));

  return (
    <div className="modal-overlay" onClick={step === 4 ? undefined : onClose}>
      <div className="modal-content" style={{ maxWidth: '760px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{t('ui.importera_bokforing_sie4')}</span>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
          {STEP_LABELS.map((label, i) => (
            <div key={label} style={{ flex: 1, textAlign: 'center', fontSize: '11.5px', fontWeight: 700, padding: '6px 0', borderRadius: '999px', background: i <= step ? BRAND.greenLight : 'var(--bg-muted)', color: i <= step ? BRAND.greenDark : 'var(--text-muted)' }}>
              {i + 1}. {label}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-red-bg)', border: '1px solid var(--status-red-bg)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '12.5px', color: 'var(--status-red-text)' }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{error}</span>
          </div>
        )}

        {step === 0 && <ProgramStep onContinue={() => setStep(1)} />}

        {step === 1 && (
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => document.getElementById('sie-import-file').click()}
            style={{
              border: `1.5px dashed ${isDragging ? BRAND.green : 'var(--gray-300)'}`,
              background: isDragging ? 'rgba(234,243,222,0.4)' : 'var(--bg-card)',
              borderRadius: '12px', padding: '40px 20px', textAlign: 'center',
              cursor: busy ? 'wait' : 'pointer', transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <input type="file" id="sie-import-file" multiple style={{ display: 'none' }} accept=".si,.se,.sie" disabled={busy} onChange={e => handleFiles(e.target.files)} />
            <div style={{ width: 44, height: 44, borderRadius: '999px', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <UploadCloud size={20} color={BRAND.greenDark} />
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-main)', margin: '0 0 4px' }}>
              {busy ? t('ui.laser_filen') : t('ui.ladda_upp_sie4_fil')}
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 6px' }}>{t('ui.dra_och_slapp_filen_har_eller_klicka_for_att_val')}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{t('ui.si_se_eller_sie_exporterat_fran_ditt_tidigare_bo')}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 0' }}>{t('ui.sie_flera_ar_tips')}</p>
          </div>
        )}

        {step === 2 && (
          <AccountMappingStep rows={accountRows} setRows={setAccountRows} existingAccounts={accounts} />
        )}

        {step === 3 && (yearOptions.length > 1 || period !== 'all') && (
          <div className="sie-period">
            <label htmlFor="sie-period" style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>{t('ui.sie_period_titel')}</label>
            <select id="sie-period" value={period} onChange={e => setPeriod(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)', fontFamily: 'inherit', minWidth: '220px' }}>
              <option value="all">{t('ui.sie_period_allt')}</option>
              {yearOptions.map(y => <option key={y.start} value={`${y.start}|${y.end}`}>{t('ui.sie_period_bara', { year: y.label })}</option>)}
              <option value="custom">{t('ui.sie_period_egna_datum')}</option>
            </select>
            {period === 'custom' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
                <DateField value={customFrom} onChange={e => setCustomFrom(e.target.value)} placeholder={t('ui.fran_datum')} style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px' }} />
                <span style={{ color: 'var(--text-muted)' }}>–</span>
                <DateField value={customTo} onChange={e => setCustomTo(e.target.value)} placeholder={t('ui.till_datum')} style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px' }} />
              </div>
            )}
            {period === 'custom' && customFrom && !yearOptions.some(y => y.start === customFrom) && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>{t('ui.sie_period_ib_not')}</p>
            )}
          </div>
        )}

        {step === 3 && previews.length === 1 && (
          <SiePreviewStep preview={previews[0]} meta={files[0].parsed.meta} fixes={fixesByFile[0] || {}} setFixes={setFixesFor(0)} onReupload={() => setStep(1)} />
        )}

        {step === 3 && previews.length > 1 && (
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.6 }}>
              {t('ui.sie_flera_ar_intro', { n: previews.length, years: joinYears(previews.map(yearLabelOf)) })}
            </p>
            {previews.map((p, i) => (
              <section key={p.sourceTag + i} style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: i === 0 ? 0 : '18px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 10px', display: 'flex', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  {yearLabelOf(p, i)}
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>{files[i].name} · {t('ui.sie_antal_verifikationer', { n: countOf(p) })}</span>
                </h3>
                <SiePreviewStep preview={p} meta={files[i].parsed.meta} fixes={fixesByFile[i] || {}} setFixes={setFixesFor(i)} onReupload={() => setStep(1)} />
              </section>
            ))}
          </div>
        )}

        {step === 4 && (
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--status-green-bg)', color: 'var(--status-green-text)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', fontWeight: 600 }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} /> {t('ui.sie_import_klar')}
            </div>
            {closableYears.length > 0 && (<>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 6px' }}>{t('ui.sie_stang_ar_titel', { years: closableLabel })}</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{t('ui.sie_stang_ar_text', { years: closableLabel })}</p>
            </>)}
            {onOpenAttachments && (
              <div style={{ marginTop: closableYears.length > 0 ? '16px' : 0, paddingTop: closableYears.length > 0 ? '16px' : 0, borderTop: closableYears.length > 0 ? '1px solid var(--border-light)' : 'none', display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 300px' }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>{t('ui.sie_nasta_underlag_titel')}</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.5 }}>{t('ui.sie_nasta_underlag_text')}</div>
                </div>
                <button type="button" onClick={() => { onClose(); onOpenAttachments(); }} style={{ padding: '8px 14px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>{t('ui.sie_nasta_underlag_knapp')}</button>
              </div>
            )}
          </div>
        )}

        <div className="modal-footer">
          {step > 1 && step < 4 && <button onClick={() => setStep(s => s - 1)} style={{ padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>{t('ui.tillbaka_2')}</button>}
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>{step === 4 ? (closableYears.length > 0 ? t('ui.sie_inte_nu') : t('ui.sie_klar')) : t('ui.avbryt')}</button>
          {step === 2 && (
            <button disabled={hasIncompleteMapping} onClick={() => setStep(3)} style={{ padding: '9px 18px', background: hasIncompleteMapping ? 'var(--gray-300)' : BRAND.green, color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: hasIncompleteMapping ? 'not-allowed' : 'pointer' }}>
              {t('ui.forhandsgranska')}
            </button>
          )}
          {step === 3 && (
            <button disabled={busy || !canCommit} onClick={handleCommit} style={{ padding: '9px 18px', background: canCommit ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: (busy || !canCommit) ? 'not-allowed' : 'pointer', opacity: canCommit ? 1 : 0.5 }}>
              {t('ui.importera')} {totalCount} {t('ui.verifikationer')}
            </button>
          )}
          {step === 4 && closableYears.length > 0 && (
            <button onClick={() => { onCloseYears(closableYears); onClose(); }} style={{ padding: '9px 18px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              {t('ui.sie_stang_ar_knapp', { years: closableLabel })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// "2024", "2024 och 2025", "2023, 2024 och 2025".
function joinYears(labels) {
  if (labels.length <= 1) return labels[0] || '';
  return `${labels.slice(0, -1).join(', ')} ${t('ui.sie_och')} ${labels[labels.length - 1]}`;
}

function ProgramStep({ onContinue }) {
  const [selected, setSelected] = useState(null);
  return (
    <div>
      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
        {t('ui.vilket_program_bokforde_du_i_tidigare_vi_visar_v')}
      </p>

      {/* Konkurrensbevakning + SIE-formatets faktiska begränsning: en
          SIE-fil innehåller bara konton/verifikationer/saldon — ALDRIG
          bilagor eller kopplingar. Den vanligaste besvikelsen efter ett
          programbyte är att upptäcka det EFTER att det gamla programmet
          redan är uppsagt och kvittobilderna otillgängliga. Visas här,
          i steget där man fortfarande har kvar (och kan logga in i) det
          gamla programmet — för sent att vara till nytta ett steg senare. */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-amber-bg)', color: 'var(--status-amber-text)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '12.5px', lineHeight: 1.6 }}>
        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          {t('ui.en_sie_fil_innehaller_konton_verifikationer_och')} <strong>{t('ui.aldrig')}</strong> {t('ui.kvittobilder_eller_bankkopplingar_ladda_ner_ditt')}
        </span>
      </div>
      {/* Logotypbrickor istället för textpiller: man känner igen sitt eget
          program på loggan snabbare än på ordet, och rutnätet (auto-fill,
          inte fast kolumnantal) klarar både sju leverantörer och den
          smalaste mobilmodalen utan en egen brytpunkt. Vit platta bakom
          varje logga — flera av bildfilerna har egen vit bakgrund inbakad
          och skulle se ut som klistermärken mot appens mörka tema. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: '8px', marginBottom: '14px' }}>
        {MIGRATION_SOURCES.map(p => (
          <button
            key={p.id} onClick={() => setSelected(p.id === selected ? null : p.id)}
            title={p.note || p.name}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px',
              padding: '12px 8px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
              border: `1.5px solid ${selected === p.id ? BRAND.green : 'var(--border)'}`,
              background: selected === p.id ? BRAND.greenLight : 'var(--bg-card)',
              color: selected === p.id ? BRAND.greenDark : 'var(--text-main)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '9px', background: '#fff', border: '1px solid var(--border-light)' }}>
              <ProgramLogo src={p.logo} alt={p.name} size={26} />
            </span>
            {p.name}
          </button>
        ))}
        <button
          onClick={() => setSelected(selected === 'other' ? null : 'other')}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px',
            padding: '12px 8px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
            border: `1.5px solid ${selected === 'other' ? BRAND.green : 'var(--border)'}`,
            background: selected === 'other' ? BRAND.greenLight : 'var(--bg-card)',
            color: selected === 'other' ? BRAND.greenDark : 'var(--text-main)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '9px', background: 'var(--bg-muted)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
            <HelpCircle size={20} />
          </span>
          {t('ui.annat_program')}
        </button>
      </div>

      {selected && selected !== 'other' && (
        <div style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px', marginBottom: '14px' }}>
          <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {MIGRATION_SOURCES.find(p => p.id === selected).steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          <p style={{ margin: '10px 0 0', fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
            <HelpCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            {MENU_MOVED_HINT}
          </p>
        </div>
      )}
      {selected === 'other' && (
        <div style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px', marginBottom: '14px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
          {OTHER_PROGRAM_HINT}
        </div>
      )}

      <button
        onClick={onContinue}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}
      >
        {t('ui.jag_har_filen_fortsatt')} <ArrowRight size={15} />
      </button>
    </div>
  );
}

function AccountMappingStep({ rows, setRows, existingAccounts }) {
  const matched = rows.filter(r => r.status === 'match');
  const flagged = rows.filter(r => r.status !== 'match');
  // Momskonton (BAS 26xx) som behöver ett beslut här är den klassiska
  // fallgropen vid programbyte: olika program lägger momsen på lite olika
  // kontonummer inom 26xx-serien, så en automatisk 1:1-matchning kan se
  // rätt ut men ändå ge fel momsdeklaration efteråt. Bara en flagga, inte
  // en spärr — den faktiska momsberäkningen rör sig aldrig, bara var
  // saldot hamnar.
  const hasVatAccounts = flagged.some(r => r.code.startsWith('26'));

  const update = (code, patch) => setRows(prev => prev.map(r => r.code === code ? { ...r, ...patch } : r));

  return (
    <div>
      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
        {matched.length} {t('ui.konton_matchar_redan_din_befintliga_kontoplan_ex')} {flagged.length > 0 ? t('ui.behover_ett_snabbt_beslut_nedan', { length: flagged.length }) : ''}
      </p>

      {hasVatAccounts && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-amber-bg)', color: 'var(--status-amber-text)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '12.5px', lineHeight: 1.6 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{t('ui.ett_eller_flera_momskonton_26xx_behover_mappas_n')}</span>
        </div>
      )}

      {flagged.length === 0 && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '12px 14px', background: 'var(--status-green-bg)', color: 'var(--status-green-text)', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600 }}>
          <CheckCircle2 size={15} /> {t('ui.alla_konton_matchar_redan_inget_att_mappa')}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {flagged.map(row => (
          <div key={row.code} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', background: 'var(--bg-card)' }}>
            {row.status === 'name-conflict' ? (
              <div style={{ fontSize: '12.5px', color: 'var(--text-main)' }}>
                <strong>{row.code}</strong> {t('ui.finns_redan_som')}<strong>{row.existingName}</strong>{t('ui.importfilen_kallar_det')}{row.importedName}{t('ui.det_befintliga_namnet_behalls_kontonamnet_andras')}
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-main)', marginBottom: '8px' }}>
                  <strong>{row.code}</strong> "{row.importedName}{t('ui.finns_inte_i_din_kontoplan')}
                </div>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="radio" checked={row.add} onChange={() => update(row.code, { add: true, remapTo: '' })} />
                    {t('ui.lagg_till_som_nytt_konto')}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="radio" checked={!row.add} onChange={() => update(row.code, { add: false })} />
                    {t('ui.bokfor_istallet_pa_ett_befintligt_konto')}
                  </label>
                  {!row.add && (
                    <div style={{ minWidth: '220px' }}>
                      <AccountSearch value={row.remapTo} onChange={(code) => update(row.code, { remapTo: code })} accounts={existingAccounts} placeholder={t('ui.sok_konto_2')} compact />
                    </div>
                  )}
                </div>
                {!row.add && !row.remapTo && (
                  <div style={{ fontSize: '11.5px', color: 'var(--status-amber-text)', marginTop: '6px' }}>{t('ui.valj_ett_konto_att_mappa_till_innan_du_fortsatte')}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const fmtKr = (v) => `${numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(Number(v) || 0))} kr`;

// Ett problem i filen: vad, varför, siffrorna, vad man gör, och knapparna.
function ProblemCard({ tone = 'red', title, children, steps, actions }) {
  const bg = tone === 'red' ? 'var(--status-red-bg)' : 'var(--status-amber-bg)';
  const fg = tone === 'red' ? 'var(--status-red-text)' : 'var(--status-amber-text)';
  return (
    <div style={{ background: bg, color: fg, borderRadius: '10px', padding: '14px 16px', marginBottom: '12px', fontSize: '13px', lineHeight: 1.55 }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontWeight: 700 }}>
        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>{title}</span>
      </div>
      <div style={{ paddingLeft: '23px' }}>
        {children}
        {steps?.length > 0 && (
          <>
            <div style={{ fontWeight: 700, marginTop: '10px' }}>{t('ui.sie_sa_rattar_du')}</div>
            <ol style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
              {steps.map((st, i) => <li key={i}>{st}</li>)}
            </ol>
          </>
        )}
        {actions && <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>{actions}</div>}
      </div>
    </div>
  );
}

const primaryBtn = { padding: '8px 14px', background: 'var(--text-main)', color: 'var(--bg-card)', border: 'none', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const secondaryBtn = { padding: '8px 14px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };

// Ett val som är gjort: grön rad med möjlighet att ångra.
function ChosenFix({ text, onUndo }) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--status-green-bg)', color: 'var(--status-green-text)', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', fontSize: '12.5px' }}>
      <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{text}</span>
      <button type="button" onClick={onUndo} style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', fontSize: '12.5px' }}>{t('ui.sie_angra')}</button>
    </div>
  );
}

function SiePreviewStep({ preview, meta, fixes = {}, setFixes, onReupload }) {
  const { accountsToAdd, verificationsToImport, openingVerification, check, warnings, alreadyImported } = preview;
  // "Visma eEkonomi 2025.3" → "Visma eEkonomi": versionen säger inget i en instruktion.
  const program = (meta?.program || '').replace(/\s+v?\d[\d.]*$/i, '').trim() || t('ui.sie_ditt_gamla_program');
  const plural = (n, one, many) => t(n === 1 ? one : many, { n });
  // Parserns rader om verifikationer som inte balanserar visas i korten ovan.
  const otherWarnings = warnings.filter(w => !/balanserar inte/.test(w));
  const setFix = (key, value) => setFixes?.(f => ({ ...f, [key]: value }));
  const reupload = <button type="button" onClick={onReupload} style={primaryBtn}>{t('ui.sie_ladda_upp_ny_fil')}</button>;
  const allRows = openingVerification ? [...verificationsToImport, openingVerification] : verificationsToImport;

  return (
    <div>
      {meta?.program && (
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px' }}>{t('ui.importerad_fran')} {meta.program}</p>
      )}

      {alreadyImported && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-amber-bg)', color: 'var(--status-amber-text)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '12.5px' }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{t('ui.den_har_filen_verkar_redan_ha_importerats_tidiga')}</span>
        </div>
      )}

      {check?.opening && (fixes.bookOpeningDifference && check.opening.cause !== 'result_accounts' ? (
        <ChosenFix
          text={t('ui.sie_skillnad_bokas', { amount: fmtKr(check.opening.diff), code: check.opening.equity.code, name: check.opening.equity.name })}
          onUndo={() => setFix('bookOpeningDifference', false)}
        />
      ) : (
        <ProblemCard
          title={t('ui.sie_ib_skiljer', { amount: fmtKr(check.opening.diff) })}
          steps={check.opening.cause === 'result_accounts'
            ? [t('ui.sie_steg_ratt_ar', { program }), t('ui.sie_steg_ladda_upp')]
            : [t('ui.sie_steg_stang_aret', { program }), t('ui.sie_steg_exportera', { program }), t('ui.sie_steg_ladda_upp')]}
          actions={<>
            {reupload}
            {check.opening.cause !== 'result_accounts' && (
              <button type="button" onClick={() => setFix('bookOpeningDifference', true)} style={secondaryBtn}>
                {t('ui.sie_boka_skillnaden', { code: check.opening.equity.code })}
              </button>
            )}
          </>}
        >
          <div style={{ marginTop: '4px' }}>
            {check.opening.cause === 'result_accounts'
              ? t('ui.sie_orsak_resultatkonton', { accounts: check.opening.resultAccounts.slice(0, 6).join(', ') })
              : t('ui.sie_orsak_ej_avslutat', { program })}
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px', fontSize: '12.5px' }}>
            <span>{t('ui.sie_debet_totalt')} <strong>{fmtKr(check.opening.debet)}</strong></span>
            <span>{t('ui.sie_kredit_totalt')} <strong>{fmtKr(check.opening.kredit)}</strong></span>
            <span>{t('ui.sie_skillnad')} <strong>{fmtKr(check.opening.diff)}</strong></span>
          </div>
        </ProblemCard>
      ))}

      {check?.rounding && (fixes.roundOff ? (
        <ChosenFix text={plural(check.rounding.length, 'ui.sie_avrundning_vald_1', 'ui.sie_avrundning_vald')} onUndo={() => setFix('roundOff', false)} />
      ) : (
        <ProblemCard
          tone="amber"
          title={plural(check.rounding.length, 'ui.sie_avrundning_rubrik_1', 'ui.sie_avrundning_rubrik')}
          actions={<button type="button" onClick={() => setFix('roundOff', true)} style={primaryBtn}>{t('ui.sie_lagg_till_avrundning')}</button>}
        >
          <div style={{ marginTop: '4px' }}>{t('ui.sie_avrundning_text', { program })}</div>
          <div style={{ marginTop: '6px', fontSize: '12px' }}>{check.rounding.slice(0, 8).map(r => `${r.label} (${fmtKr(r.diff)})`).join(' · ')}{check.rounding.length > 8 ? ' …' : ''}</div>
        </ProblemCard>
      ))}

      {check?.unbalanced && (fixes.skipUnbalanced ? (
        <ChosenFix text={plural(check.unbalanced.length, 'ui.sie_hoppar_over_1', 'ui.sie_hoppar_over')} onUndo={() => setFix('skipUnbalanced', false)} />
      ) : (
        <ProblemCard
          title={plural(check.unbalanced.length, 'ui.sie_ver_skiljer_rubrik_1', 'ui.sie_ver_skiljer_rubrik')}
          steps={[t('ui.sie_steg_ratta_ver', { program }), t('ui.sie_steg_exportera', { program }), t('ui.sie_steg_ladda_upp')]}
          actions={<>
            {reupload}
            <button type="button" onClick={() => setFix('skipUnbalanced', true)} style={secondaryBtn}>{t('ui.sie_hoppa_over')}</button>
          </>}
        >
          <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12.5px' }}>
            {check.unbalanced.slice(0, 8).map(r => (
              <span key={r.index}><strong>{r.label}</strong> {r.date} · {r.description} · {t('ui.sie_skiljer', { amount: fmtKr(r.diff) })}</span>
            ))}
            {check.unbalanced.length > 8 && <span>+ {check.unbalanced.length - 8} {t('ui.till')}</span>}
          </div>
        </ProblemCard>
      ))}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12.5px', padding: '4px 10px', borderRadius: '999px', background: 'var(--status-green-bg)', color: 'var(--status-green-text)', fontWeight: 700 }}>{accountsToAdd.length} {t('ui.nya_konton')}</span>
        <span style={{ fontSize: '12.5px', padding: '4px 10px', borderRadius: '999px', background: 'var(--status-green-bg)', color: 'var(--status-green-text)', fontWeight: 700 }}>{verificationsToImport.length} {t('ui.verifikationer')}</span>
        {openingVerification && <span style={{ fontSize: '12.5px', padding: '4px 10px', borderRadius: '999px', background: openingVerification.balanced !== false ? 'var(--status-green-bg)' : 'var(--status-red-bg)', color: openingVerification.balanced !== false ? 'var(--status-green-text)' : 'var(--status-red-text)', fontWeight: 700 }}>{t('ui.n1_ingaende_balans_verifikation')}</span>}
        {otherWarnings.length > 0 && <span style={{ fontSize: '12.5px', padding: '4px 10px', borderRadius: '999px', background: 'var(--status-amber-bg)', color: 'var(--status-amber-text)', fontWeight: 700 }}>{otherWarnings.length} {t('ui.varningar')}</span>}
      </div>

      <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: otherWarnings.length ? '12px' : 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
          <thead>
            <tr style={{ background: 'var(--bg-muted)', position: 'sticky', top: 0 }}>
              <th style={{ textAlign: 'left', padding: '8px 10px' }}>{t('ui.datum')}</th>
              <th style={{ textAlign: 'left', padding: '8px 10px' }}>{t('ui.beskrivning')}</th>
              <th style={{ textAlign: 'left', padding: '8px 10px' }}>{t('ui.serie')}</th>
            </tr>
          </thead>
          <tbody>
            {allRows.slice(0, 200).map((v, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border-light)' }}>
                <td style={{ padding: '7px 10px', color: 'var(--text-main)' }}>{v.date}</td>
                <td style={{ padding: '7px 10px', color: 'var(--text-main)' }}>{v.description}</td>
                <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>{v.series}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {allRows.length > 200 && <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>+ {allRows.length - 200} {t('ui.till')}</div>}
      </div>

      {otherWarnings.length > 0 && (
        <div style={{ maxHeight: '120px', overflowY: 'auto', background: 'var(--bg-muted)', borderRadius: '8px', padding: '10px 12px' }}>
          {otherWarnings.map((w, i) => (
            <div key={i} style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: i < otherWarnings.length - 1 ? '4px' : 0 }}>• {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}
