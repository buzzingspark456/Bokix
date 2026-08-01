export const COOKIE_CONSENT_KEY = 'bokix_cookie_consent';

export function getCookieConsent() {
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveCookieConsent(preferences) {
  const consent = {
    necessary: true,
    analytics: Boolean(preferences.analytics),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
  window.dispatchEvent(new CustomEvent('bokix-cookie-consent', { detail: consent }));
  return consent;
}
