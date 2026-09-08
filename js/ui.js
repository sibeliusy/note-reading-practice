// ---------------------------------------------------------------------------
// ui.js
//
// All DOM manipulation, localStorage access, and screen transitions live
// here. This module owns "how things look"; game.js owns "what's true".
// main.js glues the two together by wiring GameEngine callbacks to the
// render* functions exported below.
// ---------------------------------------------------------------------------

import { CONFIG, PITCH_CLASS_NAMES, STORAGE_KEYS } from './config.js?v=natural-placement-1';
import { initNotation, renderNote, handleResize as resizeStaff } from './notation.js?v=natural-placement-1';
import { pitchClassOf } from './musicTheory.js?v=natural-placement-1';

// ---- DOM references --------------------------------------------------
const homeScreen = document.getElementById('home-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverModal = document.getElementById('game-over-modal');

const highScoreValueEl = document.getElementById('high-score-value');
const lastScoreValueEl = document.getElementById('last-score-value');
const clefHintEl = document.getElementById('clef-hint');
const ledgerStepperEl = document.getElementById('ledger-stepper');
const ledgerValueLabelEl = document.getElementById('ledger-value-label');
const soundEnabledEl = document.getElementById('sound-enabled');
const startButton = document.getElementById('start-button');
const quitButton = document.getElementById('quit-button');

const livesDisplayEl = document.getElementById('lives-display');
const scoreValueEl = document.getElementById('score-value');
const timerTrackEl = document.getElementById('timer-track');
const timerFillEl = document.getElementById('timer-fill');
const timerNumericEl = document.getElementById('timer-numeric');
const staffContainerEl = document.getElementById('staff-container');
const feedbackBannerEl = document.getElementById('feedback-banner');
const answerGridEl = document.getElementById('answer-grid');

const finalScoreValueEl = document.getElementById('final-score-value');
const modalHighScoreValueEl = document.getElementById('modal-high-score-value');
const newHighScoreBadgeEl = document.getElementById('new-high-score-badge');
const playAgainButton = document.getElementById('play-again-button');
const changeSettingsButton = document.getElementById('change-settings-button');

let notationInitialized = false;
let answerButtons = [];
let activeMode = 'read';
const scoreKey = (key) => activeMode === 'place' ? `${key}.place` : key;

// ---- localStorage -----------------------------------------------------
export function loadHighScore() {
  const raw = localStorage.getItem(scoreKey(STORAGE_KEYS.HIGH_SCORE));
  const value = raw === null ? 0 : parseInt(raw, 10);
  return Number.isFinite(value) ? value : 0;
}

export function saveHighScore(value) {
  localStorage.setItem(scoreKey(STORAGE_KEYS.HIGH_SCORE), String(value));
}

export function loadLastScore() {
  const raw = localStorage.getItem(scoreKey(STORAGE_KEYS.LAST_SCORE));
  const value = raw === null ? 0 : parseInt(raw, 10);
  return Number.isFinite(value) ? value : 0;
}

export function saveLastScore(value) {
  localStorage.setItem(scoreKey(STORAGE_KEYS.LAST_SCORE), String(value));
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.clefs) || typeof parsed.ledgerLines !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

// ---- Home screen --------------------------------------------------------
export function initHomeScreen({ onStart }) {
  const savedSettings = loadSettings();

  if (savedSettings) {
    document.querySelectorAll('input[name="clef"]').forEach((input) => {
      input.checked = savedSettings.clefs.includes(input.value);
    });
    setLedgerValue(savedSettings.ledgerLines);
    soundEnabledEl.checked = savedSettings.soundEnabled !== false;
  } else {
    setLedgerValue(CONFIG.LEDGER_DEFAULT);
  }

  const modeInputs = document.querySelectorAll('input[name="mode"]');
  const updateMode = () => {
    activeMode = document.querySelector('input[name="mode"]:checked').value;
    document.getElementById('ledger-setting').hidden = activeMode === 'place';
    refreshHomeStats();
  };
  modeInputs.forEach(input => {
    input.checked = input.value === (savedSettings?.mode === 'place' ? 'place' : 'read');
    input.addEventListener('change', updateMode);
  });
  updateMode();

  document.querySelectorAll('input[name="clef"]').forEach((input) => {
    input.addEventListener('change', () => {
      clefHintEl.hidden = getEnabledClefs().length > 0;
    });
  });

  ledgerStepperEl.querySelectorAll('.ledger-option').forEach((button) => {
    button.addEventListener('click', () => setLedgerValue(parseInt(button.dataset.value, 10)));
  });

  startButton.addEventListener('click', () => {
    const clefs = getEnabledClefs();
    if (clefs.length === 0) {
      clefHintEl.hidden = false;
      return;
    }
    const ledgerLines = getLedgerValue();
    const settings = { mode: activeMode, clefs, ledgerLines, soundEnabled: soundEnabledEl.checked };
    saveSettings(settings);
    onStart(settings);
  });
}

export function refreshHomeStats() {
  highScoreValueEl.textContent = loadHighScore();
  lastScoreValueEl.textContent = loadLastScore();
}

function getEnabledClefs() {
  return Array.from(document.querySelectorAll('input[name="clef"]:checked')).map((el) => el.value);
}

function setLedgerValue(value) {
  ledgerStepperEl.querySelectorAll('.ledger-option').forEach((button) => {
    const isSelected = parseInt(button.dataset.value, 10) === value;
    button.setAttribute('aria-checked', String(isSelected));
  });
  ledgerValueLabelEl.textContent = value === 1 ? '1 ledger line' : `${value} ledger lines`;
}

function getLedgerValue() {
  const active = ledgerStepperEl.querySelector('.ledger-option[aria-checked="true"]');
  return active ? parseInt(active.dataset.value, 10) : CONFIG.LEDGER_DEFAULT;
}

// ---- Screen transitions ---------------------------------------------------
export function showHomeScreen() {
  gameOverModal.hidden = true;
  gameScreen.hidden = true;
  homeScreen.hidden = false;
  refreshHomeStats();
}

export function showGameScreen() {
  homeScreen.hidden = true;
  gameOverModal.hidden = true;
  gameScreen.hidden = false;

  if (!notationInitialized) {
    initNotation(staffContainerEl);
    notationInitialized = true;
  }
}

// ---- Answer buttons ---------------------------------------------------
export function buildAnswerButtons(onAnswer) {
  answerGridEl.innerHTML = '';
  answerButtons = PITCH_CLASS_NAMES.map((label, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer-button';
    button.textContent = label;
    button.dataset.index = String(index);
    button.addEventListener('click', () => onAnswer(index));
    answerGridEl.appendChild(button);
    return button;
  });
}

function setAnswerButtonsEnabled(enabled) {
  answerButtons.forEach((button) => { button.disabled = !enabled; });
}

function clearAnswerButtonStates() {
  answerButtons.forEach((button) => {
    button.classList.remove('correct-reveal', 'incorrect-choice');
  });
}

// ---- In-game rendering --------------------------------------------------
export function renderQuestion(note) {
  clearAnswerButtonStates();
  feedbackBannerEl.className = 'feedback-banner';
  feedbackBannerEl.textContent = '';
  setAnswerButtonsEnabled(true);
  renderNote(note);
}

export function renderTick(remainingSeconds, limitSeconds) {
  const fraction = limitSeconds > 0 ? Math.max(remainingSeconds / limitSeconds, 0) : 0;
  timerFillEl.style.transform = `scaleX(${fraction})`;
  timerFillEl.classList.toggle('urgent', fraction <= 0.25);
  timerNumericEl.textContent = remainingSeconds.toFixed(1);
  timerTrackEl.setAttribute('aria-label', `${remainingSeconds.toFixed(1)} seconds remaining`);
}

export function renderScore(score) {
  scoreValueEl.textContent = String(score);
}

export function renderLives(lives) {
  const hearts = livesDisplayEl.querySelectorAll('.heart');
  hearts.forEach((heart, index) => {
    const shouldBeFilled = index < lives;
    const wasFilled = heart.classList.contains('filled');
    heart.classList.toggle('filled', shouldBeFilled);
    if (wasFilled && !shouldBeFilled) {
      heart.classList.add('just-lost');
      heart.addEventListener('animationend', () => heart.classList.remove('just-lost'), { once: true });
    }
  });
}

export function renderFeedback({ correct, note, timeout }, selectedIndex) {
  setAnswerButtonsEnabled(false);

  const correctIndex = pitchClassOf(note);
  const correctButton = answerButtons[correctIndex];
  correctButton.classList.add('correct-reveal');

  if (!correct && selectedIndex !== undefined && selectedIndex !== correctIndex) {
    answerButtons[selectedIndex].classList.add('incorrect-choice');
  }

  feedbackBannerEl.classList.remove('correct', 'incorrect');
  if (correct) {
    feedbackBannerEl.textContent = '✓ Correct';
    feedbackBannerEl.classList.add('correct');
  } else if (timeout) {
    feedbackBannerEl.textContent = `✗ Time’s up — that was ${PITCH_CLASS_NAMES[correctIndex]}`;
    feedbackBannerEl.classList.add('incorrect');
  } else {
    feedbackBannerEl.textContent = `✗ Not quite — that was ${PITCH_CLASS_NAMES[correctIndex]}`;
    feedbackBannerEl.classList.add('incorrect');
  }
  feedbackBannerEl.classList.add('show');
}

// ---- Game over ------------------------------------------------------------
export function showGameOver(score) {
  const previousHigh = loadHighScore();
  const isNewHigh = score > previousHigh;
  const highScore = isNewHigh ? score : previousHigh;

  if (isNewHigh) saveHighScore(highScore);
  saveLastScore(score);

  finalScoreValueEl.textContent = String(score);
  modalHighScoreValueEl.textContent = String(highScore);
  newHighScoreBadgeEl.hidden = !isNewHigh;

  gameOverModal.hidden = false;
}

export function wireGameOverActions({ onPlayAgain, onChangeSettings }) {
  playAgainButton.addEventListener('click', onPlayAgain);
  changeSettingsButton.addEventListener('click', onChangeSettings);
}

export function wireQuitButton(onQuit) {
  quitButton.onclick = onQuit;
}

// ---- Responsive staff ---------------------------------------------------
export function refreshStaffLayout(currentNote) {
  if (notationInitialized) resizeStaff(currentNote);
}
