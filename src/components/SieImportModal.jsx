import React, { useState, useMemo } from 'react';
import { UploadCloud, AlertCircle, AlertTriangle, X, HelpCircle, CheckCircle2, ArrowRight } from './icons';
import { BRAND } from '../utils/brandColors';
import { AccountSearch } from './shared/SearchInputs';
import { ProgramLogo } from './shared/BrandLogos';
import { MIGRATION_SOURCES, OTHER_PROGRAM_HINT, MENU_MOVED_HINT } from '../utils/migrationSources';
import { t } from '../i18n';

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

export default function SieImportModal({ accounts = [], verifications = [], onImport, onClose }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [sieMod, setSieMod] = useState(null); // lazy-laddad src/utils/sieImport.js
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null); // parseSieFile()-resultatet
  const [accountRows, setAccountRows] = useState([]); // kontomappningens arbetsstate

  const loadSieModule = async () => {
    if (sieMod) return sieMod;
    const mod = await import('../utils/sieImport.js');
    setSieMod(mod);
    return mod;
  };

  const existingByCode = useMemo(() => new Map(accounts.map(a => [a.code, a])), [accounts]);

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const mod = await loadSieModule();
      const buffer = await file.arrayBuffer();
      const result = mod.parseSieFile(buffer);
      if (result.accounts.length === 0 && result.verifications.length === 0) {
        throw new Error(t('ui.hittade_varken_konton_eller_verifikationer_i_fil'));
      }
      setFileName(file.name);
      setParsed(result);
      // Bygg kontomappningens arbetsrader — en per importerat konto,
      // jämfört mot det här företagets BEFINTLIGA kontoplan. Aldrig en
      // blind 1:1-matchning: varje avvikelse (namn skiljer sig, eller
      // koden saknas helt) flaggas explicit för steg 2.
      const rows = result.accounts.map(a => {
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

  const preview = useMemo(() => {
    if (!parsed) return null;
    const { accountsToAdd, codeRemap } = mappingResult;
    const remapAccount = (code) => codeRemap[code] || code;
    const accountsByCode = new Map([...accounts, ...accountsToAdd].map(a => [a.code, a]));

    // Räkenskapsåret sparas per verifikation: det gamla programmets
    // verifikatnummer börjar om varje år, så underlagskopplingen
    // (SieAttachmentsModal) måste veta vilket år "A31" hör till.
    const fiscalYearOf = (date) => parsed.fiscalYears.find(fy => fy.start <= date && date <= fy.end);
    const importVerifications = parsed.verifications.map(v => ({
      series: v.series,
      date: v.date,
      description: v.description,
      sieNumber: v.sieNumber,
      ...(fiscalYearOf(v.date) ? { sieFiscalYearStart: fiscalYearOf(v.date).start, sieFiscalYearEnd: fiscalYearOf(v.date).end } : {}),
      rows: v.rows.map(r => ({ ...r, account: remapAccount(r.account), accountName: accountsByCode.get(remapAccount(r.account))?.name || r.account })),
    }));

    const fiscalYearZero = parsed.fiscalYears.find(fy => fy.index === 0);
    const openingVerification = sieMod && fiscalYearZero
      ? sieMod.buildOpeningVerification(parsed.openingBalances, fiscalYearZero.start, { accountsByCode })
      : null;
    if (openingVerification) {
      openingVerification.rows = openingVerification.rows.map(r => ({ ...r, account: remapAccount(r.account) }));
    }

    const allToCommit = openingVerification ? [...importVerifications, openingVerification] : importVerifications;
    const unbalanced = allToCommit.filter(v => v.balanced === false);
    const dupTag = fingerprintFile({ name: fileName }, parsed.meta);
    const alreadyImported = verifications.some(v => (v.sourceId || '').startsWith(dupTag));

    return {
      accountsToAdd,
      verificationsToImport: importVerifications,
      openingVerification,
      unbalanced,
      warnings: parsed.warnings,
      alreadyImported,
      sourceTag: dupTag,
    };
  }, [parsed, mappingResult, accounts, sieMod, fileName, verifications]);

  const handleCommit = () => {
    if (!preview) return;
    setBusy(true);
    try {
      const toCommit = preview.openingVerification
        ? [...preview.verificationsToImport, preview.openingVerification]
        : preview.verificationsToImport;
      onImport(toCommit, preview.accountsToAdd, preview.sourceTag);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const hasIncompleteMapping = accountRows.some(r => !r.add && r.status === 'new' && !r.remapTo);
  const canCommit = !!preview && preview.verificationsToImport.length + (preview.openingVerification ? 1 : 0) > 0 && preview.unbalanced.length === 0 && !hasIncompleteMapping;

  return (
    <div className="modal-overlay" onClick={onClose}>
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
            onDrop={e => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
            onClick={() => document.getElementById('sie-import-file').click()}
            style={{
              border: `1.5px dashed ${isDragging ? BRAND.green : 'var(--gray-300)'}`,
              background: isDragging ? 'rgba(234,243,222,0.4)' : 'var(--bg-card)',
              borderRadius: '12px', padding: '40px 20px', textAlign: 'center',
              cursor: busy ? 'wait' : 'pointer', transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <input type="file" id="sie-import-file" style={{ display: 'none' }} accept=".si,.se,.sie" disabled={busy} onChange={e => handleFile(e.target.files?.[0])} />
            <div style={{ width: 44, height: 44, borderRadius: '999px', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <UploadCloud size={20} color={BRAND.greenDark} />
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-main)', margin: '0 0 4px' }}>
              {busy ? t('ui.laser_filen') : t('ui.ladda_upp_sie4_fil')}
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 6px' }}>{t('ui.dra_och_slapp_filen_har_eller_klicka_for_att_val')}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{t('ui.si_se_eller_sie_exporterat_fran_ditt_tidigare_bo')}</p>
          </div>
        )}

        {step === 2 && (
          <AccountMappingStep rows={accountRows} setRows={setAccountRows} existingAccounts={accounts} />
        )}

        {step === 3 && preview && (
          <SiePreviewStep preview={preview} meta={parsed?.meta} />
        )}

        <div className="modal-footer">
          {step > 1 && <button onClick={() => setStep(s => s - 1)} style={{ padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>{t('ui.tillbaka_2')}</button>}
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>{t('ui.avbryt')}</button>
          {step === 2 && (
            <button disabled={hasIncompleteMapping} onClick={() => setStep(3)} style={{ padding: '9px 18px', background: hasIncompleteMapping ? 'var(--gray-300)' : BRAND.green, color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: hasIncompleteMapping ? 'not-allowed' : 'pointer' }}>
              {t('ui.forhandsgranska')}
            </button>
          )}
          {step === 3 && (
            <button disabled={busy || !canCommit} onClick={handleCommit} style={{ padding: '9px 18px', background: canCommit ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: (busy || !canCommit) ? 'not-allowed' : 'pointer' }}>
              {t('ui.importera')} {preview.verificationsToImport.length + (preview.openingVerification ? 1 : 0)} {t('ui.verifikationer')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
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

function SiePreviewStep({ preview, meta }) {
  const { accountsToAdd, verificationsToImport, openingVerification, unbalanced, warnings, alreadyImported } = preview;
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

      {unbalanced.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-red-bg)', color: 'var(--status-red-text)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '12.5px' }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{unbalanced.length} {t('ui.verifikation_er_balanserar_inte_debet_kredit_imp')}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12.5px', padding: '4px 10px', borderRadius: '999px', background: 'var(--status-green-bg)', color: 'var(--status-green-text)', fontWeight: 700 }}>{accountsToAdd.length} {t('ui.nya_konton')}</span>
        <span style={{ fontSize: '12.5px', padding: '4px 10px', borderRadius: '999px', background: 'var(--status-green-bg)', color: 'var(--status-green-text)', fontWeight: 700 }}>{verificationsToImport.length} {t('ui.verifikationer')}</span>
        {openingVerification && <span style={{ fontSize: '12.5px', padding: '4px 10px', borderRadius: '999px', background: openingVerification.balanced ? 'var(--status-green-bg)' : 'var(--status-red-bg)', color: openingVerification.balanced ? 'var(--status-green-text)' : 'var(--status-red-text)', fontWeight: 700 }}>{t('ui.n1_ingaende_balans_verifikation')}</span>}
        {warnings.length > 0 && <span style={{ fontSize: '12.5px', padding: '4px 10px', borderRadius: '999px', background: 'var(--status-amber-bg)', color: 'var(--status-amber-text)', fontWeight: 700 }}>{warnings.length} {t('ui.varningar')}</span>}
      </div>

      <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: warnings.length ? '12px' : 0 }}>
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

      {warnings.length > 0 && (
        <div style={{ maxHeight: '120px', overflowY: 'auto', background: 'var(--bg-muted)', borderRadius: '8px', padding: '10px 12px' }}>
          {warnings.map((w, i) => (
            <div key={i} style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: i < warnings.length - 1 ? '4px' : 0 }}>• {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}
