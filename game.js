'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Skins de la nave ──────────────────────────────────────────────────────────
const SHIP_SKIN_STORAGE_KEY = 'asteroids.shipSkin';
const SHIP_SKINS = [
  {
    id: 'classic',
    name: 'CLÁSICA',
    color: '#fff',
    thrustColor: '#ff8200',
    drawHull() {
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-12, -9);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-12, 9);
      ctx.closePath();
      ctx.stroke();
    },
    drawThrust() {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.stroke();
    },
  },
  {
    id: 'interceptor',
    name: 'INTERCEPTOR',
    color: '#35d8ff',
    thrustColor: '#8af4ff',
    drawHull() {
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(2, -4);
      ctx.lineTo(-13, -11);
      ctx.lineTo(-9, -3);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-9, 3);
      ctx.lineTo(-13, 11);
      ctx.lineTo(2, 4);
      ctx.closePath();
      ctx.stroke();
    },
    drawThrust() {
      ctx.beginPath();
      ctx.moveTo(-8, -2.5);
      ctx.lineTo(-10 - rand(8, 16), 0);
      ctx.lineTo(-8, 2.5);
      ctx.stroke();
    },
  },
  {
    id: 'phoenix',
    name: 'FÉNIX',
    color: '#ff654a',
    thrustColor: '#ffd166',
    drawHull() {
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(3, -5);
      ctx.lineTo(-9, -12);
      ctx.lineTo(-6, -4);
      ctx.lineTo(-13, -6);
      ctx.lineTo(-9, 0);
      ctx.lineTo(-13, 6);
      ctx.lineTo(-6, 4);
      ctx.lineTo(-9, 12);
      ctx.lineTo(3, 5);
      ctx.closePath();
      ctx.stroke();
    },
    drawThrust() {
      ctx.beginPath();
      ctx.moveTo(-7, -4);
      ctx.lineTo(-9 - rand(5, 12), -3);
      ctx.lineTo(-8, -1.5);
      ctx.moveTo(-8, 1.5);
      ctx.lineTo(-9 - rand(5, 12), 3);
      ctx.lineTo(-7, 4);
      ctx.stroke();
    },
  },
];

function loadShipSkinIndex() {
  try {
    const storedId = localStorage.getItem(SHIP_SKIN_STORAGE_KEY);
    const index = SHIP_SKINS.findIndex(skin => skin.id === storedId);
    return index >= 0 ? index : 0;
  } catch {
    return 0;
  }
}

let selectedSkinIndex = loadShipSkinIndex();
let skinNoticeTimer = 2.5;

function getSelectedSkin() {
  return SHIP_SKINS[selectedSkinIndex];
}

function selectNextSkin() {
  selectedSkinIndex = (selectedSkinIndex + 1) % SHIP_SKINS.length;
  skinNoticeTimer = 2.5;
  try {
    localStorage.setItem(SHIP_SKIN_STORAGE_KEY, getSelectedSkin().id);
  } catch {
    // La selección sigue funcionando aunque el navegador bloquee localStorage.
  }
}

