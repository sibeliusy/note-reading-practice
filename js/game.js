// ---------------------------------------------------------------------------
// game.js
//
// GameEngine owns all game *state and timing*: score, lives, the current
// question, the countdown, and the difficulty curve. It knows nothing about
// the DOM, VexFlow, or audio — it communicates purely through the callbacks
// passed in at construction. This separation is what will let a future
// "Place the Note" mode reuse the timer/scoring/lives machinery unchanged.
// ---------------------------------------------------------------------------

import { CONFIG } from './config.js?v=mobile-staff-2';
import { generateQuestion, pitchClassOf } from './musicTheory.js?v=mobile-staff-2';

/**
 * Time limit (seconds) for the question immediately following `correctCount`
 * correct answers so far this game. Exponential decay toward, but never
 * reaching, MIN_TIME_SECONDS. Isolated here so the curve is easy to retune.
 */
export function computeTimeLimit(correctCount) {
  const { START_TIME_SECONDS, MIN_TIME_SECONDS, TIME_DECAY_RATE } = CONFIG;
  return MIN_TIME_SECONDS + (START_TIME_SECONDS - MIN_TIME_SECONDS) * Math.pow(TIME_DECAY_RATE, correctCount);
}

export class GameEngine {
  /**
   * @param {object} opts
   * @param {string[]} opts.enabledClefs
   * @param {number} [opts.chromaticProbability] - chance of an accidental
   * @param {number} opts.ledgerLines
   * @param {object} opts.callbacks - onQuestion(note, timeLimit), onTick(remaining, limit),
   *   onFeedback({correct, note, timeout}), onLivesChange(n), onScoreChange(n), onGameOver(score)
   */
  constructor({ enabledClefs, ledgerLines, callbacks, chromaticProbability = CONFIG.CHROMATIC_PROBABILITY }) {
    this.enabledClefs = enabledClefs;
    this.ledgerLines = ledgerLines;
    this.chromaticProbability = chromaticProbability;
    this.callbacks = callbacks;
    this._rafId = null;
    this._feedbackTimeoutId = null;
    this.reset();
  }

  reset() {
    this._cancelTimers();
    this.score = 0;
    this.lives = CONFIG.STARTING_LIVES;
    this.correctCount = 0;
    this.currentNote = null;
    this.previousNote = null;
    this.roundId = 0;
    this.answered = true; // no active round until start()/_nextQuestion()
    this.questionStartTime = null;
    this.timeLimit = null;
  }

  start() {
    this.reset();
    this.callbacks.onLivesChange(this.lives);
    this.callbacks.onScoreChange(this.score);
    this._nextQuestion();
  }

  /** Cancel any in-flight rAF loop or pending feedback timeout. */
  _cancelTimers() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this._feedbackTimeoutId !== null) {
      clearTimeout(this._feedbackTimeoutId);
      this._feedbackTimeoutId = null;
    }
  }

  _nextQuestion() {
    this._cancelTimers();
    this.roundId += 1;
    const roundIdAtStart = this.roundId;
    this.answered = false;

    this.previousNote = this.currentNote;
    this.currentNote = generateQuestion({
      enabledClefs: this.enabledClefs,
      ledgerLines: this.ledgerLines,
      chromaticProbability: this.chromaticProbability,
      previous: this.previousNote,
    });

    this.timeLimit = computeTimeLimit(this.correctCount);
    this.questionStartTime = performance.now();

    this.callbacks.onQuestion(this.currentNote, this.timeLimit);
    this._runTimerLoop(roundIdAtStart);
  }

  _runTimerLoop(roundIdAtStart) {
    const step = () => {
      // A stale loop from a previous/cancelled round must never act.
      if (roundIdAtStart !== this.roundId || this.answered) return;

      const elapsedSeconds = (performance.now() - this.questionStartTime) / 1000;
      const remaining = Math.max(this.timeLimit - elapsedSeconds, 0);
      this.callbacks.onTick(remaining, this.timeLimit);

      if (remaining <= 0) {
        this._handleTimeout(roundIdAtStart);
        return;
      }
      this._rafId = requestAnimationFrame(step);
    };
    this._rafId = requestAnimationFrame(step);
  }

  _handleTimeout(roundIdAtStart) {
    if (roundIdAtStart !== this.roundId || this.answered) return;
    this.answered = true;
    this._cancelTimers();
    this.callbacks.onFeedback({ correct: false, note: this.currentNote, timeout: true });
    this._loseLife();
  }

  /** UI calls this with the tapped pitch-class index (0-11). */
  submitAnswer(pitchClassIndex) {
    if (this.answered || !this.currentNote) return; // ignore double-taps / stale input
    this.answered = true;
    this._cancelTimers();

    const isCorrect = pitchClassIndex === pitchClassOf(this.currentNote);
    if (isCorrect) {
      this.score += CONFIG.POINTS_PER_CORRECT;
      this.correctCount += 1;
      this.callbacks.onScoreChange(this.score);
      this.callbacks.onFeedback({ correct: true, note: this.currentNote });
      this._scheduleAfterFeedback(CONFIG.CORRECT_FEEDBACK_MS, () => this._nextQuestion());
    } else {
      this.callbacks.onFeedback({ correct: false, note: this.currentNote });
      this._loseLife();
    }
  }

  _loseLife() {
    this.lives -= 1;
    this.callbacks.onLivesChange(this.lives);

    if (this.lives <= 0) {
      this._scheduleAfterFeedback(CONFIG.INCORRECT_FEEDBACK_MS, () => this._endGame());
    } else {
      this._scheduleAfterFeedback(CONFIG.INCORRECT_FEEDBACK_MS, () => this._nextQuestion());
    }
  }

  _scheduleAfterFeedback(delayMs, onDone) {
    const roundIdAtStart = this.roundId;
    this._feedbackTimeoutId = setTimeout(() => {
      if (roundIdAtStart !== this.roundId) return; // game was reset/restarted meanwhile
      onDone();
    }, delayMs);
  }

  _endGame() {
    this._cancelTimers();
    this.callbacks.onGameOver(this.score);
  }

  /** Fully stop the engine (e.g. navigating away to settings mid-game). */
  stop() {
    this.roundId += 1; // invalidates any in-flight loops/timeouts
    this._cancelTimers();
  }
}
