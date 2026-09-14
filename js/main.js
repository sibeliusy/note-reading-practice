// ---------------------------------------------------------------------------
// main.js — application bootstrap. Wires GameEngine (state) to ui.js
// (rendering) and audio.js (sound), and owns the two top-level screen
// transitions (home <-> game <-> game-over).
// ---------------------------------------------------------------------------

import { CONFIG } from './config.js?v=mobile-staff-2';
import { GameEngine } from './game.js?v=mobile-staff-2';
import { frequencyOf, pitchClassOf } from './musicTheory.js?v=mobile-staff-2';
import * as placement from './placement.js?v=mobile-staff-2';
import { unlockAudio, playTone } from './audio.js?v=mobile-staff-2';
import * as ui from './ui.js?v=mobile-staff-2';

let engine = null;
let lastSelectedIndex = undefined;
let mode = 'read';

function startGame({ clefs, ledgerLines, soundEnabled = true, mode: selectedMode = 'read' }) {
  if (engine) engine.stop();
  mode = selectedMode;
  if (soundEnabled) unlockAudio(); // must happen inside this click handler for autoplay policies

  ui.showGameScreen();
  placement.configurePlacement(mode === 'place', note => {
    if (note.position >= CONFIG.PLACEMENT_MIN && note.position <= CONFIG.PLACEMENT_MAX) {
      engine.submitAnswer(pitchClassOf(note));
    }
  });
  ui.buildAnswerButtons(handleAnswer);
  ui.wireQuitButton(handleQuit);

  engine = new GameEngine({
    enabledClefs: clefs,
    ledgerLines: mode === 'place' ? 2 : ledgerLines,
    chromaticProbability: mode === 'place' ? 0 : CONFIG.CHROMATIC_PROBABILITY,
    callbacks: {
      onQuestion: (note, timeLimit) => {
        lastSelectedIndex = undefined; // no answer chosen yet for this round (matters for timeouts)
        if (mode === 'place') placement.showPlacementQuestion(note);
        else ui.renderQuestion(note);
        ui.renderTick(timeLimit, timeLimit);
        if (soundEnabled) playTone(frequencyOf(note));
      },
      onTick: (remaining, limit) => ui.renderTick(remaining, limit),
      onFeedback: (result) => mode === 'place'
        ? placement.showPlacementFeedback(result)
        : ui.renderFeedback(result, lastSelectedIndex),
      onLivesChange: (lives) => ui.renderLives(lives),
      onScoreChange: (score) => ui.renderScore(score),
      onGameOver: (score) => ui.showGameOver(score),
    },
  });

  engine.start();
}

function handleAnswer(index) {
  lastSelectedIndex = index;
  if (engine) engine.submitAnswer(index);
}

function handleQuit() {
  placement.stopPlacement();
  if (engine) engine.stop();
  ui.showHomeScreen();
}

function returnToSettings() {
  placement.stopPlacement();
  if (engine) engine.stop();
  ui.showHomeScreen();
}

function playAgainWithSameSettings() {
  // Re-read whatever is currently configured on the (still up-to-date) home
  // form via a fresh startGame call routed through initHomeScreen's saved
  // settings would require re-reading the DOM; simplest robust path is to
  // just re-run the last configuration stored by ui.js.
  const settings = ui.loadSettings();
  if (settings) {
    startGame(settings);
  } else {
    ui.showHomeScreen();
  }
}

function boot() {
  ui.initHomeScreen({ onStart: startGame });
  ui.wireGameOverActions({
    onPlayAgain: playAgainWithSameSettings,
    onChangeSettings: returnToSettings,
  });

  let resizeFrame = null;
  const scheduleLayout = () => {
    if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      refreshLayout();
    });
  };
  window.addEventListener('resize', scheduleLayout);
  window.visualViewport?.addEventListener('resize', scheduleLayout);
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(scheduleLayout);
    observer.observe(document.getElementById('staff-container'));
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshLayout();
    }
  });
}

function refreshLayout() {
  if (document.getElementById('game-screen').hidden) return;
  if (mode === 'place') placement.refreshPlacement();
  else ui.refreshStaffLayout(engine ? engine.currentNote : null);
}

boot();
