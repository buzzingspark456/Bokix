import { useState } from 'react';
import OnboardingFlow from '../components/OnboardingFlow';

// Bara lokalt (AppRouter: /dev/onboarding när import.meta.env.DEV): visar
// registreringens företagsfrågor fristående, utan konto eller e-postkod.
// Inget sparas; svaren visas i slutet.
export default function DevOnboarding() {
  const [result, setResult] = useState(null);
  const [round, setRound] = useState(0);
  if (result) {
    return (
      <div style={{ maxWidth: 640, margin: '60px auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 22 }}>Svaren (sparas inte)</h1>
        <p>Start: <b>{result.startPath === 'move' ? 'Flyttar in' : result.startPath === 'new' ? 'Från noll' : '–'}</b></p>
        <pre style={{ background: '#f4f4f4', padding: 16, borderRadius: 10, overflow: 'auto', fontSize: 12 }}>{JSON.stringify(result, null, 2)}</pre>
        <button type="button" onClick={() => { setResult(null); setRound(r => r + 1); }} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Börja om</button>
      </div>
    );
  }
  return <OnboardingFlow key={round} firstName="Test" onComplete={setResult} />;
}