function drawShipHull(lineWidth, speedBoosted = false, tripleShotActive = false) {
  const skin = getSelectedSkin();
  ctx.strokeStyle = skin.color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  if (speedBoosted) {
    ctx.shadowColor = '#35d8ff';
    ctx.shadowBlur = 10;
  }
  skin.drawHull();
  ctx.shadowBlur = 0;
  if (tripleShotActive) {
    ctx.shadowColor = '#ff4fd8';
    ctx.shadowBlur = 10;
    skin.drawHull();
    ctx.shadowBlur = 0;
  }
}

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3, shootingStar = false) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    this.isShootingStar = shootingStar;
    this.ttl = shootingStar ? 6 : null;
    this.maxTtl = this.ttl;

    if (shootingStar) {
      this.radius = 14;
      this.cometRadius = 22;
    }

    const angle = rand(0, Math.PI * 2);
    const baseSpeed = SPEEDS[size] + rand(-15, 15);
    const speed = shootingStar ? baseSpeed * 2.5 : baseSpeed;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular (solo asteroides normales)
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;

    if (this.isShootingStar) {
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    if (this.isShootingStar) {
      const fadeStart = this.maxTtl * 0.3;
      const alpha = Math.min(1, this.ttl / fadeStart);
      const angle = Math.atan2(this.vy, this.vx);
      const trailLen = 50;

      // Estela con degradado
      const grad = ctx.createLinearGradient(
        this.x, this.y,
        this.x - Math.cos(angle) * trailLen,
        this.y - Math.sin(angle) * trailLen
      );
      grad.addColorStop(0, `rgba(255, 220, 120, ${(alpha * 0.8).toFixed(2)})`);
      grad.addColorStop(1, 'rgba(255, 160, 40, 0)');

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(
        this.x - Math.cos(angle) * trailLen,
        this.y - Math.sin(angle) * trailLen
      );
      ctx.stroke();

      // Brillo suave
      const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.cometRadius);
      glow.addColorStop(0, `rgba(255, 240, 180, ${(alpha * 0.5).toFixed(2)})`);
      glow.addColorStop(0.5, `rgba(255, 200, 80, ${(alpha * 0.15).toFixed(2)})`);
      glow.addColorStop(1, 'rgba(255, 160, 40, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.cometRadius, 0, Math.PI * 2);
      ctx.fill();

      // Núcleo compacto
      const coreGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
      coreGrad.addColorStop(0, `rgba(255, 255, 240, ${alpha.toFixed(2)})`);
      coreGrad.addColorStop(0.6, `rgba(255, 220, 100, ${alpha.toFixed(2)})`);
      coreGrad.addColorStop(1, `rgba(255, 160, 40, ${(alpha * 0.3).toFixed(2)})`);
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth   = 1.5;
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      ctx.moveTo(this.verts[0][0], this.verts[0][1]);
      for (let i = 1; i < this.verts.length; i++)
        ctx.lineTo(this.verts[i][0], this.verts[i][1]);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.speedBoostTimer = 0;
    this.shieldTimer   = 0;
    this.tripleShotTimer = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.speedBoostTimer > 0) this.speedBoostTimer -= dt;
    if (this.shieldTimer > 0) this.shieldTimer -= dt;
    if (this.tripleShotTimer > 0) this.tripleShotTimer -= dt;

    const ROT   = 3.5;   // rad/s
    const THRUST = 260;  // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    const speedMultiplier = this.speedBoostTimer > 0 ? 2 : 1;
    this.x = wrap(this.x + this.vx * dt * speedMultiplier, W);
    this.y = wrap(this.y + this.vy * dt * speedMultiplier, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShotTimer > 0) {
      const SPACING = 8;
      const px = -Math.sin(this.angle) * SPACING;
      const py = Math.cos(this.angle) * SPACING;
      return [
        new Bullet(ox + px, oy + py, this.angle),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox - px, oy - py, this.angle),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;

    if (this.shieldTimer > 0) {
      const pulse = 0.65 + Math.sin(this.shieldTimer * 8) * 0.2;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.strokeStyle = `rgba(105, 255, 145, ${pulse.toFixed(2)})`;
      ctx.fillStyle = 'rgba(105, 255, 145, 0.08)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 27, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    drawShipHull(1.5, this.speedBoostTimer > 0, this.tripleShotTimer > 0);

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.strokeStyle = getSelectedSkin().thrustColor;
      getSelectedSkin().drawThrust();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Power-up: Velocidad ──────────────────────────────────────────────────────
class SpeedPowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 14;
    this.ttl = 10;
    this.dead = false;
  }

  update(dt) {
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#35d8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(10, 0);
    ctx.lineTo(0, 11);
    ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#35d8ff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('x2', 0, 4);
    ctx.restore();
  }
}

// ── Power-up: Escudo ─────────────────────────────────────────────────────────
class ShieldPowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 14;
    this.ttl = 10;
    this.dead = false;
  }

  update(dt) {
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#69ff91';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 7, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.restore();
  }
}

