// ---------------------------------------------------------------------------
// musicTheory.js
//
// Pure music-theory logic with zero DOM/rendering/audio dependencies, so it
// can be unit-reasoned-about (and reused by a future "Place the Note" mode)
// in isolation.
//
// INTERNAL PITCH REPRESENTATION
//   A written pitch is { letter, octave, accidental }
//     letter:     'C'..'B' (natural letter name)
//     octave:     scientific pitch notation octave number (middle C = C4)
//     accidental: -1 (flat), 0 (natural), +1 (sharp)
//
// STAFF POSITION
//   For a given clef, position 0 = the bottom line of the staff. Each
//   integer step moves one diatonic letter-step (line->space or
//   space->line). Positive = up, negative = down (into ledger-line
//   territory below the staff). This lets ledger-line range math and
//   VexFlow key generation share one simple coordinate system.
// ---------------------------------------------------------------------------

const LETTER_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// Semitone offset of each natural letter above C (within its octave).
const LETTER_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// The note that sits ON THE BOTTOM LINE of each clef's staff (position 0).
// These are the standard reference points for each clef:
//   Treble: lines E4 G4 B4 D5 F5   (spaces F4 A4 C5 E5)
//   Bass:   lines G2 B2 D3 F3 A3   (spaces A2 C3 E3 G3)
//   Tenor:  lines D3 F3 A3 C4 E4   (spaces E3 G3 B3 D4) — middle C (C4) sits
//           on the 4th line from the bottom, as required for tenor clef.
const CLEF_BOTTOM_LINE = {
  treble: { letter: 'E', octave: 4 },
  bass: { letter: 'G', octave: 2 },
  tenor: { letter: 'D', octave: 3 },
  alto: { letter: 'F', octave: 3 }, // middle C is on the third (middle) line
};

// Letters that have a musically-ordinary sharp spelling (avoids B#, E#).
const SHARPABLE_LETTERS = new Set(['C', 'D', 'F', 'G', 'A']);
// Letters that have a musically-ordinary flat spelling (avoids Cb, Fb).
const FLATTABLE_LETTERS = new Set(['D', 'E', 'G', 'A', 'B']);

/**
 * Step a natural (letter, octave) pair by `delta` diatonic letter-steps.
 * Handles octave rollover correctly (octave increments crossing B->C).
 */
function stepLetter({ letter, octave }, delta) {
  const rawIndex = LETTER_ORDER.indexOf(letter) + delta;
  const octaveShift = Math.floor(rawIndex / 7);
  const letterIndex = ((rawIndex % 7) + 7) % 7;
  return { letter: LETTER_ORDER[letterIndex], octave: octave + octaveShift };
}

/**
 * Convert a staff-position index (0 = bottom line) to the natural
 * (letter, octave) that lives there for the given clef.
 */
export function noteAtPosition(clef, position) {
  return stepLetter(CLEF_BOTTOM_LINE[clef], position);
}

/**
 * Compute the inclusive [minPosition, maxPosition] range of allowed staff
 * positions for a given number of ledger lines, per the spec:
 *   - N = 0: the plain five-line staff (bottom line to top line).
 *   - N >= 1: lowest = the note ON the Nth ledger line below the staff;
 *             highest = the note in the space immediately ABOVE the Nth
 *             ledger line above the staff (intentionally asymmetric).
 *
 * Position coordinate reminder: 0 = bottom line, 8 = top line, lines sit on
 * even indices, spaces on odd indices, in both directions.
 */
export function ledgerRangeToPositions(ledgerLines) {
  if (ledgerLines <= 0) {
    return { min: 0, max: 8 };
  }
  const min = -2 * ledgerLines;
  const max = 9 + 2 * ledgerLines;
  return { min, max };
}

/**
 * Build the full pool of valid written notes for one clef at the given
 * ledger-line setting: naturals at every position, plus every musically
 * ordinary chromatic spelling (sharp/flat) whose position falls in range.
 * Each pool entry is a complete "written pitch" ready to render/play.
 */
export function buildNotePool(clef, ledgerLines) {
  const { min, max } = ledgerRangeToPositions(ledgerLines);
  const naturals = [];
  const chromatics = [];

  for (let position = min; position <= max; position++) {
    const { letter, octave } = noteAtPosition(clef, position);
    naturals.push({ clef, position, letter, octave, accidental: 0 });

    if (SHARPABLE_LETTERS.has(letter)) {
      chromatics.push({ clef, position, letter, octave, accidental: 1 });
    }
    if (FLATTABLE_LETTERS.has(letter)) {
      chromatics.push({ clef, position, letter, octave, accidental: -1 });
    }
  }

  return { naturals, chromatics };
}

/** MIDI note number for a written pitch (accidental already applied). */
export function midiNumber({ letter, octave, accidental }) {
  return (octave + 1) * 12 + LETTER_SEMITONES[letter] + accidental;
}

/** Sounding frequency in Hz (A4 = 440, equal temperament). */
export function frequencyOf(note) {
  const midi = midiNumber(note);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * The chromatic pitch-class index (0-11, C=0) that a written pitch belongs
 * to. This index aligns directly with PITCH_CLASS_NAMES / answer buttons.
 */
export function pitchClassOf(note) {
  const semitone = LETTER_SEMITONES[note.letter] + note.accidental;
  return ((semitone % 12) + 12) % 12;
}

/** VexFlow clef name for a given internal clef id (currently 1:1). */
export function vexClefName(clef) {
  return clef; // 'treble' | 'alto' | 'bass' | 'tenor' all match VexFlow's own names
}

/** VexFlow key string, e.g. { letter:'F', octave:4, accidental:1 } -> "f#/4" */
export function vexKey(note) {
  const accidentalChar = note.accidental === 1 ? '#' : note.accidental === -1 ? 'b' : '';
  return `${note.letter.toLowerCase()}${accidentalChar}/${note.octave}`;
}

/** Two written pitches represent the identical clef+position+accidental. */
export function isSameWrittenNote(a, b) {
  if (!a || !b) return false;
  return a.clef === b.clef && a.position === b.position && a.accidental === b.accidental;
}

/**
 * Pick a random question: choose an enabled clef, then a random valid
 * written pitch within that clef's configured range, avoiding an exact
 * repeat of the previous question. Uniform over "natural vs. chromatic"
 * first (per CHROMATIC_PROBABILITY), then uniform within that pool, so the
 * student is exposed to the full range rather than a lucky subset.
 */
export function generateQuestion({ enabledClefs, ledgerLines, chromaticProbability, previous, random = Math.random }) {
  const MAX_ATTEMPTS = 25;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const clef = enabledClefs[Math.floor(random() * enabledClefs.length)];
    const { naturals, chromatics } = buildNotePool(clef, ledgerLines);

    const wantChromatic = chromatics.length > 0 && random() < chromaticProbability;
    const pool = wantChromatic ? chromatics : naturals;
    const candidate = pool[Math.floor(random() * pool.length)];

    if (!isSameWrittenNote(candidate, previous)) {
      return candidate;
    }
  }

  // Extremely unlikely fallback (e.g. pool of size 1): just return something valid.
  const clef = enabledClefs[0];
  const { naturals } = buildNotePool(clef, ledgerLines);
  return naturals[0];
}
