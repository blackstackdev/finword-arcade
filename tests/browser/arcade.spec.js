import { test, expect } from '@playwright/test';
import { WALLS, DIR, key } from '../../src/game.js';
const keyNames = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

function route(game) {
  const target = game.tiles.find(t => t.letter === ['FIN', 'REEF', 'GILLS', 'SHARK', 'OCEAN', 'TEETH'][game.wordIndex][game.letterIndex]);
  if (!target) throw new Error(`Missing required tile ${game.wordIndex}:${game.letterIndex}`);
  const blocked = new Set([...WALLS, ...game.tiles.filter(t => t.letter !== target.letter).map(key)]);
  const staticBlocked = new Set([...blocked, ...game.body.slice(1).map(key)]);
  const simple = [{ ...game.body[0], path: [] }]; const staticSeen = new Set();
  for (let i = 0; i < simple.length; i++) {
    const p = simple[i]; if (p.x === target.x && p.y === target.y) return p.path;
    for (const [name, d] of Object.entries(DIR)) { const n = { x: p.x + d.x, y: p.y + d.y }; const id = key(n); if (staticBlocked.has(id) || staticSeen.has(id)) continue; staticSeen.add(id); simple.push({ ...n, path: [...p.path, name] }); }
  }
  const queue = [{ ...game.body[0], path: [], body: game.body }]; const seen = new Set();
  for (let i = 0; queue.length && i < 40000; i++) {
    const cost = p => p.path.length + Math.abs(p.x - target.x) + Math.abs(p.y - target.y);
    queue.sort((a, b) => cost(a) - cost(b) || b.path.length - a.path.length);
    const p = queue.shift();
    if (p.x === target.x && p.y === target.y) return p.path;
    for (const [name, d] of Object.entries(DIR)) {
      const n = { x: p.x + d.x, y: p.y + d.y }; const id = key(n);
      if (blocked.has(id) || p.body.slice(0, -1).some(b => b.x === n.x && b.y === n.y)) continue;
      const body = [n, ...p.body.slice(0, -1)]; const signature = body.map(key).join(';');
      if (seen.has(signature)) continue; seen.add(signature); queue.push({ ...n, body, path: [...p.path, name] });
    }
  }
  return null;
}

test('real keyboard/touch play, letters grow the shark, pause, persistence, responsive UI', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.clock.install();
  await page.goto('/'); await page.clock.pauseAt(new Date(Date.now() + 10000));
  await expect(page.locator('#start')).toBeVisible();
  await expect(page.locator('canvas[data-renderer="three"]')).toBeVisible();
  await page.screenshot({ path: `release/screenshots/${info.project.name}-ready.png`, fullPage: true });
  await page.locator('#start').click(); await expect(page.locator('#overlay')).toBeHidden();
  const initial = await page.evaluate(() => window.__finword.game);
  const path = route(initial); expect(path?.length).toBeGreaterThan(0);
  for (const direction of path) {
    if (info.project.name === 'mobile') await page.locator(`[data-dir="${direction}"]`).dispatchEvent('pointerdown');
    else await page.keyboard.press(keyNames[direction]);
    await page.evaluate(() => window.__finword.step());
  }
  await expect(page.locator('#score')).toHaveText('00050'); await expect(page.locator('#length')).toHaveText('LENGTH 04');
  await page.clock.runFor(16);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `release/screenshots/${info.project.name}-playing.png`, fullPage: true });
  await page.keyboard.press('Space'); await expect(page.locator('#overlay')).toBeVisible();
  const tick = await page.evaluate(() => window.__finword.game.tick); await page.clock.runFor(1000); expect(await page.evaluate(() => window.__finword.game.tick)).toBe(tick);
  await page.locator('#start').click(); await expect(page.locator('#overlay')).toBeHidden();
  // The actual animation loop advances movement, not only the test step helper.
  await page.clock.runFor(700); expect(await page.evaluate(() => window.__finword.game.tick)).toBeGreaterThan(tick);
  await page.locator('#restart').click(); await expect(page.locator('#score')).toHaveText('00000');
  await expect(page.locator('#best')).toHaveText('00050');
  await page.reload(); await expect(page.locator('#best')).toHaveText('00050');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const imageSize = await page.locator('#scene canvas').boundingBox(); expect(imageSize.width).toBeGreaterThan(250);
  expect(errors).toEqual([]);
});

test('a navigated six-word run reaches the win screen and can restart', async ({ page }, info) => {
  await page.clock.install(); await page.goto('/'); await page.clock.pauseAt(new Date(Date.now() + 10000));
  // Fixed seed makes the navigation acceptance check reproducible.
  await page.evaluate(async () => { const { seededRandom } = await import('/src/game.js'); window.__finword.game.random = seededRandom(29); });
  await page.locator('#start').click();
  let bites = 0;
  for (let wordLetter = 0; wordLetter < 35; wordLetter++) {
    const game = await page.evaluate(() => window.__finword.game); if (game.phase === 'won') break;
    const path = route(game);
    if (!path) {
      // A shortest-route player can enclose itself. Exercise the real recovery
      // path, retaining spelling progress, rather than editing the live state.
      for (let i = 0; i < 25; i++) { if ((await page.evaluate(() => window.__finword.game.phase)) !== 'running') break; await page.evaluate(() => window.__finword.step()); }
      expect(await page.evaluate(() => window.__finword.game.lives)).toBeGreaterThan(0);
      await page.locator('#start').click(); continue;
    }
    for (const direction of path) { await page.keyboard.press(keyNames[direction]); await page.evaluate(() => window.__finword.step()); }
    bites++;
  }
  expect(bites).toBe(27); await expect(page.locator('#overlay-title')).toHaveText('BIG FIN.BIGGER BRAIN.');
  expect(await page.evaluate(() => window.__finword.game.lives)).toBeGreaterThan(0);
  await page.clock.runFor(16); await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `release/screenshots/${info.project.name}-win.png`, fullPage: true });
  await page.locator('#start').click(); await expect(page.locator('#score')).toHaveText('00000'); await expect(page.locator('#overlay')).toBeHidden();
});

test('WebGL failure degrades to a playable canvas and reduced motion does not break layout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type.startsWith('webgl') ? null : original.call(this, type, ...args); };
  });
  await page.goto('/'); await expect(page.locator('canvas[data-renderer="canvas"]')).toBeVisible();
  await page.locator('#start').click(); await expect(page.locator('#overlay')).toBeHidden(); await page.keyboard.press('ArrowUp');
  await expect(page.locator('#scene canvas')).toBeVisible();
});

test('GPU context loss recovers and blocked storage does not prevent play', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage disabled'); } }); });
  await page.goto('/'); await page.locator('#start').click();
  await page.evaluate(() => document.querySelector('#scene canvas').dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await expect(page.locator('canvas[data-renderer="canvas"]')).toBeVisible();
  await page.locator('#pause').click(); await expect(page.locator('#overlay')).toBeVisible(); await page.locator('#start').click();
  await expect(page.locator('#overlay')).toBeHidden();
});
