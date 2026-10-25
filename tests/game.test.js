import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, WALLS, WORDS, DIR, key, equal, reachableCells, nextLetter, queueDirection, startGame, pauseGame, step, interval, spawnTiles } from '../src/game.js';

function running() { const game = createGame({ seed: 7 }); startGame(game); return game; }
function feed(game, letter = nextLetter(game)) { const head = game.body[0]; const direction = DIR[game.direction]; game.tiles = [{ x: head.x + direction.x, y: head.y + direction.y, letter }]; return step(game); }
test('maze has one connected playable area and a safe starting lane', () => {
  const game = createGame(); assert.equal(reachableCells(game).length, 21 * 21 - WALLS.size - game.body.length);
  assert.ok(!WALLS.has('11,10')); assert.ok(!WALLS.has('12,10'));
});
test('correct letters grow the shark and completing a word awards a bonus', () => {
  const game = running(); assert.equal(feed(game, 'F'), 'bite'); assert.equal(game.body.length, 4); assert.equal(game.score, 50);
  feed(game, 'I'); assert.equal(feed(game, 'N'), 'word'); assert.equal(game.wordIndex, 1); assert.equal(game.score, 350); assert.equal(game.body.length, 6);
});
test('wrong letters cost points without losing progress or shrinking', () => {
  const game = running(); feed(game); const length = game.body.length;
  assert.equal(feed(game, 'Z'), 'wrong'); assert.equal(game.score, 25); assert.equal(game.letterIndex, 1); assert.equal(game.body.length, length);
  assert.ok(game.tiles.some(t => t.letter === nextLetter(game)));
});
test('reverse turns and rapid duplicate input cannot reverse into the neck', () => {
  const game = running(); assert.equal(queueDirection(game, 'left'), false); assert.equal(queueDirection(game, 'right'), false);
  assert.equal(queueDirection(game, 'up'), true); assert.equal(queueDirection(game, 'down'), false); assert.equal(queueDirection(game, 'left'), true); assert.equal(queueDirection(game, 'up'), false);
  step(game); assert.equal(game.direction, 'up'); step(game); assert.equal(game.direction, 'left'); assert.equal(game.lives, 3);
});
test('wall collisions preserve words/score, reset length and stop until resumed', () => {
  const game = running(); game.body = [{ x: 19, y: 10 }, { x: 18, y: 10 }, { x: 17, y: 10 }]; game.score = 80; game.letterIndex = 1;
  assert.equal(step(game), 'hit'); assert.equal(game.lives, 2); assert.equal(game.phase, 'hit'); assert.equal(game.score, 80); assert.equal(game.letterIndex, 1); assert.equal(game.body.length, 3);
  const snapshot = JSON.stringify(game.body); assert.equal(step(game), 'idle'); assert.equal(JSON.stringify(game.body), snapshot);
});
test('third collision ends the run; pausing never advances simulation', () => {
  const game = running(); pauseGame(game); assert.equal(step(game), 'idle'); assert.equal(game.tick, 0); startGame(game);
  game.lives = 1; game.body[0] = { x: 19, y: 10 }; step(game); assert.equal(game.phase, 'over'); assert.equal(game.lives, 0); assert.equal(game.tiles.length, 0);
});
test('moving into a vacating tail is legal; another body cell is a hit', () => {
  const game = running(); game.body = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 11, y: 11 }, { x: 11, y: 10 }]; game.tiles = [];
  assert.equal(step(game), 'swim'); assert.equal(game.lives, 3);
  game.body = [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 12, y: 10 }]; step(game); assert.equal(game.event, 'hit');
});
test('food never lands in walls/body and always includes the next required letter', () => {
  for (let seed = 0; seed < 100; seed++) {
    const game = createGame({ seed }); const seen = new Set(); const reachable = new Set(reachableCells(game).map(key));
    for (const tile of game.tiles) { assert.ok(!WALLS.has(key(tile))); assert.ok(reachable.has(key(tile))); assert.ok(!seen.has(key(tile))); seen.add(key(tile)); }
    assert.ok(game.tiles.some(t => t.letter === nextLetter(game)));
  }
});
test('repeated letters survive spawning and all six words can finish a run', () => {
  const game = running();
  for (const word of WORDS) for (const letter of word) {
    // Isolate spelling from navigation with a fresh safe lane each step.
    game.body = [{ x: 10, y: 10 }, ...game.body.slice(1).map((_, i) => ({ x: 1, y: 1 + i }))]; game.direction = 'right';
    assert.equal(nextLetter(game), letter); feed(game, letter);
    if (game.phase !== 'won') assert.ok(game.tiles.some(t => t.letter === nextLetter(game)));
  }
  assert.equal(game.phase, 'won'); assert.equal(game.wordIndex, 6); assert.equal(game.tiles.length, 0); assert.ok(game.score > 2500);
});
test('mode affects pacing and fresh games do not inherit old scores', () => {
  assert.ok(interval(createGame({ mode: 'cruise' })) > interval(createGame({ mode: 'arcade' })));
  const game = running(); feed(game); assert.equal(createGame().score, 0); assert.equal(createGame().lives, 3);
});
test('a body temporarily enclosing the head cannot erase required food', () => {
  const game = running(); game.body = [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 }];
  spawnTiles(game); assert.ok(game.tiles.some(t => t.letter === nextLetter(game))); assert.ok(game.tiles.length >= 4);
});
