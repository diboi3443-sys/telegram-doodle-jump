import Phaser from 'phaser';

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  TELEGRAM HELPERS                                                          *
 * ═══════════════════════════════════════════════════════════════════════════ */

const tg = window.Telegram?.WebApp;

function initTelegram() {
  if (!tg) return;
  tg.ready();
  tg.expand();
}

function getTgBgColor() {
  return tg?.themeParams?.bg_color ?? '#1a1a2e';
}

function getTgSecondaryBg() {
  return tg?.themeParams?.secondary_bg_color ?? '#16213e';
}

function hapticLight() {
  try { tg?.HapticFeedback?.impactOccurred('light'); } catch { /* */ }
}

function hapticMedium() {
  try { tg?.HapticFeedback?.impactOccurred('medium'); } catch { /* */ }
}

function hapticError() {
  try { tg?.HapticFeedback?.notificationOccurred('error'); } catch { /* */ }
}

function getTgUser() {
  const u = tg?.initDataUnsafe?.user;
  if (!u) return null;
  return { id: u.id, firstName: u.first_name ?? 'Player' };
}

/* ─── Cloud Storage ────────────────────────────────────────────────────── */

function cloudGet(key) {
  return new Promise((resolve) => {
    try {
      tg?.CloudStorage?.getItem(key, (_e, v) => resolve(v ?? null));
    } catch { resolve(null); }
    setTimeout(() => resolve(null), 1500);
  });
}

