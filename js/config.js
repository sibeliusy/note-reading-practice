// ---------------------------------------------------------------------------
// CONFIG.js
// All tunable gameplay constants live here. Nothing else in the codebase
// should contain a "magic number" for timing, lives, or feedback duration —
// change behavior by editing this file only.
// ---------------------------------------------------------------------------

export const CONFIG = {
  // Timer
  START_TIME_SECONDS: 10,      // time allowed on the very first question
  MIN_TIME_SECONDS: 2.0,       // absolute floor the timer decays toward, never reached
  TIME_DECAY_RATE: 0.88,       // multiplier applied per correct answer (see computeTimeLimit)

  // Lives / scoring
  STARTING_LIVES: 3,
  POINTS_PER_CORRECT: 1,

  // Feedback pacing (ms)
  CORRECT_FEEDBACK_MS: 500,
  INCORRECT_FEEDBACK_MS: 1100, // slightly longer so the revealed answer can be read

  // Audio
  AUDIO_NOTE_DURATION_SECONDS: 0.7,

  // Note generation
  CHROMATIC_PROBABILITY: 0.4,  // chance a given question is a chromatic (black-key) note

  // Clefs available in the app, in the order they're presented in setup
  CLEFS: ['treble', 'alto', 'tenor', 'bass'],
  CLEF_LABELS: { treble: 'Treble clef', alto: 'Alto clef', tenor: 'Tenor clef', bass: 'Bass clef' },

  // Ledger line range setting
  LEDGER_MIN: 0,
  LEDGER_MAX: 2,
  LEDGER_DEFAULT: 2,
  PLACEMENT_MIN: -4, // second ledger line below
  PLACEMENT_MAX: 14, // third ledger line above
};

// The 12 chromatic pitch classes, index-aligned with (semitone value from C).
// This ordering is load-bearing: pitchClassFromSemitone() in musicTheory.js
// returns an index directly into this array.
export const PITCH_CLASS_NAMES = [
  'C', 'C♯ / D♭', 'D', 'D♯ / E♭', 'E', 'F',
  'F♯ / G♭', 'G', 'G♯ / A♭', 'A', 'A♯ / B♭', 'B',
];

export const STORAGE_KEYS = {
  HIGH_SCORE: 'celloNotes.highScore',
  LAST_SCORE: 'celloNotes.lastScore',
  SETTINGS: 'celloNotes.settings',
};
