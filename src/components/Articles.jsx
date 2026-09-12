import React, { useMemo, useRef, useState } from 'react';
import { Plus, Download, Upload, Trash2, Pencil, Check, AlertTriangle, Search, ChevronDown, ChevronRight } from 'lucide-react';
import ListPageHeader, { ListFilterBar, listSearchInputStyle } from './shared/ListPageHeader';
import ListTable from './shared/ListTable';
import { AccountSearch } from './shared/SearchInputs';
import { confirmDialog } from './shared/ConfirmDialog';
import { articlesToCsv, csvToArticles, downloadCsv } from '../utils/csvRegister';

const fmt = (val) => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(val || 0);

const inp = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '9px',
  fontSize: '14px', color: 'var(--text-main)', background: 'var(--bg-card)', outline: 'none',
  transition: 'all 0.15s', fontFamily: 'inherit', boxSizing: 'border-box',
};
const lbl = { display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' };
const req = <span style={{ color: 'var(--status-red-text)' }}> *</span>;

// Samma kort-sektionsmönster som Contacts.jsx (CustomerForm: "Ny kund") —
// se kommentaren vid redigeringsläget nedan för varför.
const sectionStyle = { background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px', marginBottom: '16px' };
const sectionTitleStyle = { fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.03em' };
// gridTemplateColumns lever i CSS-klassen .form-row-2 (index.css), inte här
// — se samma kommentar i Contacts.jsx för varför (mobilens 1-kolumns-
// överskrivning kan annars inte nå en inline style).
const grid2 = { display: 'grid', gap: '16px' };

const UNITS = ['st', 'tim', 'kr', 'm', 'm²', 'kg', 'dag'];
const ROT_RUT_OPTIONS = [
  { value: 'none', label: 'Ingen' },
  { value: 'rot', label: 'ROT' },
  { value: 'rut', label: 'RUT' },
];

const newArticleId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `art_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const emptyArticle = () => ({
  type: 'tjanst', articleNumber: '', description: '', descriptionEn: '',
  unitPrice: 0, purchasePrice: '', unit: 'st', vatRate: 25, account: '3001',
  ean: '', rotRut: 'none', notes: '',
});

/**
 * Produkt-/artikelregistret — tidigare en liten modal (`ArticleRegisterModal`
 * i Invoices.jsx) man bara hittade via en diskret textlänk. Kundönskemål:
 * en riktig, hittbar sida ("en site där det står artiklar") som nås direkt
 * från profilmenyn (App.jsx), och samma register ska gå att välja från BÅDE
 * fakturor (Invoices.jsx: findArticleByNumber/applyArticleToRow) OCH offerter
 * (Quotes.jsx: matchar på benämning, se den filens findArticleByDescription).
 *
 * Kundfeedback (två omgångar):
 * 1) Formuläret kändes tomt (bara Artikelnr/Konto/Benämning/Pris/Moms) —
 *    bytte Artikelnr från obligatoriskt till valfritt "Fler fält"-fält
 *    (Benämning är den riktiga identiteten nu, som Fortnox/Bokio) och la
 *    till fler fält (Typ, Enhet, Inköpspris, EAN, ROT/RUT, Anteckningar,
 *    engelsk benämning).
 * 2) "Sökfältet ska vara i headern, ingen padding på sidorna, listan ska
 *    ligga direkt under headern" — bytte den fristående sökraden + en
 *    hemsnickrad <table> mot EXAKT samma "facit"-mönster som Offerter/
 *    Bokföring/Bank redan använder: ListPageHeader → ListFilterBar (sökfältet
 *    bor DÄR, i samma kort som headern, inte löst i innehållsytan) → en
 *    flush ListTable utan padding runt. Redigeringsläget blev av samma skäl
 *    en EGEN sida (egen ListPageHeader med Avbryt/Spara) istället för ett
 *    inline-kort ovanpå listan — samma mönster som QuoteEditor (Quotes.jsx).
 *
 * Samma company-data-fält (`articles`/`setArticles`) som redan finns i
 * App.jsx. Identitet: `id` (ny, tilldelas här) är den riktiga nyckeln —
 * Artikelnr är bara en valfri, mänsklig etikett numera och kan vara tomt.
 * Redigering/borttagning spårar den FAKTISKA arrayobjekt-referensen
 * (`editingOriginal`/`remove(a)` filtrerar på `x !== a`) istället för att
 * anta att id eller artikelnr finns — funkar därför även för gamla poster
 * som sparades innan `id` fanns.
 */
export default function Articles({ articles = [], setArticles, accounts = [] }) {
  const [editing, setEditing] = useState(null);
  const [editingOriginal, setEditingOriginal] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [importMsg, setImportMsg] = useState(null);
  const importFileRef = useRef(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(a =>
      (a.articleNumber || '').toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q) ||
      (a.ean || '').toLowerCase().includes(q)
    );
  }, [articles, search]);

  const startNew = () => { setEditing(emptyArticle()); setEditingOriginal(null); setMoreOpen(false); };
  const startEdit = (a) => {
    setEditing({ ...emptyArticle(), ...a });
    setEditingOriginal(a);
    setMoreOpen(Boolean((a.articleNumber || a.descriptionEn || a.purchasePrice || a.ean || (a.rotRut && a.rotRut !== 'none') || a.notes)));
  };
  const cancelEdit = () => { setEditing(null); setEditingOriginal(null); };

  const handleExportCsv = () => downloadCsv(`artiklar_${new Date().toISOString().split('T')[0]}.csv`, articlesToCsv(articles));
  const handleImportClick = () => importFileRef.current?.click();
  // Uppdaterar (matchar på artikelnr, när satt) om artikeln redan finns,
  // annars läggs en ny till — rader utan artikelnr i CSV:n blir alltid nya.
  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = csvToArticles(ev.target.result);
        if (imported.length === 0) throw new Error('Inga giltiga rader hittades (kräver minst en "Benämning").');
        let added = 0, updated = 0;
        setArticles(prev => {
          const next = [...prev];
          imported.forEach(item => {
            const num = (item.articleNumber || '').trim().toLowerCase();
            const idx = num ? next.findIndex(a => (a.articleNumber || '').trim().toLowerCase() === num) : -1;
            const withId = { id: (idx !== -1 && next[idx].id) || newArticleId(), ...item };
            if (idx === -1) { next.push(withId); added++; }
            else { next[idx] = withId; updated++; }
          });
          return next;
        });
        setImportMsg({ type: 'success', text: `${added} ny${added === 1 ? '' : 'a'}, ${updated} uppdaterad${updated === 1 ? '' : 'e'}.` });
      } catch (err) {
        setImportMsg({ type: 'error', text: `Kunde inte importera: ${err.message}` });
      }
      setTimeout(() => setImportMsg(null), 6000);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const save = () => {
    const description = (editing.description || '').trim();
    if (!description) return;
    const next = { ...editing, description, articleNumber: (editing.articleNumber || '').trim(), id: editing.id || newArticleId() };
    setArticles(prev => {
      const idx = editingOriginal ? prev.indexOf(editingOriginal) : -1;
      if (idx !== -1) return prev.map((a, i) => i === idx ? next : a);
      return [...prev, next];
    });
    cancelEdit();
  };

  const remove = async (a) => {
    const label = a.description || a.articleNumber || 'artikeln';
    if (!(await confirmDialog(`Ta bort "${label}" från registret? Redan sparade fakturor och offerter påverkas inte.`, { danger: true }))) return;
    setArticles(prev => prev.filter(x => x !== a));
  };

  // ── Redigeringsläge: kundfeedback ("ska se ut som Ny kund, inte så mycket
  // tomrum") — samma inline-mönster som Contacts.jsx (CustomerForm): en
  // enkel "← Tillbaka | Ny artikel"-rad, inga egna ListPageHeader/sidbyte,
  // och fälten grupperade i kompakta kort-sektioner (sectionStyle) med en
  // 2-kolumns-grid istället för en smal, flytande maxWidth-ruta mitt i en
  // annars tom sida. ──
  if (editing) {
    const canSave = Boolean(editing.description.trim());
    return (
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'var(--bg-page)' }}>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <button type="button" onClick={cancelEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', padding: 0 }}>← Tillbaka</button>
            <span style={{ color: 'var(--border)' }}>|</span>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              {editingOriginal ? 'Ändra artikel' : 'Ny artikel'}
            </h2>
          </div>

          <form onSubmit={e => { e.preventDefault(); save(); }}>
            <div style={sectionStyle}>
              <h3 style={sectionTitleStyle}>Grunduppgifter</h3>
              <div className="form-row-2" style={grid2}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>Benämning{req}</label>
                  <input style={inp} value={editing.description} onChange={e => setEditing(s => ({ ...s, description: e.target.value }))} placeholder="T.ex. Konsulttimme" />
                </div>
                <div>
                  <label style={lbl}>Typ</label>
                  <select style={inp} value={editing.type} onChange={e => setEditing(s => ({ ...s, type: e.target.value }))}>
                    <option value="vara">Vara</option>
                    <option value="tjanst">Tjänst</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Enhet</label>
                  <select style={inp} value={editing.unit} onChange={e => setEditing(s => ({ ...s, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Pris exkl. moms{req}</label>
                  <div style={{ position: 'relative' }}>
                    <input type="number" style={{ ...inp, paddingRight: '44px' }} value={editing.unitPrice} onChange={e => setEditing(s => ({ ...s, unitPrice: Number(e.target.value) }))} />
                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>SEK</span>
                  </div>
                </div>
                <div>
                  <label style={lbl}>Moms</label>
                  <select style={inp} value={editing.vatRate} onChange={e => setEditing(s => ({ ...s, vatRate: Number(e.target.value) }))}>
                    {[0, 6, 12, 25].map(r => <option key={r} value={r}>{r} %</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={sectionStyle}>
              <h3 style={sectionTitleStyle}>Bokföring</h3>
              <label style={lbl}>Bokföringskonto</label>
              <AccountSearch value={editing.account} onChange={code => setEditing(s => ({ ...s, account: code }))} accounts={accounts} placeholder="Sök konto…" />
            </div>

            <div style={sectionStyle}>
              <button
                type="button"
                onClick={() => setMoreOpen(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: 0, background: 'none', border: 'none', cursor: 'pointer', ...sectionTitleStyle, marginBottom: moreOpen ? '16px' : 0 }}
              >
                {moreOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Fler fält
              </button>
              {moreOpen && (
                <div className="form-row-2" style={grid2}>
                  <div>
                    <label style={lbl}>Artikelnummer</label>
                    <input style={inp} value={editing.articleNumber} onChange={e => setEditing(s => ({ ...s, articleNumber: e.target.value }))} placeholder="t.ex. 1001" />
                  </div>
                  <div>
                    <label style={lbl}>Inköpspris</label>
                    <input type="number" style={inp} value={editing.purchasePrice} onChange={e => setEditing(s => ({ ...s, purchasePrice: e.target.value === '' ? '' : Number(e.target.value) }))} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={lbl}>Benämning (engelska)</label>
                    <input style={inp} value={editing.descriptionEn} onChange={e => setEditing(s => ({ ...s, descriptionEn: e.target.value }))} placeholder="T.ex. Consulting hour" />
                  </div>
                  <div>
                    <label style={lbl}>EAN/streckkod</label>
                    <input style={inp} value={editing.ean} onChange={e => setEditing(s => ({ ...s, ean: e.target.value }))} placeholder="t.ex. 7350000000000" />
                  </div>
                  <div>
                    <label style={lbl}>ROT/RUT</label>
                    <select style={inp} value={editing.rotRut} onChange={e => setEditing(s => ({ ...s, rotRut: e.target.value }))}>
                      {ROT_RUT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={lbl}>Anteckningar</label>
                    <textarea style={{ ...inp, resize: 'vertical', minHeight: '64px' }} value={editing.notes} onChange={e => setEditing(s => ({ ...s, notes: e.target.value }))} placeholder="Interna anteckningar om artikeln…" />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={cancelEdit} style={{ padding: '9px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
                Avbryt
              </button>
              <button type="submit" disabled={!canSave} style={{ padding: '9px 18px', background: 'var(--accent)', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'white', cursor: canSave ? 'pointer' : 'not-allowed', opacity: canSave ? 1 : 0.6 }}>
                Spara artikel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── Listläge: samma "facit" som Offerter/Bokföring/Bank — sökfältet bor
  // i ListFilterBar (en del av headerkortet), och listan sitter flush direkt
  // under, utan sidopadding. ──
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <ListPageHeader
        title="Artikel"
        subtitle="Ditt artikelregister — välj samma artiklar direkt på fakturor och offerter"
        actions={[
          { label: 'Exportera', icon: Download, onClick: handleExportCsv, variant: 'secondary' },
          { label: 'Importera', icon: Upload, onClick: handleImportClick, variant: 'secondary' },
          { label: 'Ny artikel', icon: Plus, onClick: startNew, variant: 'primary' },
        ]}
      >
        {importMsg && (
          <div style={{ margin: '12px 0 0', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', background: importMsg.type === 'success' ? 'var(--status-green-bg)' : 'var(--status-red-bg)', color: importMsg.type === 'success' ? 'var(--status-green-text)' : 'var(--status-red-text)' }}>
            {importMsg.type === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}
            {importMsg.text}
          </div>
        )}
      </ListPageHeader>
      <input type="file" ref={importFileRef} accept=".csv" style={{ display: 'none' }} onChange={handleImportFile} />

      <ListFilterBar count={filtered.length} countLabel={filtered.length === 1 ? 'artikel' : 'artiklar'}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Sök benämning, artikelnr eller EAN…" value={search} onChange={e => setSearch(e.target.value)} style={listSearchInputStyle} />
        </div>
      </ListFilterBar>

      {/* Flush direkt under filterraden, ingen padding — samma "facit" som
          Offerter/Bokföring/Bank. */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <ListTable
          rowKey={a => a.id || a.articleNumber}
          rows={filtered}
          onRowClick={startEdit}
          emptyMessage={articles.length === 0 ? 'Inga artiklar sparade ännu — lägg till din första produkt eller tjänst ovan.' : 'Inga artiklar matchar sökningen.'}
          mobileList={a => ({
            primary: a.description,
            amount: `${fmt(a.unitPrice)} kr`,
            meta: a.articleNumber ? `${a.articleNumber} · Moms ${a.vatRate}%` : `Moms ${a.vatRate}%`,
          })}
          columns={[
            { key: 'description', label: 'Benämning', fontWeight: 600, color: 'var(--text-main)', render: a => a.description },
            { key: 'articleNumber', label: 'Artikelnr', render: a => a.articleNumber || '—' },
            { key: 'unitPrice', label: 'Pris', align: 'right', color: 'var(--text-main)', render: a => `${fmt(a.unitPrice)} kr` },
            { key: 'vatRate', label: 'Moms', align: 'right', render: a => `${a.vatRate}%` },
            {
              key: 'actions', label: '', align: 'right', width: 80,
              render: a => (
                <span onClick={e => e.stopPropagation()}>
                  <button onClick={() => startEdit(a)} title="Ändra" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', marginRight: '10px', padding: '2px' }}><Pencil size={14} /></button>
                  <button onClick={() => remove(a)} title="Ta bort" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px' }}><Trash2 size={14} /></button>
                </span>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
