import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import './style.css';
import { createGame, startGame, pauseGame, queueDirection, step, interval, nextLetter, WORDS } from './game.js';
import { createThreeView, createCanvasView } from './render.js';

const $ = id => document.getElementById(id);
let game = createGame({ seed: 2026 }); let elapsed = 0; let previousTime = 0; let lastPhase = '';
let best = 0; let sound = false; let audio;
try { best = Math.max(0, Math.min(999999, Number(localStorage.getItem('finword.best')) || 0)); sound = localStorage.getItem('finword.sound') === 'true'; } catch { /* Private browsing can disable storage. */ }
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let view;
function fallback() { view?.destroy(); view = createCanvasView($('scene')); document.body.dataset.renderer = 'canvas'; }
try { view = createThreeView($('scene'), fallback); } catch { fallback(); }
document.body.dataset.renderer = view.type;

function persist() { try { localStorage.setItem('finword.best', String(best)); localStorage.setItem('finword.sound', String(sound)); } catch { /* The game remains playable without storage. */ } }
function unlockAudio() { if (!sound) return; try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch { sound = false; updateSound(); } }
function beep(kind) {
  if (!sound || !audio) return;
  const notes = kind === 'word' || kind === 'won' ? [440, 554, 659, 880] : kind === 'hit' ? [160, 100] : kind === 'wrong' ? [180] : [580, 760];
  notes.forEach((frequency, i) => {
    const osc = audio.createOscillator(); const gain = audio.createGain(); const at = audio.currentTime + i * 0.07;
    osc.type = 'square'; osc.frequency.value = frequency; gain.gain.setValueAtTime(0.025, at); gain.gain.exponentialRampToValueAtTime(0.001, at + 0.10);
    osc.connect(gain); gain.connect(audio.destination); osc.start(at); osc.stop(at + 0.11);
  });
}
function updateSound() { $('sound').textContent = sound ? 'SOUND ON' : 'SOUND OFF'; $('sound').setAttribute('aria-pressed', String(sound)); }
function refresh(event = '') {
  if (game.score > best) { best = game.score; persist(); }
  $('score').textContent = String(game.score).padStart(5, '0'); $('best').textContent = String(best).padStart(5, '0');
  $('lives').textContent = Array.from({ length: 3 }, (_, i) => i < game.lives ? '▰' : '▱').join(' '); $('lives').setAttribute('aria-label', `${game.lives} lives`);
  const word = WORDS[Math.min(game.wordIndex, WORDS.length - 1)];
  $('round').textContent = `WORD ${String(Math.min(game.wordIndex + 1, 6)).padStart(2, '0')} / 06`;
  $('target').replaceChildren(...word.split('').map((letter, i) => { const span = document.createElement('span'); span.textContent = letter; if (game.phase === 'won' || i < game.letterIndex) span.className = 'eaten'; else if (i === game.letterIndex) span.className = 'active'; return span; }));
  $('target').setAttribute('aria-label', `Target word ${word}, ${game.phase === 'won' ? word.length : game.letterIndex} letters collected`);
  $('next-letter').textContent = nextLetter(game) || '✓'; $('length').textContent = `LENGTH ${String(game.body.length).padStart(2, '0')}`;
  $('pause').disabled = !['running', 'paused'].includes(game.phase); $('pause').textContent = game.phase === 'paused' ? '▶' : 'Ⅱ'; $('pause').setAttribute('aria-label', game.phase === 'paused' ? 'Resume game' : 'Pause game');
  const messages = { bite: `Good bite! Next up: ${nextLetter(game)}.`, word: `Word complete! +${200 + 25 * (game.wordIndex - 1)} bonus. Next word: ${WORDS[game.wordIndex]}.`, wrong: `Wrong letter. −25 points. Look for ${nextLetter(game)}.`, hit: 'Ouch! One fin down. Your word progress is safe.', won: 'REEF CLEARED. Six words. One very well-fed shark.', ready: 'Eat the next letter. Your shark grows with every correct bite.', swim: `Find ${nextLetter(game)}. Watch the walls and your tail.`, paused: 'Taking a breather. Resume when you’re ready.' };
  if (messages[event]) $('message').textContent = messages[event];
  if (event && ['bite', 'word', 'wrong', 'hit', 'won'].includes(event)) beep(event);
  document.body.dataset.phase = game.phase;
  if (lastPhase !== game.phase) { updateOverlay(); lastPhase = game.phase; }
}
function updateOverlay() {
  const phase = game.phase; $('overlay').hidden = phase === 'running';
  $('speed-label').hidden = !['ready', 'over', 'won'].includes(phase);
  const content = {
    ready: ['COIN-FREE. FIN-FULL.', 'FEED YOUR<br>INNER SHARK.', 'Spell six ocean words. Collect letters in order.<br>Watch the walls. Watch your tail.', 'LET’S SWIM ▶'],
    paused: ['TAKE A BREATHER', 'JUST KEEP<br>SWIMMING.', 'Your reef is on pause. Everything will be right here.', 'BACK TO THE REEF ▶'],
    hit: ['A LITTLE REEF RASH', `${game.lives} FIN${game.lives === 1 ? '' : 'S'} LEFT.<br>YOU’VE GOT THIS.`, 'Your length resets. Your letters and score stay.<br>Ready for another bite?', 'SWIM AGAIN ▶'],
    over: ['THAT’S A WRAP', 'OUT OF FINS.<br>STILL HUNGRY?', `You scored ${game.score} points.<br>There’s always another swim.`, 'ONE MORE RUN ↻'],
    won: ['THE REEF IS YOURS', 'BIG FIN.<br>BIGGER BRAIN.', `Six words cleared. ${game.score} points.<br>Now that’s a balanced alphabet.`, 'ANOTHER BITE ↻']
  }[phase];
  if (content) { $('overlay-kicker').textContent = content[0]; $('overlay-title').innerHTML = content[1]; $('overlay-copy').innerHTML = content[2]; $('start').textContent = content[3]; }
  // Keep keyboard users at an actionable control after a collision or finish.
  if (['hit', 'over', 'won'].includes(phase)) $('start').focus({ preventScroll: true });
}
function newRun() { game = createGame({ mode: $('speed').value }); elapsed = 0; lastPhase = ''; refresh('ready'); }
function resume() {
  if (['over', 'won'].includes(game.phase)) newRun();
  if (game.phase === 'ready') game.mode = $('speed').value;
  startGame(game); elapsed = -350; unlockAudio(); refresh('swim'); $('arena').focus({ preventScroll: true });
  if (window.innerWidth <= 760) $('arcade').scrollIntoView({ block: 'start', behavior: 'instant' });
}
function pause() { if (game.phase === 'running') { pauseGame(game); elapsed = 0; refresh('paused'); } else if (game.phase === 'paused') resume(); }
$('start').addEventListener('click', resume);
$('pause').addEventListener('click', pause);
$('restart').addEventListener('click', () => { newRun(); $('start').focus({ preventScroll: true }); });
$('sound').addEventListener('click', () => { sound = !sound; unlockAudio(); updateSound(); persist(); if (sound) beep('bite'); });
const keys = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLSelectElement || event.ctrlKey || event.metaKey || event.altKey) return;
  const inGame = $('arcade').contains(document.activeElement);
  if (!inGame) return;
  if (keys[event.key] && game.phase === 'running') { event.preventDefault(); if (!event.repeat) queueDirection(game, keys[event.key]); }
  if ((event.code === 'Space' || event.key === 'Escape') && event.target.tagName !== 'BUTTON') { event.preventDefault(); if (!event.repeat) pause(); }
});
document.querySelectorAll('[data-dir]').forEach(button => button.addEventListener('pointerdown', event => { event.preventDefault(); queueDirection(game, button.dataset.dir); $('arena').focus({ preventScroll: true }); }));
let touch;
$('arena').addEventListener('pointerdown', event => { if (event.target.closest('button, select, label') || game.phase !== 'running') return; touch = { x: event.clientX, y: event.clientY }; $('arena').setPointerCapture(event.pointerId); });
$('arena').addEventListener('pointerup', event => { if (!touch) return; const dx = event.clientX - touch.x; const dy = event.clientY - touch.y; if (Math.max(Math.abs(dx), Math.abs(dy)) > 14) queueDirection(game, Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up'); touch = null; });
$('arena').addEventListener('pointercancel', () => { touch = null; });
document.addEventListener('visibilitychange', () => { if (document.hidden && game.phase === 'running') pause(); });
window.addEventListener('blur', () => { if (game.phase === 'running') pause(); });
document.querySelector('.jump').addEventListener('click', () => { if (game.phase === 'running') $('arena').focus({ preventScroll: true }); else $('start').focus({ preventScroll: true }); });
function frame(time) {
  const delta = previousTime ? Math.min(time - previousTime, 100) : 0; previousTime = time;
  if (game.phase === 'running') {
    elapsed += delta;
    if (elapsed >= interval(game)) { elapsed -= interval(game); const event = step(game); if (event !== 'swim') refresh(event); }
  }
  if (!document.hidden) view.draw(game, Math.max(0, elapsed / interval(game)), time, reducedMotion.matches);
  requestAnimationFrame(frame);
}
updateSound(); refresh('ready'); requestAnimationFrame(frame);

// Local development only: deterministic playtest access is stripped from production.
if (import.meta.env.DEV) window.__finword = { get game() { return game; }, step() { const event = step(game); refresh(event); return event; }, direction: direction => queueDirection(game, direction), refresh, get view() { return view; } };
