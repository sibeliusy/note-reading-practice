// ---------------------------------------------------------------------------
// notation.js
//
// All VexFlow interaction lives here, isolated from game logic. Renders one
// staff + one note per call. Uses musicTheory.js's vexKey()/vexClefName()
// so the mapping from our internal pitch model to VexFlow is defined in
// exactly one place (musicTheory.js) and simply consumed here.
// ---------------------------------------------------------------------------

import { vexClefName, vexKey } from './musicTheory.js?v=mobile-staff-2';

function getVF() {
  // VexFlow 4's UMD bundle exposes `Vex.Flow`; newer standalone builds may
  // expose a top-level `VexFlow`. Support either so the CDN choice isn't
  // load-bearing.
  if (window.Vex && window.Vex.Flow) return window.Vex.Flow;
  if (window.VexFlow) return window.VexFlow;
  throw new Error('VexFlow failed to load.');
}

let renderer = null;
let context = null;
let containerEl = null;
let currentStave = null;

export function initNotation(container) {
  const VF = getVF();
  containerEl = container;
  renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
  sizeToContainer();
  context = renderer.getContext();
}

function sizeToContainer() {
  // Fit fewer notation units into the same screen area: this enlarges the
  // clef, notehead, and staff spacing together, including on narrow phones.
  const width = 160;
  const height = 140; // room for accidentals on the third ledger line above
  renderer.resize(width, height);
  const svg = containerEl.querySelector('svg');
  // VexFlow writes inline dimensions on BOTH elements during resize.
  // Remove those overrides so the responsive CSS can enlarge the music.
  containerEl.style.removeProperty('width');
  // Use actual available pixels rather than nested percentage heights.
  // The fixed-position container is independent of SVG intrinsic dimensions.
  const rect = containerEl.getBoundingClientRect();
  const scale = Math.max(0, Math.min(rect.width / width, rect.height / height, 3.3));
  svg.style.width = `${width * scale}px`;
  svg.style.height = `${height * scale}px`;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  return { width, height };
}

/** Call on resize/orientation-change so the staff stays sharp and centered. */
export function handleResize(currentNote) {
  if (!renderer) return;
  sizeToContainer();
  if (currentNote) renderNote(currentNote);
  else clearStaff();
}

export function clearStaff() {
  if (!context) return;
  context.clear();
}

/**
 * Draw a single clef + note, vertically centered with generous room for up
 * to a couple of ledger lines above and below.
 */
export function renderNote(note, { clef = note?.clef, ghost = false } = {}) {
  const VF = getVF();
  const { width, height } = sizeToContainer();
  context.clear();

  const staveWidth = 140;
  const staveX = (width - staveWidth) / 2;
  const staveY = height / 2 - 60; // leaves room above/below for ledger lines

  const stave = new VF.Stave(staveX, staveY, staveWidth);
  stave.setBegBarType(VF.Barline.type.NONE);
  stave.setEndBarType(VF.Barline.type.NONE);
  stave.addClef(vexClefName(clef));
  stave.setContext(context).draw();
  currentStave = stave;
  if (!note) return;

  const group = context.openGroup('placed-note');
  if (ghost) group.setAttribute('opacity', '0.45');

  const staveNote = new VF.StaveNote({
    clef: vexClefName(note.clef),
    keys: [vexKey(note)],
    duration: 'w',
  });

  if (note.accidental === 1) {
    staveNote.addModifier(new VF.Accidental('#'), 0);
  } else if (note.accidental === -1) {
    staveNote.addModifier(new VF.Accidental('b'), 0);
  }

  const voice = new VF.Voice({ num_beats: 1, beat_value: 4 });
  voice.setStrict(false);
  voice.addTickables([staveNote]);

  new VF.Formatter().joinVoices([voice]).format([voice], staveWidth - 80);
  // Place the note near the staff center, with space for an accidental
  // between the clef and notehead.
  staveNote.getTickContext().setX(width / 2 + 20 - stave.getNoteStartX());
  voice.draw(context, stave);
  context.closeGroup();
}

/** Convert screen coordinates through the SVG transform, including scaling. */
export function positionAtPointer(clientX, clientY) {
  const svg = containerEl.querySelector('svg');
  const matrix = svg.getScreenCTM();
  if (!matrix || !currentStave) return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const local = point.matrixTransform(matrix.inverse());
  const spacing = currentStave.getYForLine(1) - currentStave.getYForLine(0);
  return Math.round((currentStave.getYForLine(4) - local.y) / (spacing / 2));
}
