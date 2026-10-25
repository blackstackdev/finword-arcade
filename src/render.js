import * as THREE from 'three';
import { SIZE, WALLS, DIR, key } from './game.js';

const COLORS = { water: 0x091e2a, wall: 0x123c51, rim: 0x448dc4, shark: 0x72d8d6, belly: 0xd3f6e6, fin: 0x3ca9b4 };
const position = (p, height = 0) => new THREE.Vector3(p.x - 10, height, p.y - 10);

function triangle(vertices, color) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.8 }));
}

export function createThreeView(host, onContextLost) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.setClearColor(COLORS.water);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-11.3, 11.3, 11.3, -11.3, 0.1, 100);
  camera.position.set(0, 32, 9); camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xe4ffff, 0x204358, 2.8));
  const light = new THREE.DirectionalLight(0xffffff, 2.2); light.position.set(-8, 20, -5); scene.add(light);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(21, 21), new THREE.MeshBasicMaterial({ color: COLORS.water }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.12; scene.add(floor);
  const grid = new THREE.GridHelper(21, 21, 0x174052, 0x123143); grid.position.y = -0.1; scene.add(grid);
  const boxGeo = new THREE.BoxGeometry(0.94, 0.52, 0.94);
  const walls = new THREE.InstancedMesh(boxGeo, new THREE.MeshStandardMaterial({ color: COLORS.wall, roughness: 0.9, metalness: 0.08 }), WALLS.size);
  const matrix = new THREE.Matrix4(); const edges = [];
  let wallIndex = 0;
  for (const cell of WALLS) {
    const [x, z] = cell.split(',').map(Number); const wx = x - 10; const wz = z - 10;
    walls.setMatrixAt(wallIndex++, matrix.makeTranslation(wx, 0.16, wz));
    const r = 0.47; const y = 0.43;
    for (const [a, b, c, d] of [[-r, -r, r, -r], [r, -r, r, r], [r, r, -r, r], [-r, r, -r, -r]]) edges.push(wx + a, y, wz + b, wx + c, y, wz + d);
  }
  scene.add(walls);
  const edgeGeo = new THREE.BufferGeometry(); edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3));
  scene.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: COLORS.rim, transparent: true, opacity: 0.9 })));
  const dotGeo = new THREE.BufferGeometry(); const dots = [];
  for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) if (!WALLS.has(`${x},${y}`)) dots.push(x - 10, 0.02, y - 10);
  dotGeo.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
  scene.add(new THREE.Points(dotGeo, new THREE.PointsMaterial({ color: 0x42717b, size: 0.055, sizeAttenuation: true })));

  const head = new THREE.Group(); scene.add(head);
  const skin = new THREE.MeshStandardMaterial({ color: COLORS.shark, roughness: 0.7 });
  const darkFin = new THREE.MeshStandardMaterial({ color: COLORS.fin, roughness: 0.8 });
  const bodyGeo = new THREE.SphereGeometry(0.36, 10, 7);
  const skull = new THREE.Mesh(bodyGeo, skin); skull.scale.set(1.6, 0.74, 1.03); skull.position.y = 0.43; head.add(skull);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.31, 0.58, 8), skin); nose.rotation.z = -Math.PI / 2; nose.position.set(0.52, 0.43, 0); nose.scale.y = 0.95; head.add(nose);
  const belly = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: COLORS.belly })); belly.position.set(0.08, 0.29, 0); belly.scale.set(1.5, 0.38, 0.89); head.add(belly);
  head.add(triangle([-0.34, 0.55, 0, -0.5, 1.14, 0, 0.16, 0.55, 0], COLORS.fin));
  head.add(triangle([-0.24, 0.37, 0.2, -0.66, 0.30, 0.81, 0.16, 0.37, 0.28], COLORS.fin));
  head.add(triangle([-0.24, 0.37, -0.2, 0.16, 0.37, -0.28, -0.66, 0.30, -0.81], COLORS.fin));
  const eyeGeo = new THREE.SphereGeometry(0.085, 8, 6); const eyeMat = new THREE.MeshBasicMaterial({ color: 0x05151d });
  for (const z of [-0.26, 0.26]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat); eye.position.set(0.32, 0.61, z); head.add(eye);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.024, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffffff })); shine.position.set(0.35, 0.676, z); head.add(shine);
  }
  const gillsGeo = new THREE.BufferGeometry(); const gills = [];
  for (const x of [-0.12, -0.24, -0.36]) gills.push(x, 0.64, 0.18, x - 0.04, 0.54, 0.28);
  gillsGeo.setAttribute('position', new THREE.Float32BufferAttribute(gills, 3)); head.add(new THREE.LineSegments(gillsGeo, new THREE.LineBasicMaterial({ color: 0x1c7181 })));
  const segments = []; const segmentMat = new THREE.MeshStandardMaterial({ color: 0x58c4cc, roughness: 0.8 });
  const tail = new THREE.Group();
  tail.add(triangle([0.2, 0.40, 0, -0.5, 0.44, -0.61, -0.25, 0.40, 0], COLORS.fin));
  tail.add(triangle([0.2, 0.40, 0, -0.25, 0.40, 0, -0.5, 0.44, 0.61], COLORS.fin)); scene.add(tail);
  const letterGroup = new THREE.Group(); scene.add(letterGroup); const textureCache = new Map(); let tileSignature = '';
  function letterTexture(letter) {
    if (textureCache.has(letter)) return textureCache.get(letter);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d8ec9c'; ctx.fillRect(6, 6, 116, 116); ctx.fillStyle = '#a3ba68'; ctx.fillRect(6, 111, 116, 11);
    ctx.strokeStyle = '#f0ffd1'; ctx.lineWidth = 4; ctx.strokeRect(8, 8, 112, 112);
    ctx.fillStyle = '#102927'; ctx.font = 'bold 86px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(letter, 64, 66);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.NearestFilter;
    textureCache.set(letter, texture); return texture;
  }
  host.replaceChildren(renderer.domElement); renderer.domElement.setAttribute('data-renderer', 'three');
  const resize = () => {
    const width = host.clientWidth; const height = host.clientHeight; const aspect = width / height;
    const half = 11.15; camera.left = -half * Math.max(1, aspect); camera.right = -camera.left;
    camera.top = half * Math.max(1, 1 / aspect); camera.bottom = -camera.top; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const lost = event => { event.preventDefault(); onContextLost(); }; renderer.domElement.addEventListener('webglcontextlost', lost);
  let lastTick = -1; let previousBody = []; let previousDirection = 'right';
  return {
    type: 'three',
    draw(game, progress, time, reducedMotion) {
      if (game.tick !== lastTick) {
        // Old positions are one simulation cell behind the new body.
        previousBody = game.body.map((p, i) => game.event === 'hit' ? p : (game.body[i + 1] ?? p));
        if (lastTick < 0 || game.phase !== 'running' || game.event === 'hit') previousBody = game.body.map(p => ({ ...p }));
        lastTick = game.tick;
      }
      const t = game.phase === 'running' ? Math.min(1, progress) : 1;
      const targetPosition = position(game.body[0]);
      head.position.copy(position(previousBody[0] ?? game.body[0])).lerp(targetPosition, t);
      const dir = DIR[game.direction]; head.rotation.y = Math.atan2(-dir.y, dir.x);
      head.scale.setScalar(1 + Math.min(game.body.length - 3, 25) * 0.006);
      while (segments.length < game.body.length - 1) { const mesh = new THREE.Mesh(bodyGeo, segmentMat); segments.push(mesh); scene.add(mesh); }
      segments.forEach((mesh, i) => {
        mesh.visible = i < game.body.length - 1; if (!mesh.visible) return;
        mesh.position.copy(position(previousBody[i + 1] ?? game.body[i + 1], 0.32)).lerp(position(game.body[i + 1], 0.32), t);
        const size = Math.max(0.45, 1 - i / (game.body.length + 2) * 0.6); mesh.scale.set(size * 1.18, size * 0.64, size * 1.18);
      });
      const end = game.body.at(-1); const beforeEnd = game.body.at(-2); tail.position.copy(position(previousBody.at(-1) ?? end)).lerp(position(end), t);
      tail.rotation.y = Math.atan2(-(beforeEnd.y - end.y), beforeEnd.x - end.x) + (reducedMotion ? 0 : Math.sin(time * 0.008) * 0.10);
      const signature = game.tiles.map(tile => `${key(tile)}:${tile.letter}`).join(';');
      if (signature !== tileSignature) {
        for (const child of [...letterGroup.children]) { child.material.dispose(); letterGroup.remove(child); }
        for (const tile of game.tiles) { const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture(tile.letter), depthTest: true })); sprite.position.copy(position(tile, 0.67)); sprite.scale.set(0.82, 0.82, 1); letterGroup.add(sprite); }
        tileSignature = signature;
      }
      renderer.render(scene, camera); previousDirection = game.direction;
    },
    destroy() {
      observer.disconnect(); renderer.domElement.removeEventListener('webglcontextlost', lost);
      const geometries = new Set(); const materials = new Set();
      scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textureCache.forEach(t => t.dispose()); renderer.dispose(); renderer.domElement.remove();
    }
  };
}

