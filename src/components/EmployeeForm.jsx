import React, { useState } from 'react';
import { AlertTriangle } from './icons';
import { EntitySearch, ProjectSearch } from './shared/SearchInputs';
import { SWEDISH_MUNICIPALITIES } from '../utils/kommuner';
import { suggestTaxTables, KOMMUN_SKATTETABELLER_ÅR } from '../utils/kommunSkattetabell';
import { validatePersonnummer, formatPersonnummerInput } from '../utils/personnummer';
import { EMPLOYMENT_TYPES, SALARY_FORMS, TAX_FORMS, TAX_TABLE_COLUMNS, VACATION_RULES, MIN_VACATION_DAYS } from '../utils/payrollConfig';
import { isValidIban } from '../utils/salaryPaymentFile';
import { summarizeVacation } from '../utils/vacation';
import { BRAND } from '../utils/brandColors';
import { MobileFormBar } from './shared/MobileForm';
import { t as tr } from '../i18n';

const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);

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
    vacationRule: 'procentregeln', vacationDays: 25, savedVacationDays: 0,
    costCenter: '', projectId: '',
    clearingNumber: '', accountNumber: '', iban: '', bic: '',
    active: true,
  };
}

export default function EmployeeForm({ initial, projects = [], payrollRuns = [], onSave, onCancel }) {
  const [form, setForm] = useState(initial ? { ...emptyEmployee(), ...initial, taxTable: { ...emptyEmployee().taxTable, ...(initial.taxTable || {}) } } : emptyEmployee());
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  // Kundönskemål: semester-sektionen visade tidigare bara redigerbara fält
  // (regel/dagar/sparat) utan att någonsin säga var den anställda FAKTISKT
  // står — samma uträkning som företagets Semester-flik (VacationOverview),
  // fast för den här enda anställda. Bara för en REDAN sparad anställd
  // (`initial`) — en ännu osparad har inga lönekörningar att räkna mot.
  const vacationSummary = initial ? summarizeVacation({ employee: form, payrollRuns }) : null;
  const setTaxTable = (patch) => setForm(f => ({ ...f, taxTable: { ...f.taxTable, ...patch } }));

  const validate = () => {
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = tr('ui.fornamn_kravs');
    if (!form.lastName.trim()) errs.lastName = tr('ui.efternamn_kravs');
    const pnr = validatePersonnummer(form.ssn);
    if (!pnr.valid) errs.ssn = pnr.error;
    if (!form.startDate) errs.startDate = tr('ui.anstallningsdatum_kravs');
    if (!form.municipality) errs.municipality = tr('ui.folkbokforingskommun_kravs');
    // Bugkritiskt: tabellnummer krävs ALLTID, oavsett läge — "Välj kommun
    // ovan" (automatisk härledning) är inte implementerat än (kräver
    // Skatteverkets kommunala skattesatslista) och fick tidigare sparas
    // helt utan tabellnummer, vilket gjorde att skatteavdraget tyst
    // beräknades som 0 kr först vid en lönekörning — långt efter att
    // misstaget var lätt att upptäcka.
    if (!form.taxTable.tabellnr) errs.taxTable = tr('ui.valj_skattetabell');
    if (Number(form.vacationDays) < MIN_VACATION_DAYS) errs.vacationDays = tr('ui.minst_semesterdagar', { n: MIN_VACATION_DAYS });
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
    <form id="employee-form" onSubmit={handleSubmit}>
      <MobileFormBar>
        <button type="submit" form="employee-form" className="mform-bar-primary">{tr('ui.spara_anstalld')}</button>
      </MobileFormBar>
      <Section title={tr('ui.personuppgifter')}>
        <div className="form-row-3" style={grid3}>
          <div>
            <label style={labelStyle}>{tr('ui.fornamn_2')}</label>
            <input value={form.firstName} onChange={e => set('firstName', e.target.value)} style={inputStyle(errors.firstName)} />
            {errors.firstName && <div style={errorTextStyle}>{errors.firstName}</div>}
          </div>
          <div>
            <label style={labelStyle}>{tr('ui.efternamn_2')}</label>
            <input value={form.lastName} onChange={e => set('lastName', e.target.value)} style={inputStyle(errors.lastName)} />
            {errors.lastName && <div style={errorTextStyle}>{errors.lastName}</div>}
          </div>
          <div>
            <label style={labelStyle}>{tr('ui.personnummer')}</label>
            <input value={form.ssn} onChange={e => set('ssn', formatPersonnummerInput(e.target.value))} placeholder={tr('ui.aaaammdd_xxxx')} style={inputStyle(errors.ssn)} />
            {errors.ssn && <div style={errorTextStyle}>{errors.ssn}</div>}
          </div>
          <div>
            <label style={labelStyle}>{tr('ui.e_post')}</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>{tr('ui.telefon')}</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>{tr('ui.postnummer')}</label>
            <input value={form.postalCode} onChange={e => set('postalCode', e.target.value)} style={inputBase} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>{tr('ui.gatuadress')}</label>
            <input value={form.address} onChange={e => set('address', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>{tr('ui.ort')}</label>
            <input value={form.city} onChange={e => set('city', e.target.value)} style={inputBase} />
          </div>
        </div>
      </Section>

      <Section title={tr('ui.anstallning_och_lon')}>
        <div className="form-row-3" style={grid3}>
          <div>
            <label style={labelStyle}>{tr('ui.typ')}</label>
            <select value={form.employmentType} onChange={e => set('employmentType', e.target.value)} style={{ ...inputBase, background: 'var(--bg-card)' }}>
              {EMPLOYMENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{tr('ui.anstallningsdatum')}</label>
            <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} style={inputStyle(errors.startDate)} />
            {errors.startDate && <div style={errorTextStyle}>{errors.startDate}</div>}
          </div>
          <div>
            <label style={labelStyle}>{tr('ui.slutdatum')}</label>
            <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} style={inputBase} placeholder={tr('ui.lamna_tomt_vid_pagaende_anstallning')} />
          </div>
          <div>
            <label style={labelStyle}>{tr('ui.sysselsattningsgrad')}</label>
            <input type="number" min="0" max="100" value={form.employmentRate} onChange={e => set('employmentRate', Number(e.target.value))} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>{tr('ui.timmar_per_vecka')}</label>
            <input type="number" min="0" value={form.hoursPerWeek} onChange={e => set('hoursPerWeek', Number(e.target.value))} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>{tr('ui.arbetsdagar_per_vecka')}</label>
            <input type="number" min="0" max="7" value={form.daysPerWeek} onChange={e => set('daysPerWeek', Number(e.target.value))} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>{tr('ui.loneform')}</label>
            <select value={form.salaryForm} onChange={e => set('salaryForm', e.target.value)} style={{ ...inputBase, background: 'var(--bg-card)' }}>
              {SALARY_FORMS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          {form.salaryForm === 'manadslon' ? (
            <div>
              <label style={labelStyle}>{tr('ui.manadslon_brutto')}</label>
              <input type="number" min="0" value={form.monthlySalary} onChange={e => set('monthlySalary', e.target.value)} style={inputBase} />
            </div>
          ) : (
            <div style={{ gridColumn: '2 / 4' }}>
              <label style={labelStyle}>{tr('ui.timlon')}</label>
              <input type="number" min="0" value={form.hourlyRate} onChange={e => set('hourlyRate', e.target.value)} style={inputBase} />
              <p style={helpTextStyle}>{tr('ui.arbetade_timmar_registreras_per_lonekorning_kopp')}</p>
            </div>
          )}
        </div>
      </Section>

      <Section title={tr('ui.skatt')}>
        <div className="form-row-2" style={grid2}>
          <div>
            <label style={labelStyle}>{tr('ui.skatteform')}</label>
            <select value={form.taxForm} onChange={e => set('taxForm', e.target.value)} style={{ ...inputBase, background: 'var(--bg-card)' }}>
              {TAX_FORMS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '26px' }}>
            <input type="checkbox" id="secondaryIncome" checked={form.secondaryIncome} onChange={e => set('secondaryIncome', e.target.checked)} />
            <label htmlFor="secondaryIncome" style={{ fontSize: '13.5px', color: 'var(--text-main)', cursor: 'pointer' }}>{tr('ui.sidoinkomst_30_skatteavdrag')}</label>
          </div>
        </div>
        {form.taxForm === 'ej_verifierad' && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '8px', padding: '10px 12px', marginTop: '4px', fontSize: '12.5px', color: 'var(--status-amber-text)' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{tr('ui.skatteformen_bor_verifieras_innan_forsta_lonekor')}</span>
          </div>
        )}

        <div style={{ marginTop: '16px' }}>
          <label style={labelStyle}>{tr('ui.folkbokforingskommun')}</label>
          <EntitySearch
            value={form.municipality}
            onChange={v => set('municipality', v)}
            items={SWEDISH_MUNICIPALITIES.map(m => ({ id: m, name: m }))}
            placeholder={tr('ui.sok_kommun')}
          />
          {errors.municipality && <div style={errorTextStyle}>{errors.municipality}</div>}
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={labelStyle}>{tr('ui.skattetabell_2')}</label>
          {(() => {
            const chosen = String(form.taxTable.tabellnr || '');
            const suggestion = suggestTaxTables(form.municipality);
            // Förslagen: en knapp per tabell som kan gälla i kommunen, med
            // vem den gäller för. Samma tabell för båda grupperna slås ihop.
            const choices = [];
            if (suggestion) {
              const add = (nr, who) => {
                const hit = choices.find(c => c.nr === nr);
                if (hit) hit.who.push(who); else choices.push({ nr, who: [who] });
              };
              suggestion.ejMedlem.forEach(nr => add(nr, 'inte medlem i Svenska kyrkan'));
              suggestion.medlem.forEach(nr => add(nr, 'medlem i Svenska kyrkan'));
              choices.sort((x, y) => x.nr - y.nr);
            }
            const known = new Set(choices.map(c => String(c.nr)));
            const highest = Math.max(42, ...choices.map(c => c.nr), Number(chosen) || 0);
            const others = [];
            for (let nr = 29; nr <= highest; nr++) others.push(nr);
            if (chosen && !others.includes(Number(chosen))) others.push(Number(chosen));
            return (
              <>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.5 }}>
                  {suggestion
                    ? tr('ui.valj_den_som_stammer_for_den_anstallda_i_forslag', { municipality: form.municipality, KOMMUN_SKATTETABELLER_ÅR })
                    : tr('ui.valj_folkbokforingskommun_ovan_sa_foreslar_vi_ta')}
                </p>
                {choices.length > 0 && (
                  <div className="tax-table-choices" role="radiogroup" aria-label={tr('ui.skattetabell')}>
                    {choices.map(c => (
                      <button
                        key={c.nr} type="button" role="radio" aria-checked={chosen === String(c.nr)}
                        className={'tax-table-choice' + (chosen === String(c.nr) ? ' is-active' : '')}
                        onClick={() => setTaxTable({ tabellnr: String(c.nr) })}
                      >
                        <span className="tax-table-choice-nr">{tr('ui.tabell_2')} {c.nr}</span>
                        <span className="tax-table-choice-who">{c.who.join(' och ').replace(/^./, ch => ch.toUpperCase())}</span>
                      </button>
                    ))}
                  </div>
                )}
                <select
                  value={chosen} onChange={e => setTaxTable({ tabellnr: e.target.value })}
                  style={{ ...inputStyle(errors.taxTable), background: 'var(--bg-card)', maxWidth: '320px' }}
                  aria-label={choices.length > 0 ? tr('ui.annan_skattetabell') : tr('ui.skattetabell')}
                >
                  <option value="">{choices.length > 0 ? tr('ui.annan_tabell') : tr('ui.valj_tabell')}</option>
                  {others.map(nr => (
                    <option key={nr} value={String(nr)}>
                      {tr('ui.tabell', { nr })}{known.has(String(nr)) ? tr('ui.foreslagen') : ''}
                    </option>
                  ))}
                </select>
              </>
            );
          })()}
          {errors.taxTable && <div style={errorTextStyle}>{errors.taxTable}</div>}
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={labelStyle}>{tr('ui.kolumn')}</label>
          <select value={form.taxTable.kolumn} onChange={e => setTaxTable({ kolumn: Number(e.target.value) })} style={{ ...inputBase, background: 'var(--bg-card)' }}>
            {TAX_TABLE_COLUMNS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </Section>

      <Section title={tr('ui.semester')}>
        {vacationSummary && (
          // Kundönskemål: read-only sammanfattning FÖRST i sektionen —
          // samma tal som Semester-fliken (VacationOverview) räknar fram
          // för hela företaget, bara filtrerat till den här anställda, så
          // man ser var man står innan man ändrar reglerna under.
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px',
            padding: '14px 16px', marginBottom: '18px', borderRadius: '10px', background: 'var(--bg-muted)',
          }}>
            <div>
              <div style={helpTextStyle}>{tr('ui.intjanat')} {vacationSummary.vacationYear.label}</div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)' }}>{vacationSummary.earned} {tr('ui.dagar')}</div>
            </div>
            <div>
              <div style={helpTextStyle}>{tr('ui.uttaget')}</div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)' }}>{vacationSummary.taken} {tr('ui.dagar')}</div>
            </div>
            <div>
              <div style={helpTextStyle}>{tr('ui.kvar_att_ta_ut')}</div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: vacationSummary.overEntitlement ? 'var(--status-red-text)' : BRAND.greenDark }}>{vacationSummary.totalAvailable} {tr('ui.dagar')}</div>
            </div>
            <div>
              <div style={helpTextStyle}>{tr('ui.semesterloneskuld')}</div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)' }}>{formatSEK(vacationSummary.liabilityTotal)}</div>
            </div>
            {vacationSummary.overEntitlement && (
              <div style={{ gridColumn: '1 / -1', fontSize: '12px', color: 'var(--status-red-text)' }}>
                {tr('ui.fler_dagar_uttagna_an_intjanat_sparat_kontroller')} {vacationSummary.vacationYear.label}.
              </div>
            )}
          </div>
        )}
        <div className="form-row-2" style={grid2}>
          <div>
            <label style={labelStyle}>{tr('ui.semesterregel')}</label>
            <select value={form.vacationRule} onChange={e => set('vacationRule', e.target.value)} style={{ ...inputBase, background: 'var(--bg-card)' }}>
              {VACATION_RULES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{tr('ui.semesterdagar_per_ar')}</label>
            <input type="number" value={form.vacationDays} onChange={e => set('vacationDays', Number(e.target.value))} style={inputStyle(errors.vacationDays)} />
            <p style={helpTextStyle}>{tr('ui.lagstadgat_minimum')} {MIN_VACATION_DAYS} {tr('ui.dagar')}</p>
            {errors.vacationDays && <div style={errorTextStyle}>{errors.vacationDays}</div>}
          </div>
          <div>
            {/* Sparade dagar kan inte räknas fram av systemet: historiken
                före Bokix finns inte här, och ett företag som flyttar in
                mitt i ett semesterår har nästan alltid ett ingående saldo.
                Därför ett fält att skriva in, inte en gissning. */}
            <label style={labelStyle}>{tr('ui.sparade_semesterdagar')}</label>
            <input type="number" min="0" value={form.savedVacationDays ?? 0} onChange={e => set('savedVacationDays', Number(e.target.value))} style={inputBase} />
            <p style={helpTextStyle}>{tr('ui.dagar_fran_tidigare_ar_dagar_over_20_per_ar_far')}</p>
          </div>
        </div>
      </Section>

      <Section title={tr('ui.kostnadsstalle_projekt')}>
        <div className="form-row-2" style={grid2}>
          <div>
            <label style={labelStyle}>{tr('ui.kostnadsstalle')}</label>
            <input value={form.costCenter} onChange={e => set('costCenter', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>{tr('ui.projekt')}</label>
            <ProjectSearch value={form.projectId} onChange={v => set('projectId', v)} projects={projects} />
          </div>
        </div>
        <p style={helpTextStyle}>{tr('ui.foreslas_pa_lonekostnadsrader_vid_bokforing_av_l')}</p>
      </Section>

      <Section title={tr('ui.bankkonto')}>
        <div className="form-row-2" style={grid2}>
          <div>
            <label style={labelStyle}>{tr('ui.clearingnummer')}</label>
            <input value={form.clearingNumber} onChange={e => set('clearingNumber', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={labelStyle}>{tr('ui.kontonummer')}</label>
            <input value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} style={inputBase} />
          </div>
        </div>
        {!hasBankInfo && (
          <p style={{ ...helpTextStyle, color: 'var(--status-amber-text)' }}>
            {tr('ui.kan_sparas_utan_bankkontouppgifter_for_forberede')}
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
            <label style={labelStyle}>{tr('ui.iban')}</label>
            <input value={form.iban} onChange={e => set('iban', e.target.value.toUpperCase())} style={inputStyle(errors.iban)} placeholder="SE35 5000 0000 0549 1000 0003" />
            {errors.iban && <div style={errorTextStyle}>{errors.iban}</div>}
          </div>
          <div>
            <label style={labelStyle}>{tr('ui.bic_swift')}</label>
            <input value={form.bic} onChange={e => set('bic', e.target.value.toUpperCase())} style={inputBase} placeholder="SWEDSESS" />
          </div>
        </div>
        <p style={helpTextStyle}>{tr('ui.kravs_for_att_den_anstallda_ska_tas_med_i_den_ne')}</p>
      </Section>

      <div className="mform-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button type="button" onClick={onCancel} style={{ padding: '9px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>{tr('ui.avbryt')}</button>
        <button type="submit" style={{ padding: '9px 18px', background: 'var(--accent)', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'white', cursor: 'pointer' }}>{tr('ui.spara_anstalld')}</button>
      </div>
    </form>
  );
}
