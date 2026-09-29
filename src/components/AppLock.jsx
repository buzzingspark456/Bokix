import React, { useState } from 'react';
import { Fingerprint } from './icons';
import { BRAND } from '../utils/brandColors';
import BokixWordmark from './shared/BokixWordmark';
import { verifyWithPasskey, isPasskeyCancel } from '../utils/sessionPolicy';
import { t } from '../i18n';

/**
 * Låsskärmen när appen öppnas eller kommer tillbaka och Face ID-spärren är
 * på (utils/sessionPolicy.js). Face ID-rutan kräver ett tryck i Safari, så
 * den öppnas från knappen, inte av sig själv. "Logga in med lösenord" loggar
 * ut, så ingen kommer förbi spärren utan Face ID eller lösenordet.
 */
export default function AppLock({ firstName, onUnlock, onUsePassword }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const unlock = async () => {
    setError('');
    setBusy(true);
    try {
      await verifyWithPasskey();
      onUnlock();
    } catch (err) {
      if (!isPasskeyCancel(err)) setError(t('ui.applock_misslyckades'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-lock" role="dialog" aria-modal="true" aria-label={t('ui.applock_rubrik')}>
      <div className="app-lock-inner">
        <BokixWordmark height={44} />
        <h1 className="app-lock-title">{firstName ? t('ui.applock_hej', { firstName }) : t('ui.applock_rubrik')}</h1>
        <p className="app-lock-sub">{t('ui.applock_text')}</p>
        <button type="button" className="app-lock-btn" onClick={unlock} disabled={busy} style={{ background: BRAND.green }}>
          <Fingerprint size={24} />
          {busy ? t('ui.applock_vantar') : t('ui.applock_knapp')}
        </button>
        {error && <p className="app-lock-error">{error}</p>}
        <button type="button" className="app-lock-link" onClick={onUsePassword}>{t('ui.applock_losenord')}</button>
      </div>
    </div>
  );
}