// ── Power-up: Triple shot ─────────────────────────────────────────────────────
class TripleShotPowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 14;
    this.ttl = 10;
    this.dead = false;
  }

  update(dt) {
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#ff4fd8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ff4fd8';
    for (const x of [-5, 0, 5]) ctx.fillRect(x - 1, -7, 2, 14);
    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles;
let speedPowerUp, shieldPowerUp, tripleShotPowerUp;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    const shootingStar = Math.random() < 0.2;
    asteroids.push(new Asteroid(x, y, 3, shootingStar));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  speedPowerUp = null;
  shieldPowerUp = null;
  tripleShotPowerUp = null;
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  speedPowerUp = null;
  shieldPowerUp = null;
  tripleShotPowerUp = null;
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  ship.speedBoostTimer = 0;
  ship.shieldTimer = 0;
  speedPowerUp = null;
  shieldPowerUp = null;
  ship.tripleShotTimer = 0;
  tripleShotPowerUp = null;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (pressed('KeyS')) selectNextSkin();
  if (skinNoticeTimer > 0) skinNoticeTimer -= dt;

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    asteroids = asteroids.filter(a => !a.dead);
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  if (speedPowerUp) speedPowerUp.update(dt);
  if (shieldPowerUp) shieldPowerUp.update(dt);
  if (tripleShotPowerUp) tripleShotPowerUp.update(dt);

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
        const spawnOptions = [];
        if (!speedPowerUp)
          spawnOptions.push(() => { speedPowerUp = new SpeedPowerUp(a.x, a.y); });
        if (!shieldPowerUp)
          spawnOptions.push(() => { shieldPowerUp = new ShieldPowerUp(a.x, a.y); });
        if (!tripleShotPowerUp)
          spawnOptions.push(() => { tripleShotPowerUp = new TripleShotPowerUp(a.x, a.y); });
        if (spawnOptions.length > 0 && Math.random() < 0.2) {
          spawnOptions[randInt(0, spawnOptions.length - 1)]();
        }
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Nave vs power-up
  if (speedPowerUp && !speedPowerUp.dead &&
      dist(ship, speedPowerUp) < ship.radius + speedPowerUp.radius) {
    ship.speedBoostTimer = 5;
    speedPowerUp = null;
  }
  if (speedPowerUp && speedPowerUp.dead) speedPowerUp = null;

  // Nave vs power-up de escudo
  if (shieldPowerUp && !shieldPowerUp.dead &&
      dist(ship, shieldPowerUp) < ship.radius + shieldPowerUp.radius) {
    ship.shieldTimer = 5;
    shieldPowerUp = null;
  }
  if (shieldPowerUp && shieldPowerUp.dead) shieldPowerUp = null;

  // Nave vs power-up de triple disparo
  if (tripleShotPowerUp && !tripleShotPowerUp.dead &&
      dist(ship, tripleShotPowerUp) < ship.radius + tripleShotPowerUp.radius) {
    ship.tripleShotTimer = 5;
    tripleShotPowerUp = null;
  }
  if (tripleShotPowerUp && tripleShotPowerUp.dead) tripleShotPowerUp = null;

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    const shieldFragments = [];
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        if (ship.shieldTimer > 0) {
          a.dead = true;
          explode(a.x, a.y, a.size * 5);
          shieldFragments.push(...a.split());
        } else {
          killShip();
          break;
        }
      }
    }
    asteroids = asteroids.filter(a => !a.dead).concat(shieldFragments);
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.scale(0.5, 0.5);
  drawShipHull(2.4);
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  let powerUpY = 48;
  if (ship.speedBoostTimer > 0) {
    ctx.fillStyle = '#35d8ff';
    ctx.fillText(`VELOCIDAD ${ship.speedBoostTimer.toFixed(1)}s`, W / 2, powerUpY);
    powerUpY += 20;
  }

  if (ship.shieldTimer > 0) {
    ctx.fillStyle = '#69ff91';
    ctx.fillText(`ESCUDO ${ship.shieldTimer.toFixed(1)}s`, W / 2, powerUpY);
    powerUpY += 20;
  }

  if (ship.tripleShotTimer > 0) {
    ctx.fillStyle = '#ff4fd8';
    ctx.fillText(`TRIPLE SHOT ${ship.tripleShotTimer.toFixed(1)}s`, W / 2, powerUpY);
  }
  ctx.fillStyle = '#fff';

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  if (skinNoticeTimer > 0) {
    const alpha = Math.min(1, skinNoticeTimer * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`SKIN: ${getSelectedSkin().name}  [S PARA CAMBIAR]`, W / 2, H - 18);
  }
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  bullets.forEach(b => b.draw());
  if (speedPowerUp) speedPowerUp.draw();
  if (shieldPowerUp) shieldPowerUp.draw();
  if (tripleShotPowerUp) tripleShotPowerUp.draw();
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
