import { CONFIG } from './config.js?v=natural-placement-1';
import { noteAtPosition } from './musicTheory.js?v=natural-placement-1';
import { renderNote, positionAtPointer } from './notation.js?v=natural-placement-1';

const staff = document.getElementById('staff-container');
const controls = document.getElementById('placement-controls');
const prompt = document.getElementById('placement-prompt');
const banner = document.getElementById('feedback-banner');
let target = null;
let preview = null;
let active = false;
let pointerId = null;
let onSubmit = null;

export function configurePlacement(enabled, submit) {
  stopPlacement();
  onSubmit = submit;
  prompt.hidden = controls.hidden = !enabled;
  document.getElementById('answer-grid').hidden = enabled;
  document.getElementById('game-screen').classList.toggle('placing', enabled);
  staff.classList.toggle('placement-staff', enabled);
  staff.tabIndex = enabled ? 0 : -1;
  if (enabled) {
    staff.setAttribute('role', 'group');
    staff.setAttribute('aria-label', 'Place a note on the staff');
    staff.setAttribute('aria-describedby', 'placement-help');
  } else {
    staff.removeAttribute('role');
    staff.removeAttribute('aria-label');
    staff.removeAttribute('aria-describedby');
  }
}

export function stopPlacement() {
  active = false;
  if (pointerId !== null && staff.hasPointerCapture(pointerId)) staff.releasePointerCapture(pointerId);
  pointerId = null;
}

export function showPlacementQuestion(note) {
  stopPlacement();
  target = note;
  preview = null;
  active = true;
  document.getElementById('target-pitch').textContent = note.letter;
  document.getElementById('target-clef').textContent = CONFIG.CLEF_LABELS[note.clef];
  banner.className = 'feedback-banner';
  banner.textContent = '';
  refreshPlacement();
}

export function refreshPlacement() {
  if (target) renderNote(preview, { clef: target.clef, ghost: active });
}

function setPosition(position) {
  if (position === null) return;
  position = Math.max(CONFIG.PLACEMENT_MIN, Math.min(CONFIG.PLACEMENT_MAX, position));
  preview = { ...noteAtPosition(target.clef, position), clef: target.clef, position, accidental: 0 };
  refreshPlacement();
}

function updatePointer(event) {
  setPosition(positionAtPointer(event.clientX, event.clientY));
}

function submit() {
  if (!active || !preview) return;
  stopPlacement();
  onSubmit(preview);
}

staff.addEventListener('pointerdown', event => {
  if (!active || pointerId !== null || !event.isPrimary || event.button !== 0) return;
  event.preventDefault();
  staff.focus({ preventScroll: true });
  pointerId = event.pointerId;
  staff.setPointerCapture(pointerId);
  updatePointer(event);
});
staff.addEventListener('pointermove', event => {
  if (!active || !event.isPrimary) return;
  if (pointerId === event.pointerId || (pointerId === null && event.pointerType === 'mouse' && event.buttons === 0)) updatePointer(event);
});
staff.addEventListener('pointerup', event => {
  if (!active || event.pointerId !== pointerId) return;
  updatePointer(event);
  submit();
});
function cancelDrag() {
  pointerId = null;
  if (!active) return;
  preview = null;
  refreshPlacement();
}
staff.addEventListener('pointercancel', cancelDrag);
staff.addEventListener('lostpointercapture', () => { if (pointerId !== null) cancelDrag(); });
staff.addEventListener('pointerleave', () => { if (pointerId === null && active) cancelDrag(); });
staff.addEventListener('keydown', event => {
  if (!active) return;
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    setPosition((preview?.position ?? 4) + (event.key === 'ArrowUp' ? 1 : -1));
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    submit();
  }
});

export function showPlacementFeedback({ correct, note, timeout }) {
  stopPlacement();
  const chosen = preview;
  // On an error, show one valid placement; every matching octave is accepted.
  if (!correct) preview = note;
  refreshPlacement();
  banner.className = `feedback-banner show ${correct ? 'correct' : 'incorrect'}`;
  banner.textContent = correct ? '✓ Correct' : timeout
    ? '✗ Time’s up — one correct placement is shown'
    : `✗ You placed ${chosen.letter} — a correct placement is shown`;
}
