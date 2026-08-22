import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { EntitySearch, ProjectSearch } from './shared/SearchInputs';
import { SWEDISH_MUNICIPALITIES } from '../utils/kommuner';
import { validatePersonnummer, formatPersonnummerInput } from '../utils/personnummer';
import { EMPLOYMENT_TYPES, SALARY_FORMS, TAX_FORMS, TAX_TABLE_COLUMNS, VACATION_RULES, MIN_VACATION_DAYS } from '../utils/payrollConfig';
import { isValidIban } from '../utils/salaryPaymentFile';

const sectionStyle = { background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px', marginBottom: '16px' };
const sectionTitleStyle = { fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.03em' };
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' };
const helpTextStyle = { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 };
const errorTextStyle = { fontSize: '12px', color: 'var(--status-red-text)', marginTop: '6px' };
const inputBase = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
  borderRadius: '8px', fontSize: '14px', color: 'var(--text-main)',
  background: 'var(--bg-card)',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
function inputStyle(hasError) { return { ...inputBase, borderColor: hasError ? '#ef4444' : 'var(--border)' }; }
// gridTemplateColumns lever i CSS-klassen .form-row-2 (index.css) istället
// för här, se kommentaren i Contacts.jsx för varför.
const grid2 = { display: 'grid', gap: '16px' };
const grid3 = { display: 'grid', gap: '16px' }; // .form-row-3, samma skäl som grid2 ovan

function Section({ title, children }) {
  return <div style={sectionStyle}>{title && <h3 style={sectionTitleStyle}>{title}</h3>}{children}</div>;
}

function emptyEmployee() {
  return {
    firstName: '', lastName: '', ssn: '', email: '', phone: '',
    address: '', postalCode: '', city: '',
    employmentType: 'anstalld', startDate: '', endDate: '',
    employmentRate: 100, hoursPerWeek: 40, daysPerWeek: 5,
    salaryForm: 'manadslon', monthlySalary: '', hourlyRate: '',
    taxForm: 'a_skatt', secondaryIncome: false,
    municipality: '', taxTableMode: 'manual', taxTable: { tabellnr: '', kolumn: 1, year: new Date().getFullYear() },
    vacationRule: 'procentregeln', vacationDays: 25,
    costCenter: '', projectId: '',
    clearingNumber: '', accountNumber: '', iban: '', bic: '',
    active: true,
  };
}

export default function EmployeeForm({ initial, projects = [], onSave, onCancel }) {
  const [form, setForm] = useState(initial ? { ...emptyEmployee(), ...initial, taxTable: { ...emptyEmployee().taxTable, ...(initial.taxTable || {}) } } : emptyEmployee());
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setTaxTable = (patch) => setForm(f => ({ ...f, taxTable: { ...f.taxTable, ...patch } }));

  const validate = () => {
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = 'Förnamn krävs.';
    if (!form.lastName.trim()) errs.lastName = 'Efternamn krävs.';
    const pnr = validatePersonnummer(form.ssn);
    if (!pnr.valid) errs.ssn = pnr.error;
    if (!form.startDate) errs.startDate = 'Anställningsdatum krävs.';
    if (!form.municipality) errs.municipality = 'Folkbokföringskommun krävs.';
    // Bugkritiskt: tabellnummer krävs ALLTID, oavsett läge — "Välj kommun
    // ovan" (automatisk härledning) är inte implementerat än (kräver
    // Skatteverkets kommunala skattesatslista) och fick tidigare sparas
    // helt utan tabellnummer, vilket gjorde att skatteavdraget tyst
    // beräknades som 0 kr först vid en lönekörning — långt efter att
    // misstaget var lätt att upptäcka.
    if (!form.taxTable.tabellnr) errs.taxTable = 'Ange tabellnummer.';
    if (Number(form.vacationDays) < MIN_VACATION_DAYS) errs.vacationDays = `Minst ${MIN_VACATION_DAYS} semesterdagar krävs enligt semesterlagen.`;
    // IBAN är valfritt att fylla i (samma "kan sparas utan bankuppgifter"-
    // princip som clearing-/kontonummer nedan), men om den FYLLS I ska
    // kontrollsiffrorna faktiskt stämma — annars upptäcks felskrivningen
    // först när betalfilen redan ska genereras, långt senare.
    if (form.iban && !isValidIban(form.iban)) errs.iban = 'IBAN ser inte korrekt ut (fel format eller kontrollsiffror).';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({ ...form, ssn: formatPersonnummerInput(form.ssn) });
  };

  const hasBankInfo = Boolean(form.clearingNumber && form.accountNumber);

  return (
    <form onSubmit={handleSubmit}>
      <Section title="Personuppgifter">
        <div className="form-row-3" style={grid3}>
          <div>
            <label style={labelStyle}>Förnamn *</label>
            <input value={form.firstName} onChange={e => set('firstName', e.target.value)} style={inputStyle(errors.firstName)} />
            {errors.firstName && <div style={errorTextStyle}>{errors.firstName}</div>}
          </div>
          <div>
            <label style={labelStyle}>Efternamn *</label>
            <input value={form.lastName} onChange={e => set('lastName', e.target.value)} style={inputStyle(errors.lastName)} />
            {errors.lastName && <div style={errorTextStyle}>{errors.lastName}</div>}
          </div>
          <div>
            <label style={labelStyle}>Personnummer *</label>
            <input value={form.ssn} onChange={e => set('ssn', formatPersonnummerInput(e.target.value))} placeholder="ÅÅÅÅMMDD-XXXX" style={inputStyle(errors.ssn)} />
            {errors.ssn && <div style={errorTextStyle}>{errors.ssn}</div>}
          </div>
          <div>
            <label style={labelStyle}>E-post</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>Telefon</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>Postnummer</label>
            <input value={form.postalCode} onChange={e => set('postalCode', e.target.value)} style={inputBase} />
          </div>
          <div style={{ gridColumn: '1 / 3' }}>
            <label style={labelStyle}>Gatuadress</label>
            <input value={form.address} onChange={e => set('address', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>Ort</label>
            <input value={form.city} onChange={e => set('city', e.target.value)} style={inputBase} />
          </div>
        </div>
      </Section>

      <Section title="Anställning och lön">
        <div className="form-row-3" style={grid3}>
          <div>
            <label style={labelStyle}>Typ</label>
            <select value={form.employmentType} onChange={e => set('employmentType', e.target.value)} style={{ ...inputBase, background: 'var(--bg-card)' }}>
              {EMPLOYMENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Anställningsdatum *</label>
            <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} style={inputStyle(errors.startDate)} />
            {errors.startDate && <div style={errorTextStyle}>{errors.startDate}</div>}
          </div>
          <div>
            <label style={labelStyle}>Slutdatum</label>
            <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} style={inputBase} placeholder="Lämna tomt vid pågående anställning" />
          </div>
          <div>
            <label style={labelStyle}>Sysselsättningsgrad (%)</label>
            <input type="number" min="0" max="100" value={form.employmentRate} onChange={e => set('employmentRate', Number(e.target.value))} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>Timmar per vecka</label>
            <input type="number" min="0" value={form.hoursPerWeek} onChange={e => set('hoursPerWeek', Number(e.target.value))} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>Arbetsdagar per vecka</label>
            <input type="number" min="0" max="7" value={form.daysPerWeek} onChange={e => set('daysPerWeek', Number(e.target.value))} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>Löneform</label>
            <select value={form.salaryForm} onChange={e => set('salaryForm', e.target.value)} style={{ ...inputBase, background: 'var(--bg-card)' }}>
              {SALARY_FORMS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          {form.salaryForm === 'manadslon' ? (
            <div>
              <label style={labelStyle}>Månadslön (brutto)</label>
              <input type="number" min="0" value={form.monthlySalary} onChange={e => set('monthlySalary', e.target.value)} style={inputBase} />
            </div>
          ) : (
            <div style={{ gridColumn: '2 / 4' }}>
              <label style={labelStyle}>Timlön</label>
              <input type="number" min="0" value={form.hourlyRate} onChange={e => set('hourlyRate', e.target.value)} style={inputBase} />
              <p style={helpTextStyle}>Arbetade timmar registreras per lönekörning, kopplat till tidrapportering under Projekt.</p>
            </div>
          )}
        </div>
      </Section>

      <Section title="Skatt">
        <div className="form-row-2" style={grid2}>
          <div>
            <label style={labelStyle}>Skatteform</label>
            <select value={form.taxForm} onChange={e => set('taxForm', e.target.value)} style={{ ...inputBase, background: 'var(--bg-card)' }}>
              {TAX_FORMS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '26px' }}>
            <input type="checkbox" id="secondaryIncome" checked={form.secondaryIncome} onChange={e => set('secondaryIncome', e.target.checked)} />
            <label htmlFor="secondaryIncome" style={{ fontSize: '13.5px', color: 'var(--text-main)', cursor: 'pointer' }}>Sidoinkomst (30 % skatteavdrag)</label>
          </div>
        </div>
        {form.taxForm === 'ej_verifierad' && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '8px', padding: '10px 12px', marginTop: '4px', fontSize: '12.5px', color: 'var(--status-amber-text)' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Skatteformen bör verifieras innan första lönekörningen.</span>
          </div>
        )}

        <div style={{ marginTop: '16px' }}>
          <label style={labelStyle}>Folkbokföringskommun *</label>
          <EntitySearch
            value={form.municipality}
            onChange={v => set('municipality', v)}
            items={SWEDISH_MUNICIPALITIES.map(m => ({ id: m, name: m }))}
            placeholder="Sök kommun..."
          />
          {errors.municipality && <div style={errorTextStyle}>{errors.municipality}</div>}
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={labelStyle}>Skattetabell (tabellnummer) *</label>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 8px' }}>
            Hittas på den anställdas skattsedel/Skatteverkets tabellsök. Automatisk härledning från kommun är inte byggd ännu (kräver Skatteverkets kommunala skattesatslista) — tabellnumret måste anges här för att skatteavdraget ska kunna beräknas.
          </p>
          <input
            type="text" inputMode="numeric" value={form.taxTable.tabellnr}
            onChange={e => setTaxTable({ tabellnr: e.target.value.replace(/\D/g, '') })}
            placeholder="T.ex. 32" style={{ ...inputStyle(errors.taxTable), maxWidth: '160px' }}
          />
          {errors.taxTable && <div style={errorTextStyle}>{errors.taxTable}</div>}
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={labelStyle}>Kolumn</label>
          <select value={form.taxTable.kolumn} onChange={e => setTaxTable({ kolumn: Number(e.target.value) })} style={{ ...inputBase, background: 'var(--bg-card)' }}>
            {TAX_TABLE_COLUMNS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </Section>

      <Section title="Semester">
        <div className="form-row-2" style={grid2}>
          <div>
            <label style={labelStyle}>Semesterregel</label>
            <select value={form.vacationRule} onChange={e => set('vacationRule', e.target.value)} style={{ ...inputBase, background: 'var(--bg-card)' }}>
              {VACATION_RULES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Semesterdagar per år</label>
            <input type="number" value={form.vacationDays} onChange={e => set('vacationDays', Number(e.target.value))} style={inputStyle(errors.vacationDays)} />
            <p style={helpTextStyle}>Lagstadgat minimum: {MIN_VACATION_DAYS} dagar</p>
            {errors.vacationDays && <div style={errorTextStyle}>{errors.vacationDays}</div>}
          </div>
        </div>
      </Section>

      <Section title="Kostnadsställe / Projekt">
        <div className="form-row-2" style={grid2}>
          <div>
            <label style={labelStyle}>Kostnadsställe</label>
            <input value={form.costCenter} onChange={e => set('costCenter', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>Projekt</label>
            <ProjectSearch value={form.projectId} onChange={v => set('projectId', v)} projects={projects} />
          </div>
        </div>
        <p style={helpTextStyle}>Föreslås på lönekostnadsrader vid bokföring av lönekörningar.</p>
      </Section>

      <Section title="Bankkonto">
        <div className="form-row-2" style={grid2}>
          <div>
            <label style={labelStyle}>Clearingnummer</label>
            <input value={form.clearingNumber} onChange={e => set('clearingNumber', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>Kontonummer</label>
            <input value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} style={inputBase} />
          </div>
        </div>
        {!hasBankInfo && (
          <p style={{ ...helpTextStyle, color: 'var(--status-amber-text)' }}>
            Kan sparas utan bankkontouppgifter för förberedelse, men blockeras från lönekörning tills clearing- och kontonummer är ifyllda.
          </p>
        )}

        {/* IBAN/BIC är det som faktiskt skrivs in i betalfilen (ISO 20022
            pain.001) — clearing-/kontonummer ovan räcker inte där, det
            finns ingen bankoberoende regel för att räkna om det till IBAN.
            Utan dessa exkluderas den anställda tyst från betalfilen (och
            det syns tydligt i lönekörningen), men det stoppar inte
            körningen som helhet. */}
        <div className="form-row-2" style={{ ...grid2, marginTop: '16px' }}>
          <div>
            <label style={labelStyle}>IBAN</label>
            <input value={form.iban} onChange={e => set('iban', e.target.value.toUpperCase())} style={inputStyle(errors.iban)} placeholder="SE35 5000 0000 0549 1000 0003" />
            {errors.iban && <div style={errorTextStyle}>{errors.iban}</div>}
          </div>
          <div>
            <label style={labelStyle}>BIC/SWIFT</label>
            <input value={form.bic} onChange={e => set('bic', e.target.value.toUpperCase())} style={inputBase} placeholder="SWEDSESS" />
          </div>
        </div>
        <p style={helpTextStyle}>Krävs för att den anställda ska tas med i den nedladdningsbara betalfilen till banken vid lönekörning.</p>
      </Section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button type="button" onClick={onCancel} style={{ padding: '9px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>Avbryt</button>
        <button type="submit" style={{ padding: '9px 18px', background: '#1a3028', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'white', cursor: 'pointer' }}>Spara anställd</button>
      </div>
    </form>
  );
}
