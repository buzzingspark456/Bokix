// ── Betalfil till bank (Lönekörning → "Betalfil till bank") ──────────────
// Genererar en riktig ISO 20022 pain.001.001.03-fil (Customer Credit
// Transfer Initiation) för nettolönerna i en lönekörning — samma
// meddelandeformat de flesta svenska företagsbanker tar emot för
// filbaserade leverantörs-/löneutbetalningar.
//
// Medvetna gränser (ärliga, inte gissade):
// - Kräver IBAN + BIC per anställd. Svenskt clearing-/kontonummer räcker
//   INTE ensamt (det finns ingen universell, bankoberoende regel för att
//   räkna om clearing+konto till IBAN — varje bank har sin egen), så en
//   anställd utan ifylld IBAN/BIC exkluderas hellre än att vi gissar.
// - Filen laddas ner, den skickas aldrig automatiskt någonstans — en
//   människa granskar och laddar upp den i sin egen bank. Vi utför ingen
//   betalning å användarens vägnar.
// - Exakt XML-dialekt kan behöva bankspecifika justeringar (SEB,
//   Handelsbanken, Swedbank och Nordea har egna implementationsguider) —
//   se varningen i PayrollRunDetail.

const pad2 = (n) => String(n).padStart(2, '0');

const isoTimestamp = (d = new Date()) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

const escapeXml = (str) =>
  String(str ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

/**
 * Mod-97-kontroll enligt ISO 13616 (samma algoritm som IBAN:s egna
 * kontrollsiffror bygger på). Fångar de vanligaste inmatningsfelen
 * (kastade/felskrivna siffror, fel längd) INNAN filen byggs — men
 * bekräftar bara att kontrollsiffrorna stämmer, inte att kontot existerar.
 */
export function isValidIban(iban) {
  const v = String(iban || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v)) return false;
  const rearranged = v.slice(4) + v.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => (ch.charCodeAt(0) - 55).toString());
  let remainder = numeric;
  while (remainder.length > 2) {
    const chunk = remainder.slice(0, 9);
    remainder = String(parseInt(chunk, 10) % 97) + remainder.slice(chunk.length);
  }
  return parseInt(remainder, 10) % 97 === 1;
}

/**
 * Bygger själva XML-strukturen. Ren funktion (inget DOM-beroende) så den
 * går att testa/återanvända oberoende av nedladdningen.
 */
export function buildSalaryPaymentFile({ company, run, computedRows }) {
  const eligible = computedRows.filter(({ computed }) => computed.iban && computed.bic && isValidIban(computed.iban));
  const excluded = computedRows.filter(({ computed }) => !(computed.iban && computed.bic && isValidIban(computed.iban)));

  const debtorIban = String(company?.iban || '').replace(/\s+/g, '').toUpperCase();
  const debtorBic = String(company?.bic || '').replace(/\s+/g, '').toUpperCase();

  const msgId = `LON-${run.period}-${Date.now()}`;
  const nbOfTxs = eligible.length;
  const ctrlSum = eligible.reduce((s, { computed }) => s + (computed.net || 0), 0);

  const transactions = eligible.map(({ row, computed }, i) => `
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>LON-${escapeXml(run.period)}-${i + 1}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="SEK">${computed.net.toFixed(2)}</InstdAmt>
        </Amt>
        <CdtrAgt>
          <FinInstnId><BICFI>${escapeXml(computed.bic)}</BICFI></FinInstnId>
        </CdtrAgt>
        <Cdtr>
          <Nm>${escapeXml(`${row.employeeSnapshot.firstName} ${row.employeeSnapshot.lastName}`)}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id><IBAN>${escapeXml(computed.iban)}</IBAN></Id>
        </CdtrAcct>
        <RmtInf><Ustrd>${escapeXml(`Lön ${run.period}`)}</Ustrd></RmtInf>
      </CdtTrfTxInf>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${escapeXml(msgId)}</MsgId>
      <CreDtTm>${isoTimestamp()}</CreDtTm>
      <NbOfTxs>${nbOfTxs}</NbOfTxs>
      <CtrlSum>${ctrlSum.toFixed(2)}</CtrlSum>
      <InitgPty><Nm>${escapeXml(company?.name || 'Företag')}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${escapeXml(msgId)}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${nbOfTxs}</NbOfTxs>
      <CtrlSum>${ctrlSum.toFixed(2)}</CtrlSum>
      <ReqdExctnDt>${run.payDate || new Date().toISOString().split('T')[0]}</ReqdExctnDt>
      <Dbtr><Nm>${escapeXml(company?.name || 'Företag')}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${escapeXml(debtorIban)}</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BICFI>${escapeXml(debtorBic)}</BICFI></FinInstnId></DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>${transactions}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

  return { xml, eligible, excluded, nbOfTxs, ctrlSum };
}

/**
 * Validerar företagets EGET avsändarkonto — utan giltig IBAN/BIC på
 * företaget blir filen ogiltig oavsett hur många anställda som är redo,
 * så det kollas separat och tidigt (innan man ens tittar på anställda).
 */
export function getDebtorAccountError(company) {
  if (!company?.iban || !isValidIban(company.iban)) return 'Företagets IBAN saknas eller är ogiltig (Inställningar → Betalning).';
  if (!company?.bic) return 'Företagets BIC/SWIFT saknas (Inställningar → Betalning).';
  return null;
}

/** Bygger filen och triggar en vanlig webbläsarnedladdning. Skickar aldrig
 * något automatiskt till banken — det gör användaren själv. */
export function downloadSalaryPaymentFile({ company, run, computedRows }) {
  const debtorError = getDebtorAccountError(company);
  if (debtorError) throw new Error(debtorError);

  const result = buildSalaryPaymentFile({ company, run, computedRows });
  if (result.eligible.length === 0) {
    throw new Error('Ingen anställd har både giltig IBAN och BIC ifyllt — betalfilen skulle bli tom.');
  }

  const blob = new Blob([result.xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `betalfil-lon-${run.period}.xml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return result;
}