function cloudSet(key, value) {
  return new Promise((resolve) => {
    try {
      tg?.CloudStorage?.setItem(key, String(value), () => resolve(true));
    } catch { resolve(false); }
    setTimeout(() => resolve(false), 1500);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  LOCAL LEADERBOARD                                                         *
 * ═══════════════════════════════════════════════════════════════════════════ */

const LB_KEY = 'doodle_jump_leaderboard';
const LB_MAX = 5;

function getLeaderboard() {
  try { const r = localStorage.getItem(LB_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}

function saveScoreLocal(score) {
  if (score <= 0) return;
  const lb = getLeaderboard();
  lb.push({ score, date: Date.now() });
  lb.sort((a, b) => b.score - a.score);
  if (lb.length > LB_MAX) lb.length = LB_MAX;
  localStorage.setItem(LB_KEY, JSON.stringify(lb));
}

function getLocalBest() {
  const lb = getLeaderboard();
  return lb.length > 0 ? lb[0].score : 0;
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  UTILITY                                                                   *
 * ═══════════════════════════════════════════════════════════════════════════ */

function hexToNum(hex) {
  return parseInt(String(hex).replace('#', ''), 16);
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  CONSTANTS                                                                 *
 * ═══════════════════════════════════════════════════════════════════════════ */

const GRAVITY          = 900;
const JUMP_VEL         = -550;
const CRYSTAL_VEL      = -1100;       // 2× jump (crystal super-bounce)
const MOVE_SPEED       = 300;
const PLATFORM_COUNT   = 8;
const PLAT_W           = 70;
const PLAT_H           = 14;
const PLAYER_W         = 34;
const PLAYER_H         = 44;          // taller — includes hat
const CRYSTAL_W        = 22;
const CRYSTAL_H        = 26;
const CAP_W            = 30;
const CAP_H            = 20;
const CHOCO_W          = 24;
const CHOCO_H          = 14;
const CHOCO_SCORE      = 75;          // points per chocolate

// Spawn chances
const P_FRAGILE        = 0.18;
const P_CRYSTAL        = 0.10;
const P_COP            = 0.06;
const P_CHOCO          = 0.12;

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  GAME SCENE                                                                *
 * ═══════════════════════════════════════════════════════════════════════════ */

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.cloudHighscore = 0;
  }

  /* ─── preload ────────────────────────────────────────────────────────── */
  preload() {
    this._makeTextures();

    // Logo is optional — game works without it
    this.load.image('logo', 'logo.png');
    this.load.on('loaderror', () => { /* ignore missing logo */ });
  }

  /* ═══════════════════════════════════════════════════════════════════════ *
   *  TEXTURE GENERATION                                                     *
   * ═══════════════════════════════════════════════════════════════════════ */

  _makeTextures() {
    /* ── Player (cute character with bowler hat) ────────────────────────── */
    if (!this.textures.exists('player')) {
      const g = this.make.graphics({ add: false });
      const bx = PLAYER_W / 2;             // centre X

      // -- Hat (bowler) --
      g.fillStyle(0x2d2d2d);               // dark grey
      g.fillRoundedRect(bx - 14, 0, 28, 10, 3);   // brim
      g.fillRoundedRect(bx - 10, 0, 20, 4, 2);    // top dome extra
      g.fillStyle(0x1a1a1a);
      g.fillRoundedRect(bx - 9, 2, 18, 12, 6);    // dome
      // hat band
      g.fillStyle(0xc62828);
      g.fillRect(bx - 9, 11, 18, 3);

      // -- Body --
      g.fillStyle(0xffb74d);               // warm orange skin
      g.fillRoundedRect(bx - 12, 14, 24, 26, 8);

      // -- Eyes --
      g.fillStyle(0xffffff);
      g.fillCircle(bx - 5, 24, 5);
      g.fillCircle(bx + 5, 24, 5);
      g.fillStyle(0x1a1a2e);
      g.fillCircle(bx - 4, 24, 2.5);
      g.fillCircle(bx + 6, 24, 2.5);

      // -- Smile --
      g.lineStyle(2, 0xc62828);
      g.beginPath();
      g.arc(bx, 30, 5, 0.2, Math.PI - 0.2);
      g.strokePath();

      // -- Feet --
      g.fillStyle(0x5d4037);
      g.fillRoundedRect(bx - 11, 38, 9, 6, 2);
      g.fillRoundedRect(bx + 2, 38, 9, 6, 2);

      g.generateTexture('player', PLAYER_W, PLAYER_H);
      g.destroy();
    }

    /* ── Normal platform ──────────────────────────────────────────────── */
    if (!this.textures.exists('platform')) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0x4fc3f7);
      g.fillRoundedRect(0, 0, PLAT_W, PLAT_H, 5);
      g.generateTexture('platform', PLAT_W, PLAT_H);
      g.destroy();
    }

    /* ── Fragile platform (red) ───────────────────────────────────────── */
    if (!this.textures.exists('platform_fragile')) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xff5252);
      g.fillRoundedRect(0, 0, PLAT_W, PLAT_H, 5);
      // crack lines
      g.lineStyle(1, 0xb71c1c, 0.6);
      g.lineBetween(15, 3, 35, 11);
      g.lineBetween(40, 2, 55, 10);
      g.generateTexture('platform_fragile', PLAT_W, PLAT_H);
      g.destroy();
    }

    /* ── Crystal (main bonus — super jump) ────────────────────────────── */
    if (!this.textures.exists('crystal')) {
      const g = this.make.graphics({ add: false });
      const cx = CRYSTAL_W / 2;
      const cy = CRYSTAL_H / 2;

      // Diamond shape
      g.fillStyle(0x7c4dff);              // deep purple
      g.fillTriangle(cx, 2, cx + 10, cy, cx, CRYSTAL_H - 2);
      g.fillTriangle(cx, 2, cx - 10, cy, cx, CRYSTAL_H - 2);

      // Inner shine
      g.fillStyle(0xb388ff, 0.7);
      g.fillTriangle(cx, 5, cx + 5, cy, cx, CRYSTAL_H - 5);

      // Top highlight
      g.fillStyle(0xffffff, 0.6);
      g.fillTriangle(cx, 3, cx - 4, 9, cx + 2, 9);

      g.generateTexture('crystal', CRYSTAL_W, CRYSTAL_H);
      g.destroy();
    }

    /* ── Chocolate bar (collectible bonus) ────────────────────────────── */
    if (!this.textures.exists('choco')) {
      const g = this.make.graphics({ add: false });

      // Wrapper (golden foil)
      g.fillStyle(0xffb300);
      g.fillRoundedRect(0, 0, CHOCO_W, CHOCO_H, 3);

      // Chocolate inside
      g.fillStyle(0x5d4037);
      g.fillRoundedRect(2, 2, CHOCO_W - 4, CHOCO_H - 4, 2);

      // Segments
      g.lineStyle(1, 0x3e2723, 0.6);
      g.lineBetween(8, 2, 8, CHOCO_H - 2);
      g.lineBetween(16, 2, 16, CHOCO_H - 2);

      // Shine
      g.fillStyle(0x8d6e63, 0.5);
      g.fillRect(3, 3, 4, 2);
      g.fillRect(10, 3, 4, 2);
      g.fillRect(18, 3, 4, 2);

      g.generateTexture('choco', CHOCO_W, CHOCO_H);
      g.destroy();
    }

    /* ── Police cap (obstacle) ────────────────────────────────────────── */
    if (!this.textures.exists('cop_cap')) {
      const g = this.make.graphics({ add: false });
      const mx = CAP_W / 2;

      // Visor (brim)
      g.fillStyle(0x1a237e);              // dark navy
      g.fillRoundedRect(0, 12, CAP_W, 8, 3);

      // Cap body
      g.fillStyle(0x283593);              // navy blue
      g.fillRoundedRect(3, 2, CAP_W - 6, 14, 5);

      // Top dome
      g.fillStyle(0x3949ab);
      g.fillRoundedRect(6, 0, CAP_W - 12, 6, 3);

      // Badge (gold circle)
      g.fillStyle(0xffd740);
      g.fillCircle(mx, 8, 4);
      g.fillStyle(0xffab00);
      g.fillCircle(mx, 8, 2.5);

      // Visor shine
      g.fillStyle(0x5c6bc0, 0.4);
      g.fillRect(4, 13, CAP_W - 8, 2);

      g.generateTexture('cop_cap', CAP_W, CAP_H);
      g.destroy();
    }

    /* ── Particles ────────────────────────────────────────────────────── */
    if (!this.textures.exists('particle')) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffffff);
      g.fillRect(0, 0, 6, 6);
      g.generateTexture('particle', 6, 6);
      g.destroy();
    }

    if (!this.textures.exists('particle_choco')) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffb300);
      g.fillCircle(3, 3, 3);
      g.generateTexture('particle_choco', 6, 6);
      g.destroy();
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════ *
   *  CREATE                                                                 *
   * ═══════════════════════════════════════════════════════════════════════ */

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(getTgBgColor());
    this._createBackground(width, height);

    // Highscore
    this.cloudHighscore = getLocalBest();
    cloudGet('highscore').then((val) => {
      const cb = val ? parseInt(val, 10) || 0 : 0;
      if (cb > this.cloudHighscore) {
        this.cloudHighscore = cb;
        if (this.bestText) this.bestText.setText(`Best: ${this.cloudHighscore}`);
      }
    });

    this._initState(width, height);
    this._createGroups();
    this._populateInitialPlatforms(width, height);
    this._createPlayer(width, height);
    this._setupColliders();
    this._setupInput(width);
    this._createHUD(width);
    this._createGameOverUI(width, height);
    this._createParticleEmitters();

    this.ready = true;
    this.player.body.setVelocityY(JUMP_VEL);
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  /* ─── helpers ────────────────────────────────────────────────────────── */

  _createBackground(width, height) {
    if (!this.textures.exists('logo')) return;
    this.bgLogo = this.add.image(width / 2, height / 2, 'logo');
    const scale = (width / this.bgLogo.width) * 1.05;
    this.bgLogo.setScale(scale).setAlpha(0.25).setDepth(-1).setScrollFactor(0.3, 0.3);
  }

  _initState(w, h) {
    this.score = 0;
    this.highestY = h;
    this.gameOver = false;
    this.ready = false;
    this.cameras.main.scrollY = 0;
    this.moveDir = 0;
  }

  _createGroups() {
    this.platforms    = this.physics.add.staticGroup();
    this.platformPool = [];
    this.crystals     = this.physics.add.staticGroup();
    this.crystalPool  = [];
    this.cops         = this.physics.add.group({ allowGravity: false });
    this.copPool      = [];
    this.chocos       = this.physics.add.staticGroup();
    this.chocoPool    = [];
  }

  _populateInitialPlatforms(w, h) {
    const gap = h / PLATFORM_COUNT;
    for (let i = 0; i < PLATFORM_COUNT; i++) {
      const x = Phaser.Math.Between(30, w - 30);
      const y = h - i * gap;
      this._spawnPlatform(x, y, i < 3 ? false : undefined, i < 3);
    }
    this._spawnPlatform(w / 2, h - 40, false, true);
  }

  _createPlayer(w, h) {
    this.player = this.physics.add.sprite(w / 2, h - 80, 'player');
    this.player.setCollideWorldBounds(false);
    this.player.body.setGravityY(GRAVITY);
    // collision body at the feet area
    this.player.body.setSize(PLAYER_W - 6, PLAYER_H / 2);
    this.player.body.setOffset(3, PLAYER_H / 2);
    this.player.setDepth(2);
  }

  _setupColliders() {
    // platforms
    this.physics.add.collider(
      this.player, this.platforms,
      this._onPlatformCollide, this._isFallingDown, this,
    );
    // crystals (super jump)
    this.physics.add.overlap(
      this.player, this.crystals,
      this._onCrystalHit, this._isFallingDown, this,
    );
    // police caps (death)
    this.physics.add.overlap(
      this.player, this.cops,
      this._onCopHit, null, this,
    );
    // chocolates (bonus points)
    this.physics.add.overlap(
      this.player, this.chocos,
      this._onChocoCollect, null, this,
    );
  }

  _setupInput(width) {
    this.input.on('pointerdown', (ptr) => {
      if (this.gameOver) return;
      this.moveDir = ptr.x < width / 2 ? -1 : 1;
    });
    this.input.on('pointerup', () => { this.moveDir = 0; });
  }

  /* ─── HUD ────────────────────────────────────────────────────────────── */

  _createHUD(width) {
    const user = getTgUser();
    const name = user?.firstName ?? 'Player';

    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontFamily: 'Arial, sans-serif', fontSize: '20px',
      color: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setScrollFactor(0).setDepth(10);

    this.bestText = this.add.text(width - 16, 16, `Best: ${this.cloudHighscore}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '16px',
      color: '#ffd740', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(10);

    this.nameText = this.add.text(16, 42, name, {
      fontFamily: 'Arial, sans-serif', fontSize: '14px',
      color: '#80cbc4', stroke: '#000000', strokeThickness: 2,
    }).setScrollFactor(0).setDepth(10);
  }

  /* ─── Particles ──────────────────────────────────────────────────────── */

  _createParticleEmitters() {
    // Crystal burst (purple sparkles)
    this.crystalParticles = this.add.particles(0, 0, 'particle', {
      speed: { min: 80, max: 220 },
      angle: { min: 210, max: 330 },
      scale: { start: 1.2, end: 0 },
      lifespan: 600,
      gravityY: 250,
      tint: [0x7c4dff, 0xb388ff, 0xea80fc, 0xffffff],
      emitting: false,
    }).setDepth(5);

    // Chocolate collect (golden pops)
    this.chocoParticles = this.add.particles(0, 0, 'particle_choco', {
      speed: { min: 50, max: 150 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      lifespan: 400,
      gravityY: 200,
      tint: [0xffb300, 0xffe082, 0x5d4037],
      emitting: false,
    }).setDepth(5);
  }

  _burstCrystal(x, y) {
    this.crystalParticles.setPosition(x, y);
    this.crystalParticles.explode(14);
  }

  _burstChoco(x, y) {
    this.chocoParticles.setPosition(x, y);
    this.chocoParticles.explode(8);
  }

  /* ═══════════════════════════════════════════════════════════════════════ *
   *  UPDATE                                                                 *
   * ═══════════════════════════════════════════════════════════════════════ */

  update() {
    if (!this.ready || this.gameOver) return;

    const { width, height } = this.scale;
    const cam = this.cameras.main;
    const p = this.player;

    // Movement
    p.body.setVelocityX(this.moveDir * MOVE_SPEED);

    // Player tilt
    const tilt = this.moveDir * 0.22;
    p.rotation = Phaser.Math.Linear(p.rotation, tilt, 0.15);

    // Wrap-around
    if (p.x < -PLAYER_W / 2) p.x = width + PLAYER_W / 2;
    else if (p.x > width + PLAYER_W / 2) p.x = -PLAYER_W / 2;

    // Camera (only UP)
    const target = p.y - height * 0.4;
    if (target < cam.scrollY) cam.scrollY = target;

    // Score
    if (p.y < this.highestY) {
      this.score += Math.round(this.highestY - p.y);
      this.highestY = p.y;
    }
    this.scoreText.setText(`Score: ${this.score}`);

    // Recycle & spawn
    const camTop = cam.scrollY;
    const camBottom = camTop + height;

    this._recycleOffscreen(camBottom);
    this._ensurePlatformsAbove(camTop, width);

    // Death
    if (p.y > camBottom + PLAYER_H) {
      this._triggerGameOver();
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════ *
   *  PLATFORMS                                                              *
   * ═══════════════════════════════════════════════════════════════════════ */

  _spawnPlatform(x, y, forceFragile, safeZone = false) {
    const isFragile = forceFragile !== undefined
      ? forceFragile
      : Math.random() < P_FRAGILE;

    const tex = isFragile ? 'platform_fragile' : 'platform';
    let plat;

    if (this.platformPool.length > 0) {
      plat = this.platformPool.pop();
      plat.setTexture(tex);
      plat.enableBody(true, x, y, true, true);
      plat.setPosition(x, y);
      plat.setAlpha(1);
      plat.refreshBody();
    } else {
      plat = this.platforms.create(x, y, tex);
      plat.refreshBody();
    }

    plat.setData('fragile', isFragile);
    plat.setData('breaking', false);

    if (safeZone) return plat;

    // Crystal on normal platforms
    if (!isFragile && Math.random() < P_CRYSTAL) {
      this._spawnCrystal(x, y - PLAT_H / 2 - CRYSTAL_H / 2);
    }

    // Chocolate nearby
    if (Math.random() < P_CHOCO) {
      const cx = Phaser.Math.Between(20, this.scale.width - 20);
      const cy = y - Phaser.Math.Between(20, 60);
      this._spawnChoco(cx, cy);
    }

    // Police cap
    if (Math.random() < P_COP) {
      const bx = Phaser.Math.Between(20, this.scale.width - 20);
      const by = y - Phaser.Math.Between(30, 80);
      this._spawnCop(bx, by);
    }

    return plat;
  }

  _recyclePlatform(plat) {
    plat.disableBody(true, true);
    plat.setData('breaking', false);
    plat.setAlpha(1);
    this.platformPool.push(plat);
  }

  _breakPlatform(plat) {
    if (plat.getData('breaking')) return;
    plat.setData('breaking', true);
    this.tweens.add({
      targets: plat, alpha: 0, duration: 500, ease: 'Power2',
      onComplete: () => this._recyclePlatform(plat),
    });
  }

  _ensurePlatformsAbove(camTop, screenW) {
    let highest = Infinity;
    this.platforms.getChildren().forEach((p) => {
      if (p.active && p.y < highest) highest = p.y;
    });
    const gap = this.scale.height / PLATFORM_COUNT;
    while (highest > camTop - 100) {
      const x = Phaser.Math.Between(30, screenW - 30);
      const y = highest - Phaser.Math.Between(gap * 0.6, gap * 1.2);
      this._spawnPlatform(x, y);
      highest = y;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════ *
   *  CRYSTALS (main bonus — super jump)                                     *
   * ═══════════════════════════════════════════════════════════════════════ */

  _spawnCrystal(x, y) {
    let c;
    if (this.crystalPool.length > 0) {
      c = this.crystalPool.pop();
      c.enableBody(true, x, y, true, true);
      c.setPosition(x, y).setScale(1, 1);
      c.refreshBody();
    } else {
      c = this.crystals.create(x, y, 'crystal');
      c.refreshBody();
    }
    c.setDepth(1);

    // Gentle floating glow
    this.tweens.add({
      targets: c, scaleX: 1.15, scaleY: 1.15,
      duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    return c;
  }

  _recycleCrystal(c) {
    this.tweens.killTweensOf(c);
    c.disableBody(true, true);
    this.crystalPool.push(c);
  }

  /* ═══════════════════════════════════════════════════════════════════════ *
   *  CHOCOLATES (collectible — bonus score)                                 *
   * ═══════════════════════════════════════════════════════════════════════ */

  _spawnChoco(x, y) {
    let ch;
    if (this.chocoPool.length > 0) {
      ch = this.chocoPool.pop();
      ch.enableBody(true, x, y, true, true);
      ch.setPosition(x, y).setScale(1).setAlpha(1);
      ch.refreshBody();
    } else {
      ch = this.chocos.create(x, y, 'choco');
      ch.refreshBody();
    }
    ch.setDepth(1);

    // Bobbing animation
    this.tweens.add({
      targets: ch, y: y - 6,
      duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    return ch;
  }

  _recycleChoco(ch) {
    this.tweens.killTweensOf(ch);
    ch.disableBody(true, true);
    this.chocoPool.push(ch);
  }

  /* ═══════════════════════════════════════════════════════════════════════ *
   *  POLICE CAPS (obstacle — instant death)                                 *
   * ═══════════════════════════════════════════════════════════════════════ */

  _spawnCop(x, y) {
    let b;
    if (this.copPool.length > 0) {
      b = this.copPool.pop();
      b.enableBody(true, x, y, true, true);
      b.setPosition(x, y);
    } else {
      b = this.cops.create(x, y, 'cop_cap');
      b.body.setAllowGravity(false);
      b.body.setSize(CAP_W - 4, CAP_H - 4);
    }

    // Patrol float
    this.tweens.add({
      targets: b,
      x: x + Phaser.Math.Between(-35, 35),
      duration: Phaser.Math.Between(1500, 2500),
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    b.setDepth(1);
    return b;
  }

  _recycleCop(b) {
    this.tweens.killTweensOf(b);
    b.disableBody(true, true);
    this.copPool.push(b);
  }

  /* ═══════════════════════════════════════════════════════════════════════ *
   *  OFF-SCREEN RECYCLING                                                   *
   * ═══════════════════════════════════════════════════════════════════════ */

  _recycleOffscreen(camBottom) {
    const limit = camBottom + 60;
    this.platforms.getChildren().forEach((o) => { if (o.active && o.y > limit) this._recyclePlatform(o); });
    this.crystals.getChildren().forEach((o)  => { if (o.active && o.y > limit) this._recycleCrystal(o); });
    this.chocos.getChildren().forEach((o)    => { if (o.active && o.y > limit) this._recycleChoco(o); });
    this.cops.getChildren().forEach((o)      => { if (o.active && o.y > limit) this._recycleCop(o); });
  }

  /* ═══════════════════════════════════════════════════════════════════════ *
   *  COLLISION CALLBACKS                                                    *
   * ═══════════════════════════════════════════════════════════════════════ */

  _isFallingDown(player) {
    return player.body.velocity.y > 0;
  }

  _onPlatformCollide(player, plat) {
    player.body.setVelocityY(JUMP_VEL);
    hapticLight();
    if (plat.getData('fragile')) this._breakPlatform(plat);
  }

  _onCrystalHit(player, crystal) {
    player.body.setVelocityY(CRYSTAL_VEL);
    hapticMedium();

    // Squash animation
    this.tweens.add({
      targets: crystal, scaleY: 0.3, duration: 80,
      yoyo: true, ease: 'Back.easeOut',
    });

    this._burstCrystal(crystal.x, crystal.y);
  }

  _onChocoCollect(_player, choco) {
    this.score += CHOCO_SCORE;
    hapticLight();

    // Float score text
    const floatTxt = this.add.text(choco.x, choco.y, `+${CHOCO_SCORE}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '16px',
      color: '#ffb300', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(15);

    this.tweens.add({
      targets: floatTxt, y: choco.y - 40, alpha: 0, duration: 600,
      ease: 'Power2', onComplete: () => floatTxt.destroy(),
    });

    this._burstChoco(choco.x, choco.y);
    this._recycleChoco(choco);
  }

  _onCopHit() {
    this._triggerGameOver();
  }

  /* ═══════════════════════════════════════════════════════════════════════ *
   *  GAME OVER UI  (NO container — avoids scrollFactor hit-area bug)        *
   * ═══════════════════════════════════════════════════════════════════════ */

  _createGameOverUI(w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const D = 30;   // depth

    // Collect all GO elements so we can show/hide them together
    this._goElements = [];

    const _add = (obj) => { this._goElements.push(obj); return obj; };

    // Overlay — covers whole viewport, blocks game input
    _add(this.add.rectangle(cx, cy, w * 2, h * 2, 0x000000, 0.7)
      .setScrollFactor(0).setDepth(D).setVisible(false)
      .setInteractive());   // swallow clicks

    // Title
    _add(this.add.text(cx, cy - 140, 'Game Over', {
      fontFamily: 'Arial, sans-serif', fontSize: '42px',
      color: '#ff5252', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1).setVisible(false));

    // Score
    this.goScoreText = _add(this.add.text(cx, cy - 85, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '26px', color: '#fff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1).setVisible(false));

    // New best
    this.goNewBest = _add(this.add.text(cx, cy - 55, '⭐ NEW BEST!', {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#ffd740',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1).setVisible(false));

    // Leaderboard title
    _add(this.add.text(cx, cy - 22, '🏆 Top Scores', {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#4fc3f7',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1).setVisible(false));

    // Leaderboard rows
    this.goLbRows = [];
    for (let i = 0; i < LB_MAX; i++) {
      const r = _add(this.add.text(cx, cy + 8 + i * 26, '', {
        fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#ccc',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1).setVisible(false));
      this.goLbRows.push(r);
    }

    // ── Restart button (separate from everything — reliable input) ──
    const btnY = cy + 8 + LB_MAX * 26 + 24;

    this.goBtnBg = _add(this.add.rectangle(cx, btnY, 220, 52, hexToNum(getTgSecondaryBg()))
      .setStrokeStyle(2, 0xffffff)
      .setScrollFactor(0).setDepth(D + 2).setVisible(false));

    this.goBtnBg.setInteractive({ useHandCursor: true });
    this.goBtnBg.on('pointerdown', () => {
      this.scene.restart();
    });

    _add(this.add.text(cx, btnY, '🔄 Попробовать снова', {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#fff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 3).setVisible(false));
  }

  _showGameOverUI(show) {
    this._goElements.forEach((el) => el.setVisible(show));
  }

  /* ═══════════════════════════════════════════════════════════════════════ *
   *  GAME OVER + RESET                                                      *
   * ═══════════════════════════════════════════════════════════════════════ */

  _triggerGameOver() {
    if (this.gameOver) return;
    this.gameOver = true;

    this.player.body.setVelocity(0, 0);
    this.player.body.setGravityY(0);
    this.player.setVisible(false);

    hapticError();

    const isNewBest = this.score > this.cloudHighscore;
    saveScoreLocal(this.score);
    if (isNewBest) {
      this.cloudHighscore = this.score;
      cloudSet('highscore', this.score);
    }

    this.goScoreText.setText(`Score: ${this.score}`);
    this.goNewBest.setVisible(isNewBest);
    this.bestText.setText(`Best: ${this.cloudHighscore}`);

    const lb = getLeaderboard();
    for (let i = 0; i < LB_MAX; i++) {
      if (i < lb.length) {
        const medal = ['🥇', '🥈', '🥉'][i] ?? '  ';
        this.goLbRows[i].setText(`${medal} ${i + 1}. ${lb[i].score}`);
        this.goLbRows[i].setColor(lb[i].score === this.score ? '#ffd740' : '#ccc');
      } else {
        this.goLbRows[i].setText(`   ${i + 1}. ---`);
        this.goLbRows[i].setColor('#666');
      }
    }

    this._showGameOverUI(true);
    // Make sure new-best label is hidden if not a new best
    if (!isNewBest) this.goNewBest.setVisible(false);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  BOOT                                                                      *
 * ═══════════════════════════════════════════════════════════════════════════ */

initTelegram();

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: document.body,
  backgroundColor: getTgBgColor(),
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
  input: { activePointers: 2 },
  render: { pixelArt: false, antialias: true },
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});
