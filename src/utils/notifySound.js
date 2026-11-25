// Ljud när en ny notis kommer (2026-11-12, andra versionen). Allt byggs med
// Web Audio, så inga ljudfiler laddas. Melodierna är egna (inga kända
// signaturer eller filmmusik, som är skyddade). Ljuden har klockklang
// (FM-syntes), knäppta strängar (filtrerad sågtand), lite brus och en mjuk
// efterklang, så att de låter som riktiga ljud och inte som pip.
// Ett enda ljud ("Enkel"). Det slås av/på i Inställningar → Notiser (user_metadata.notif_sound).
//
// Webbläsare tillåter bara ljud efter att användaren har klickat eller
// tryckt någonstans på sidan. unlockNotifySound() kopplas därför till det
// första klicket; före det är playNotifySound() tyst i stället för att fela.

let ctx = null;
let reverbNode = null;

function audioContext() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try { ctx = new Ctor(); } catch { return null; }
  }
  return ctx;
}

/** Låser upp ljudet vid första klick/tryck. Anropas en gång från App.jsx. */
export function unlockNotifySound() {
  if (typeof window === 'undefined') return () => {};
  const unlock = () => {
    const c = audioContext();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
  return unlock;
}

// ── Byggstenar ──────────────────────────────────────────────────────────

// Mjuk efterklang: en impuls av avklingande brus, byggd en gång.
function reverb(c) {
  if (reverbNode && reverbNode.context === c) return reverbNode;
  const len = Math.floor(c.sampleRate * 1.6);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  const conv = c.createConvolver();
  conv.buffer = buf;
  const wet = c.createGain();
  wet.gain.value = 0.28;
  conv.connect(wet).connect(c.destination);
  reverbNode = conv;
  return conv;
}

function env(c, gainNode, t, attack, peak, decay) {
  gainNode.gain.setValueAtTime(0.0001, t);
  gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

// Klocka/marimba med FM-syntes: bärare + modulator vars styrka klingar av.
function bell(c, out, freq, t, decay = 1.2, vol = 0.18, ratio = 3.5, index = 2.2) {
  const car = c.createOscillator();
  const mod = c.createOscillator();
  const modGain = c.createGain();
  const amp = c.createGain();
  car.frequency.value = freq;
  mod.frequency.value = freq * ratio;
  modGain.gain.setValueAtTime(freq * index, t);
  modGain.gain.exponentialRampToValueAtTime(freq * 0.02, t + decay * 0.6);
  mod.connect(modGain).connect(car.frequency);
  car.connect(amp).connect(out);
  env(c, amp, t, 0.004, vol, decay);
  car.start(t); mod.start(t);
  car.stop(t + decay + 0.1); mod.stop(t + decay + 0.1);
}

// Knäppt sträng / synth-pluck: sågtand genom ett filter som stänger sig.
function pluck(c, out, freq, t, decay = 0.35, vol = 0.12, type = 'sawtooth', bright = 6) {
  const osc = c.createOscillator();
  const filt = c.createBiquadFilter();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  filt.type = 'lowpass';
  filt.Q.value = 4;
  filt.frequency.setValueAtTime(freq * bright, t);
  filt.frequency.exponentialRampToValueAtTime(freq * 1.2, t + decay);
  osc.connect(filt).connect(amp).connect(out);
  env(c, amp, t, 0.005, vol, decay);
  osc.start(t);
  osc.stop(t + decay + 0.1);
}

// Mjuk ton (sinus/triangel) med valfri glidning.
function soft(c, out, freq, t, decay = 0.4, vol = 0.12, type = 'sine', glideTo = null) {
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + decay * 0.7);
  osc.connect(amp).connect(out);
  env(c, amp, t, 0.01, vol, decay);
  osc.start(t);
  osc.stop(t + decay + 0.1);
}

// Kort brus (metall/klick), filtrerat runt en frekvens.
function noise(c, out, t, decay = 0.08, vol = 0.08, center = 6000) {
  const len = Math.floor(c.sampleRate * (decay + 0.05));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = center;
  filt.Q.value = 1.4;
  const amp = c.createGain();
  src.connect(filt).connect(amp).connect(out);
  env(c, amp, t, 0.002, vol, decay);
  src.start(t);
}

// Noter (Hz).
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI-nummer → Hz
const M = { A3: 57, C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, Gs4: 68, A4: 69, B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, B5: 83, C6: 84, D6: 86, E6: 88, G6: 91, A6: 93, B6: 95, C7: 96, E7: 100 };
const f = (name) => hz(M[name]);

// ── Ljuden ──────────────────────────────────────────────────────────────
export const NOTIFY_SOUNDS = [
  {
    id: 'enkel', label: 'Enkel', hint: 'Ett kort, rent ding, som en vanlig notis',
    play: (c, o, t) => {
      // Två mjuka toner (C6 → F6) med lite klang, kort och neutralt.
      bell(c, o, f('C6'), t, 0.5, 0.3, 2, 0.6);
      bell(c, o, f('F5') * 2, t + 0.1, 0.8, 0.3, 2, 0.6);
    },
  },
];

const DEFAULT_SOUND = 'enkel';

/** Spelar ljudet. Returnerar false om ljud inte går att spela just nu. */
export function playNotifySound(id = DEFAULT_SOUND) {
  const c = audioContext();
  if (!c || c.state !== 'running') return false;
  const sound = NOTIFY_SOUNDS.find(s => s.id === id) || NOTIFY_SOUNDS[0];
  const out = c.createGain();
  out.gain.value = 2.1;
  out.connect(c.destination);
  out.connect(reverb(c));
  sound.play(c, out, c.currentTime + 0.02);
  return true;
}

/** Spelar upp ett ljud från en knapp (låser upp ljudet först om det behövs). */
export function previewNotifySound(id) {
  const c = audioContext();
  if (!c) return;
  if (c.state === 'suspended') c.resume().then(() => playNotifySound(id)).catch(() => {});
  else playNotifySound(id);
}

/** Är ljudet påslaget för kontot? Standard: på. */
export function notifySoundEnabled(user) {
  return user?.user_metadata?.notif_sound !== false;
}

/** Kontots valda ljud. Ett borttaget ljud (t.ex. "mynt") blir standard. */
export function notifySoundChoice(user) {
  const id = user?.user_metadata?.notif_sound_choice;
  return NOTIFY_SOUNDS.some(s => s.id === id) ? id : DEFAULT_SOUND;
}
