import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { INK_SOFT, MUTED, CARD_BORDER } from '../marketingTokens';
import { calcAnnualReportDeadline, ANNUAL_REPORT_DEADLINE_MONTHS, ANNUAL_REPORT_MAX_TOTAL_FEE } from '../../../utils/freeToolCalculations';
import { toolBySlug } from './toolsConfig';
import ToolShell, { ToolField, ToolDate, ToolResultPanel, ToolResultRow, ToolNote, formatDateSv } from './ToolShell';

const tool = toolBySlug('arsredovisning');

// Räkenskapsåret slutar oftast 31 december — det förvalet gör att sidan
// visar ett meningsfullt exempel direkt i stället för ett tomt fält,
// samma resonemang som DrojsmalsrantaPage:s defaultDates().
function defaultFiscalYearEnd() {
  const today = new Date();
  // Om vi redan passerat årets 31 december (aldrig sant, men skyddar mot
  // en förvirrande "deadline redan passerad"-bild om sidan öppnas i
  // december) väljs nästa årsskifte i stället.
  const year = today.getMonth() === 11 && today.getDate() === 31 ? today.getFullYear() + 1 : today.getFullYear();
  return `${year}-12-31`;
}

export default function ArsredovisningPage() {
  const [fiscalYearEnd, setFiscalYearEnd] = useState(defaultFiscalYearEnd);
  const r = calcAnnualReportDeadline({ fiscalYearEnd });

  return (
    <ToolShell
      tool={tool}
      metaTitle="Deadline årsredovisning 2026 — räkna ut din — Bokix"
      metaDescription="Räkna ut när din årsredovisning senast ska vara hos Bolagsverket (sju månader efter räkenskapsårets slut) och hur mycket förseningsavgifterna kostar om den blir sen."
      intro="Ange räkenskapsårets sista dag, så räknar vi ut Bolagsverkets deadline och hela förseningsavgiftstrappan om den skulle missas."
      calculator={
        <>
          <ToolField label="Räkenskapsårets sista dag" hint="Den dag räkenskapsåret slutar, t.ex. 31 december för ett kalenderår.">
            <ToolDate value={fiscalYearEnd} onChange={setFiscalYearEnd} />
          </ToolField>
          <p style={{ fontSize: '13px', color: MUTED, lineHeight: 1.65, margin: '2px 0 0' }}>
            Gäller aktiebolag och ekonomiska föreningar. Räkenskapsåret står i bolagsordningen — kalenderår (31 december) är vanligast, men brutna räkenskapsår (t.ex. 30 april eller 30 juni) förekommer.
          </p>
        </>
      }
      result={
        r ? (
          <ToolResultPanel
            title="Deadline hos Bolagsverket"
            footnote={`Gäller privata aktiebolag, räkenskapsår som inleds 2025-01-01 eller senare. Publika aktiebolag har dubbla belopp (15 000/15 000/30 000 kr).`}
          >
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {formatDateSv(r.deadline)}
            </div>
            <div style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.65)', marginTop: '6px' }}>
              {r.daysLeft >= 0 ? `Om ${r.daysLeft} dagar` : `${Math.abs(r.daysLeft)} dagar sedan — redan passerad`}
            </div>

            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>
                Om den blir sen
              </div>
              {r.feeSchedule.map((fee, i) => (
                <ToolResultRow
                  key={fee.id}
                  label={`${fee.label}${i > 0 ? ` (efter ${formatDateSv(fee.date)})` : ''}`}
                  value={fee.amount}
                  muted={i > 0}
                />
              ))}
              <ToolResultRow label="Max totalt" value={ANNUAL_REPORT_MAX_TOTAL_FEE} strong />
            </div>
          </ToolResultPanel>
        ) : (
          <ToolResultPanel title="Deadline hos Bolagsverket">
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>Ange ett giltigt datum till vänster.</div>
          </ToolResultPanel>
        )
      }
      steps={[
        {
          title: `Årsredovisningen ska in inom ${ANNUAL_REPORT_DEADLINE_MONTHS} månader`,
          body: 'Enligt årsredovisningslagen och aktiebolagslagen ska årsredovisningen ha kommit in till Bolagsverket senast sju månader efter räkenskapsårets utgång — inte sju månader efter att bolagsstämman hållits.',
          formula: `${r ? formatDateSv(new Date(`${fiscalYearEnd}T00:00:00`)) : 'räkenskapsårets slut'} + 7 månader = ${r ? formatDateSv(r.deadline) : '—'}`,
        },
        {
          title: 'Tre förseningsavgifter, upptrappande',
          body: 'Kommer den inte in i tid tar Bolagsverket automatiskt ut en första avgift på 7 500 kr. Är den fortfarande försenad två månader senare tillkommer ytterligare 7 500 kr, och efter ytterligare två månader (fyra totalt) ytterligare 15 000 kr — 30 000 kr sammanlagt för ett privat aktiebolag.',
        },
        {
          title: 'Avgiften går inte att undvika i efterhand',
          body: 'Bolagsverket är skyldigt att ta ut avgiften så fort fristen gått ut, oavsett anledning. Det går att begära eftergift i efterhand, men bara vid särskilda skäl (t.ex. dokumenterad sjukdom) — "det var mycket att göra" räknas inte.',
        },
        {
          title: 'Fortsatt uteblivet kan leda till tvångslikvidation',
          body: 'Skickas inte årsredovisningen in alls kan Bolagsverket till slut besluta att bolaget ska gå i tvångslikvidation, utöver avgifterna.',
        },
      ]}
      faq={[
        {
          q: 'När ska årsredovisningen senast lämnas in 2026?',
          a: 'Sju månader efter räkenskapsårets utgång. För ett kalenderår som slutar 31 december innebär det senast 31 juli året efter.',
        },
        {
          q: 'Hur mycket kostar en försenad årsredovisning?',
          a: 'För ett privat aktiebolag: 7 500 kr direkt vid fristens utgång, ytterligare 7 500 kr efter två månader till, och ytterligare 15 000 kr efter fyra månader totalt — max 30 000 kr. Publika aktiebolag betalar dubbelt.',
        },
        {
          q: 'Räknas sju månader från räkenskapsårets slut eller från bolagsstämman?',
          a: 'Från räkenskapsårets utgång, inte från bolagsstämman. Stämman måste hållas i tid för att årsredovisningen ska hinna fastställas och skickas in inom sjumånadersfristen.',
        },
        {
          q: 'Gäller samma deadline för en enskild firma?',
          a: 'Nej. Enskilda firmor upprättar ingen årsredovisning till Bolagsverket alls — bokföringen sammanfattas i stället i NE-bilagan till inkomstdeklarationen.',
        },
        {
          q: 'Kan jag slippa förseningsavgiften?',
          a: 'Bara genom eftergift efter ansökan, och bara vid särskilda skäl som Bolagsverket godkänner i efterhand. Att avgiften "känns orättvis" räcker inte — den tas ut automatiskt så fort fristen passerat.',
        },
      ]}
    >
      <ToolNote tone="warn" title="Publikt aktiebolag?">
        Beloppen ovan gäller privata aktiebolag. Ett publikt aktiebolag (AB som får sprida aktier till allmänheten) betalar dubbelt: 15 000, 15 000 och 30 000 kr — 60 000 kr sammanlagt.
      </ToolNote>
      <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, marginTop: '22px', borderTop: `1px dashed ${CARD_BORDER}`, paddingTop: '18px' }}>
        Vill du hellre bli påmind i god tid?{' '}
        <Link to="/funktioner" style={{ color: 'var(--mkt-accent-green-fg)', fontWeight: 600 }}>Bokix håller koll på viktiga datum</Link>{' '}
        och tar fram bokslutsunderlaget löpande, inte bara i sista sekunden.
      </p>
    </ToolShell>
  );
}
