export const SIZE = 21;
export const WORDS = ['FIN', 'REEF', 'GILLS', 'SHARK', 'OCEAN', 'TEETH'];
export const DIR = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
export const key = ({ x, y }) => `${x},${y}`;
export const equal = (a, b) => a.x === b.x && a.y === b.y;
export function createMaze() {
  const walls = new Set();
  for (let i = 0; i < SIZE; i++) {
    walls.add(`${i},0`); walls.add(`${i},${SIZE - 1}`);
    walls.add(`0,${i}`); walls.add(`${SIZE - 1},${i}`);
  }
  for (const y of [3, 7, 13, 17]) for (const x of [3, 7, 13, 17]) {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) walls.add(`${x + dx},${y + dy}`);
  }
  return walls;
}
export const WALLS = createMaze();
export function seededRandom(seed = Date.now()) {
  let value = seed >>> 0;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}
export function createGame({ seed, mode = 'cruise' } = {}) {
  const game = { phase: 'ready', mode, score: 0, lives: 3, wordIndex: 0, letterIndex: 0, body: [], direction: 'right', turns: [], tiles: [], random: seededRandom(seed), tick: 0, event: 'ready' };
  resetBody(game); spawnTiles(game); return game;
}
export function resetBody(game) {
  game.body = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  game.direction = 'right'; game.turns = [];
}
export function nextLetter(game) { return WORDS[game.wordIndex]?.[game.letterIndex] ?? ''; }
export function interval(game) { return Math.max(game.mode === 'arcade' ? 125 : 180, (game.mode === 'arcade' ? 205 : 290) - game.wordIndex * 13); }
export function queueDirection(game, direction) {
  if (game.phase !== 'running' || !DIR[direction] || game.turns.length >= 2) return false;
  const previous = DIR[game.turns.at(-1) ?? game.direction]; const next = DIR[direction];
  if (previous.x + next.x === 0 && previous.y + next.y === 0) return false;
  if (game.turns.at(-1) === direction || (!game.turns.length && game.direction === direction)) return false;
  game.turns.push(direction); return true;
}
export function reachableCells(game) {
  const blocked = new Set([...WALLS, ...game.body.slice(1).map(key)]);
  const visited = new Set([key(game.body[0])]); const queue = [game.body[0]];
  for (let i = 0; i < queue.length; i++) for (const delta of Object.values(DIR)) {
    const next = { x: queue[i].x + delta.x, y: queue[i].y + delta.y }; const id = key(next);
    if (next.x < 0 || next.y < 0 || next.x >= SIZE || next.y >= SIZE || blocked.has(id) || visited.has(id)) continue;
    visited.add(id); queue.push(next);
  }
  return queue.filter(p => !game.body.some(b => equal(b, p)));
}
export function spawnTiles(game) {
  if (game.phase === 'won' || game.phase === 'over') { game.tiles = []; return; }
  const required = [...new Set(WORDS[game.wordIndex].slice(game.letterIndex))];
  const decoys = 'ABCDKLMNPRSTUV'.split('').filter(c => !required.includes(c));
  for (let i = decoys.length - 1; i > 0; i--) { const j = Math.floor(game.random() * (i + 1)); [decoys[i], decoys[j]] = [decoys[j], decoys[i]]; }
  const letters = [...required, ...decoys.slice(0, 3)];
  let cells = reachableCells(game).filter(p => Math.abs(p.x - game.body[0].x) + Math.abs(p.y - game.body[0].y) >= 3);
  // A long body can temporarily divide the reef. Keep food present beyond that
  // temporary barrier rather than silently deleting the next required letter.
  if (cells.length < letters.length) {
    cells = [];
    const occupied = new Set(game.body.map(key));
    for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) if (!WALLS.has(`${x},${y}`) && !occupied.has(`${x},${y}`)) cells.push({ x, y });
  }
  game.tiles = [];
  for (const letter of letters) {
    if (!cells.length) break;
    const i = Math.floor(game.random() * cells.length); const [position] = cells.splice(i, 1);
    game.tiles.push({ ...position, letter });
  }
}
export function startGame(game) { if (game.phase === 'ready' || game.phase === 'paused' || game.phase === 'hit') { game.phase = 'running'; game.event = 'swim'; } }
export function pauseGame(game) { if (game.phase === 'running') { game.phase = 'paused'; game.turns = []; return true; } return false; }
export function step(game) {
  if (game.phase !== 'running') return 'idle';
  game.tick++; game.event = 'swim';
  if (game.turns.length) game.direction = game.turns.shift();
  const delta = DIR[game.direction]; const head = { x: game.body[0].x + delta.x, y: game.body[0].y + delta.y };
  const tile = game.tiles.find(t => equal(t, head)); const correct = tile?.letter === nextLetter(game);
  // The tail vacates its cell on a non-growing step.
  const bodyToCheck = correct ? game.body : game.body.slice(0, -1);
  if (WALLS.has(key(head)) || head.x < 0 || head.y < 0 || head.x >= SIZE || head.y >= SIZE || bodyToCheck.some(p => equal(p, head))) {
    game.lives--; game.event = 'hit'; game.phase = game.lives ? 'hit' : 'over';
    resetBody(game); spawnTiles(game); return game.event;
  }
  game.body.unshift(head);
  if (!correct) game.body.pop();
  if (tile) {
    if (correct) {
      game.score += 50; game.letterIndex++; game.event = 'bite';
      if (game.letterIndex === WORDS[game.wordIndex].length) {
        game.score += 200 + 25 * game.wordIndex; game.wordIndex++; game.letterIndex = 0; game.event = 'word';
        if (game.wordIndex === WORDS.length) { game.phase = 'won'; game.event = 'won'; }
      }
    } else { game.score = Math.max(0, game.score - 25); game.event = 'wrong'; }
    spawnTiles(game);
  }
  return game.event;
}
