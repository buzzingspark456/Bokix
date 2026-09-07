import React, { useState, useMemo } from 'react';
import { UploadCloud, AlertCircle, AlertTriangle, X, HelpCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { BRAND } from '../utils/brandColors';
import { AccountSearch } from './shared/SearchInputs';
import { ProgramLogo } from './shared/BrandLogos';
import { MIGRATION_SOURCES, OTHER_PROGRAM_HINT, MENU_MOVED_HINT } from '../utils/migrationSources';

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
const STEP_LABELS = ['Program', 'Fil', 'Kontomappning', 'Förhandsgranskning'];

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
        throw new Error('Hittade varken konton eller verifikationer i filen. Kontrollera att det är en giltig SIE4-fil.');
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
      setError(e.message || 'Kunde inte läsa eller tolka filen.');
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

    const importVerifications = parsed.verifications.map(v => ({
      series: v.series,
      date: v.date,
      description: v.description,
      sieNumber: v.sieNumber,
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
          <span className="modal-title">Importera bokföring (SIE4)</span>
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
              {busy ? 'Läser filen...' : 'Ladda upp SIE4-fil'}
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 6px' }}>Dra och släpp filen här, eller klicka för att välja</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>.SI, .SE eller .SIE — exporterat från ditt tidigare bokföringsprogram</p>
          </div>
        )}

        {step === 2 && (
          <AccountMappingStep rows={accountRows} setRows={setAccountRows} existingAccounts={accounts} />
        )}

        {step === 3 && preview && (
          <SiePreviewStep preview={preview} meta={parsed?.meta} />
        )}

        <div className="modal-footer">
          {step > 1 && <button onClick={() => setStep(s => s - 1)} style={{ padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>Tillbaka</button>}
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>Avbryt</button>
          {step === 2 && (
            <button disabled={hasIncompleteMapping} onClick={() => setStep(3)} style={{ padding: '9px 18px', background: hasIncompleteMapping ? 'var(--gray-300)' : BRAND.green, color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: hasIncompleteMapping ? 'not-allowed' : 'pointer' }}>
              Förhandsgranska
            </button>
          )}
          {step === 3 && (
            <button disabled={busy || !canCommit} onClick={handleCommit} style={{ padding: '9px 18px', background: canCommit ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: (busy || !canCommit) ? 'not-allowed' : 'pointer' }}>
              Importera {preview.verificationsToImport.length + (preview.openingVerification ? 1 : 0)} verifikationer
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
        Vilket program bokförde du i tidigare? Vi visar var du hittar SIE-exporten där — importen i sig fungerar likadant oavsett program, SIE4 är samma filstandard.
      </p>
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
          Annat program
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
        Jag har filen, fortsätt <ArrowRight size={15} />
      </button>
    </div>
  );
}

function AccountMappingStep({ rows, setRows, existingAccounts }) {
  const matched = rows.filter(r => r.status === 'match');
  const flagged = rows.filter(r => r.status !== 'match');

  const update = (code, patch) => setRows(prev => prev.map(r => r.code === code ? { ...r, ...patch } : r));

  return (
    <div>
      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
        {matched.length} konton matchar redan din befintliga kontoplan exakt. {flagged.length > 0 ? `${flagged.length} behöver ett snabbt beslut nedan.` : ''}
      </p>

      {flagged.length === 0 && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '12px 14px', background: 'var(--status-green-bg)', color: 'var(--status-green-text)', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600 }}>
          <CheckCircle2 size={15} /> Alla konton matchar redan — inget att mappa.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {flagged.map(row => (
          <div key={row.code} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', background: 'var(--bg-card)' }}>
            {row.status === 'name-conflict' ? (
              <div style={{ fontSize: '12.5px', color: 'var(--text-main)' }}>
                <strong>{row.code}</strong> finns redan som "<strong>{row.existingName}</strong>" — importfilen kallar det "{row.importedName}". Det befintliga namnet behålls (kontonamnet ändras inte automatiskt).
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-main)', marginBottom: '8px' }}>
                  <strong>{row.code}</strong> "{row.importedName}" finns inte i din kontoplan.
                </div>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="radio" checked={row.add} onChange={() => update(row.code, { add: true, remapTo: '' })} />
                    Lägg till som nytt konto
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="radio" checked={!row.add} onChange={() => update(row.code, { add: false })} />
                    Bokför istället på ett befintligt konto:
                  </label>
                  {!row.add && (
                    <div style={{ minWidth: '220px' }}>
                      <AccountSearch value={row.remapTo} onChange={(code) => update(row.code, { remapTo: code })} accounts={existingAccounts} placeholder="Sök konto..." compact />
                    </div>
                  )}
                </div>
                {!row.add && !row.remapTo && (
                  <div style={{ fontSize: '11.5px', color: 'var(--status-amber-text)', marginTop: '6px' }}>Välj ett konto att mappa till innan du fortsätter.</div>
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
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px' }}>Importerad från: {meta.program}</p>
      )}

      {alreadyImported && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-amber-bg)', color: 'var(--status-amber-text)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '12.5px' }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Den här filen verkar redan ha importerats tidigare. Fortsätter du ändå bokförs allt en gång till.</span>
        </div>
      )}

      {unbalanced.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-red-bg)', color: 'var(--status-red-text)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '12.5px' }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{unbalanced.length} verifikation(er) balanserar inte (debet ≠ kredit) — importen är blockerad tills det är rättat i källfilen.</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12.5px', padding: '4px 10px', borderRadius: '999px', background: 'var(--status-green-bg)', color: 'var(--status-green-text)', fontWeight: 700 }}>{accountsToAdd.length} nya konton</span>
        <span style={{ fontSize: '12.5px', padding: '4px 10px', borderRadius: '999px', background: 'var(--status-green-bg)', color: 'var(--status-green-text)', fontWeight: 700 }}>{verificationsToImport.length} verifikationer</span>
        {openingVerification && <span style={{ fontSize: '12.5px', padding: '4px 10px', borderRadius: '999px', background: openingVerification.balanced ? 'var(--status-green-bg)' : 'var(--status-red-bg)', color: openingVerification.balanced ? 'var(--status-green-text)' : 'var(--status-red-text)', fontWeight: 700 }}>1 ingående balans-verifikation</span>}
        {warnings.length > 0 && <span style={{ fontSize: '12.5px', padding: '4px 10px', borderRadius: '999px', background: 'var(--status-amber-bg)', color: 'var(--status-amber-text)', fontWeight: 700 }}>{warnings.length} varningar</span>}
      </div>

      <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: warnings.length ? '12px' : 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
          <thead>
            <tr style={{ background: 'var(--bg-muted)', position: 'sticky', top: 0 }}>
              <th style={{ textAlign: 'left', padding: '8px 10px' }}>Datum</th>
              <th style={{ textAlign: 'left', padding: '8px 10px' }}>Beskrivning</th>
              <th style={{ textAlign: 'left', padding: '8px 10px' }}>Serie</th>
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
        {allRows.length > 200 && <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>+ {allRows.length - 200} till...</div>}
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
