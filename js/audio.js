// ---------------------------------------------------------------------------
// audio.js
//
// Lightweight Web Audio synth: no external audio files. Produces a short,
// pleasant, roughly piano-like tone for a given frequency. The AudioContext
// is created lazily and resumed on first user gesture (Start Game button)
// to respect browser autoplay restrictions.
// ---------------------------------------------------------------------------

import { CONFIG } from './config.js?v=mobile-staff-2';

let audioContext = null;

/** Must be called from inside a user-gesture handler (e.g. Start Game click). */
export function unlockAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

/**
 * Play a short piano-like tone at `frequencyHz`. Layers a few harmonically
 * related oscillators through a shared envelope + gentle low-pass filter
 * for warmth, rather than a single flat sine/square tone.
 */
export function playTone(frequencyHz, durationSeconds = CONFIG.AUDIO_NOTE_DURATION_SECONDS) {
  if (!audioContext) return; // audio not unlocked yet; fail silently

  const now = audioContext.currentTime;
  const masterGain = audioContext.createGain();
  masterGain.gain.value = 0;

  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = Math.min(frequencyHz * 6, 8000);
  filter.Q.value = 0.7;

  masterGain.connect(filter);
  filter.connect(audioContext.destination);

  // Fundamental + a couple of quieter overtones for a fuller, less
  // electronic-sounding timbre.
  const partials = [
    { ratio: 1, gain: 1.0 },
    { ratio: 2, gain: 0.28 },
    { ratio: 3, gain: 0.12 },
    { ratio: 4, gain: 0.06 },
  ];

  const oscillators = partials.map(({ ratio, gain }) => {
    const osc = audioContext.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = frequencyHz * ratio;

    const partialGain = audioContext.createGain();
    partialGain.gain.value = gain;

    osc.connect(partialGain);
    partialGain.connect(masterGain);
    return osc;
  });

  // Simple percussive ADSR-ish envelope: quick attack, decay into a short
  // sustain, then release — evokes a struck/plucked tone rather than a
  // synth pad.
  const attack = 0.008;
  const decay = 0.12;
  const sustainLevel = 0.35;
  const releaseStart = Math.max(durationSeconds - 0.15, attack + decay);

  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(0.9, now + attack);
  masterGain.gain.linearRampToValueAtTime(sustainLevel, now + attack + decay);
  masterGain.gain.setValueAtTime(sustainLevel, now + releaseStart);
  masterGain.gain.linearRampToValueAtTime(0, now + durationSeconds);

  oscillators.forEach((osc) => {
    osc.start(now);
    osc.stop(now + durationSeconds + 0.05);
  });
}
