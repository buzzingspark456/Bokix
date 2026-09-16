// Bästa möjliga ärliga enhetsbeskrivning från webbläsarens egen user agent —
// det enda vi faktiskt vet om den enhet man sitter på just nu. Låg tidigare
// bara i Settings.jsx (ActiveSessionsSection) — flyttad hit så App.jsx
// (inloggningshistorik, login_events) kan återanvända EXAKT samma logik
// istället för en egen, lätt-att-tappa-synk-med kopia.
export function detectDevice() {
  if (typeof navigator === 'undefined') return 'Okänd enhet';
  const ua = navigator.userAgent;
  let os = 'okänt OS';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  let browser = 'okänd webbläsare';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  return `${browser} på ${os}`;
}
