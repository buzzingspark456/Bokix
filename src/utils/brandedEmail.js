// Gemensam Bokix-ram för alla mejl som Bokix SJÄLV skickar till användare
// (koder, påminnelser, inbjudan, bokningsbekräftelse). Samma utseende som
// Supabase-mallarna för bekräftelse/återställning (Authentication → Emails):
// färglinje överst, logga, vitt kort, grön knapp, liten sidfot. Fakturor och
// offerter som kunden skickar till SINA kunder använder inte den här ramen.
// Delas av servern (api/) och klienten (Settings.jsx: inbjudan).

const LOGO_URL = 'https://www.bokix.se/email-logo.png';
const GREEN = '#3d7a2e';

/** Grön knapp, samma som i Supabase-mallarna. */
export function emailButton(url, label) {
  return `<p style="margin:24px 0 8px;text-align:center;"><a href="${url}" style="display:inline-block;padding:14px 32px;background-color:${GREEN};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">${label}</a></p>`;
}

/** Engångskod, stor och glesspatierad så den går att skriva av på mobilen. */
export function emailCode(code) {
  return `<p style="margin:24px 0;text-align:center;"><span style="display:inline-block;padding:14px 22px;background-color:#f4f7f5;border:1px solid #e3ebe5;border-radius:10px;font-size:32px;font-weight:700;letter-spacing:10px;color:#1c2420;">${code}</span></p>`;
}

/**
 * Hela mejlet. `title` blir rubriken, `body` är färdig HTML (stycken,
 * knappar, kod) och `footnote` en valfri liten rad under kortets innehåll.
 */
export function brandedEmail({ title, body, footnote = '' }) {
  return `<div style="margin:0;padding:32px 16px;background-color:#f4f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eee8dc;">
    <tr><td style="padding:0;">
      <div style="height:4px;background-color:#14b8a6;background-image:linear-gradient(90deg,#0ea5e9,#14b8a6,#84cc16);"></div>
    </td></tr>
    <tr><td style="padding:32px 32px 0;text-align:center;">
      <img src="${LOGO_URL}" width="140" alt="Bokix" style="display:block;margin:0 auto;border:0;">
    </td></tr>
    <tr>
      <td style="padding:24px 32px 8px;font-size:14.5px;line-height:1.6;color:#5b6b62;">
        ${title ? `<h1 style="margin:0 0 16px;font-size:21px;font-weight:800;color:#1c2420;text-align:center;">${title}</h1>` : ''}
        ${body}
        ${footnote ? `<p style="margin:20px 0 0;font-size:12.5px;line-height:1.6;color:#6b7684;">${footnote}</p>` : ''}
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 28px;text-align:center;border-top:1px solid #f1efe9;">
        <p style="margin:16px 0 0;font-size:12px;color:#b7bdb4;">Detta är ett automatiskt mejl från Bokix.</p>
      </td>
    </tr>
  </table>
</div>`;
}