export function createCanvasView(host) {
  const canvas = document.createElement('canvas'); canvas.dataset.renderer = 'canvas'; host.replaceChildren(canvas);
  const ctx = canvas.getContext('2d');
  const resize = () => { const size = Math.min(host.clientWidth, host.clientHeight) * Math.min(window.devicePixelRatio, 2); canvas.width = canvas.height = Math.max(1, Math.round(size)); };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  return {
    type: 'canvas',
    draw(game) {
      const cell = canvas.width / SIZE; ctx.fillStyle = '#091e2a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const wall of WALLS) { const [x, y] = wall.split(',').map(Number); ctx.fillStyle = '#123c51'; ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2); ctx.strokeStyle = '#448dc4'; ctx.lineWidth = 1; ctx.strokeRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2); }
      for (const tile of game.tiles) { ctx.fillStyle = '#d8ec9c'; ctx.fillRect((tile.x + 0.12) * cell, (tile.y + 0.12) * cell, cell * 0.76, cell * 0.76); ctx.fillStyle = '#102927'; ctx.font = `bold ${cell * 0.6}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tile.letter, (tile.x + 0.5) * cell, (tile.y + 0.53) * cell); }
      game.body.slice().reverse().forEach((part, index) => { ctx.fillStyle = index === game.body.length - 1 ? '#9ce6dd' : '#58c4cc'; ctx.beginPath(); ctx.ellipse((part.x + 0.5) * cell, (part.y + 0.5) * cell, cell * 0.40, cell * 0.31, 0, 0, Math.PI * 2); ctx.fill(); });
      const head = game.body[0]; const dir = DIR[game.direction]; const angle = Math.atan2(dir.y, dir.x);
      ctx.save(); ctx.translate((head.x + 0.5) * cell, (head.y + 0.5) * cell); ctx.rotate(angle);
      ctx.fillStyle = '#9ce6dd'; ctx.beginPath(); ctx.moveTo(cell * 0.75, 0); ctx.lineTo(0, -cell * 0.36); ctx.lineTo(-cell * 0.4, -cell * 0.65); ctx.lineTo(-cell * 0.2, cell * 0.25); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#061820'; ctx.beginPath(); ctx.arc(cell * 0.20, -cell * 0.13, cell * 0.06, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    },
    destroy() { observer.disconnect(); canvas.remove(); }
  };
}
