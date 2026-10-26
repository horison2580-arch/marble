/* Marble Mania - inti game: loop, renderer, sprite, HUD, hasil */
(function () {
  const MR = (window.MR = window.MR || {});
  const W = MR.W, H = MR.H;
  const TAU = Math.PI * 2;
  const STEP = 1 / 240;
  MR.modes = MR.modes || {};
  MR.modeOrder = MR.modeOrder || [];
  MR.registerMode = (m) => { MR.modes[m.id] = m; if (!MR.modeOrder.includes(m.id)) MR.modeOrder.push(m.id); };
  MR.font = { w: 700, f: '"Poppins"' };
  const fontStr = (size, w) => `${w || MR.font.w} ${size}px ${MR.font.f}, "Poppins", "Arial Black", Impact, sans-serif`;

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.S = 2;
      this.settings = { theme: 'neon', title: 'SIAPA YANG MENANG?', footer: 'Like & Subscribe!', names: 'auto', spin: true, trails: true, speed: 1, quality: 2, size: 1 };
      this.players = [];
      this.modeId = 'race';
      this.modeOpts = {};
      this.seed = (Math.random() * 1e9) | 0;
      this.state = 'ready';
      this.paused = false;
      this.cam = { x: W / 2, y: H / 2, z: 1 };
      this.spriteCache = new Map();
      this.acc = 0;
      this.last = 0;
      this.clock = 0;
      this.callbacks = {};
      this.decor = [];
      this.setQuality(2);
      this.makeDecor();
      this.build();
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);
    }

    get theme() { return MR.THEMES[this.settings.theme] || MR.THEMES.neon; }
    get mode() { return MR.modes[this.modeId]; }
    on(name, fn) { this.callbacks[name] = fn; }
    emit(name, a) { if (this.callbacks[name]) this.callbacks[name](a); }

    setQuality(q) {
      this.S = q;
      this.canvas.width = Math.round(W * q);
      this.canvas.height = Math.round(H * q);
      this.spriteCache.clear();
      this.vignette = null;
    }
    setSettings(s) {
      const qChanged = s.quality && s.quality !== this.settings.quality;
      const themeChanged = s.theme && s.theme !== this.settings.theme;
      Object.assign(this.settings, s);
      if (qChanged) this.setQuality(this.settings.quality);
      if (themeChanged) this.makeDecor();
    }
    setPlayers(list) { this.players = list; list.forEach((p, i) => { p._i = i; }); }
    setMode(id, opts) { this.modeId = id; this.modeOpts = Object.assign({}, opts || {}); }
    newSeed() { this.seed = (Math.random() * 1e9) | 0; }

    // ---------- membangun arena ----------
    calcR() {
      const n = Math.max(1, this.players.length);
      let r = n <= 4 ? 22 : n <= 6 ? 20 : n <= 10 ? 17.5 : n <= 16 ? 15 : n <= 24 ? 12.5 : n <= 36 ? 11 : n <= 60 ? 9.5 : 8;
      r *= this.settings.size || 1;
      const m = this.mode;
      r *= m.rMul || 1;
      if (m.rMax) r = Math.min(r, m.rMax);
      return Math.max(5, r);
    }

    build() {
      this.world = new MR.World();
      this.marbles = [];
      this.dying = [];
      this.particles = [];
      this.floaters = [];
      this.bannerObj = null;
      this.results = null;
      this.elimOrder = [];
      this.time = 0;
      this.timeScale = 1;
      this.slow = { t: 0, scale: 1 };
      this.endTimer = null;
      this.cd = 0;
      this.shake = 0;
      this.flash = 0;
      this.state = 'ready';
      this.acc = 0;
      this.rng = MR.mulberry32(this.seed);
      this.marbleR = this.calcR();
      this.view = { x0: 0, x1: W, y0: 0, y1: H };
      this.world.onHit = (a, b, sp, x, y, nx, ny) => this.handleHit(a, b, sp, x, y, nx, ny);
      this.world.gravity = this.mode.gravity === undefined ? 1150 : this.mode.gravity;
      this.cam = { x: W / 2, y: H / 2, z: 1 };
      this.mode.setup(this);
      this.world.build();
      const t = this.mode.camTarget(this);
      this.cam.y = t.y; this.cam.z = t.z;
      // biarkan marble menetap sebentar di posisi awal
      for (let i = 0; i < 120; i++) this.world.step(STEP);
      this.emit('state', this.state);
    }

    spawn(p, x, y, o) {
      const m = this.world.addBody(Object.assign({
        x, y, r: this.marbleR, p, idx: p._i, alive: true, trail: [], still: 0,
        eMul: this.mode.eMul === undefined ? 1 : this.mode.eMul, mu: 0.06,
        drag: this.mode.drag === undefined ? 0.05 : this.mode.drag, tag: 'marble',
      }, o || {}));
      this.marbles.push(m);
      return m;
    }
    // helper penghalang
    seg(x1, y1, x2, y2, rad, o) { return this.world.addStatic(Object.assign({ type: 'seg', x1, y1, x2, y2, rad }, o || {})); }
    circ(x, y, r, o) { return this.world.addStatic(Object.assign({ type: 'circle', x1: x, y1: y, rad: r }, o || {})); }
    ring(cx, cy, R, o) { return this.world.addStatic(Object.assign({ type: 'ring', cx, cy, R }, o || {})); }
    alive() { return this.marbles.filter((m) => m.alive); }

    // ---------- alur game ----------
    start() {
      if (this.state === 'countdown' || this.state === 'running') return;
      if (this.state !== 'ready') this.build();
      MR.audio.resume();
      this.state = 'countdown';
      this.cd = 3.4;
      this.lastBeep = 99;
      this.emit('state', this.state);
    }
    go() {
      this.state = 'running';
      this.time = 0;
      this.goT = 0;
      MR.audio.go();
      this.mode.start(this);
      this.emit('state', this.state);
    }
    restart(newSeed) {
      if (newSeed) this.newSeed();
      this.build();
    }
    togglePause() { this.paused = !this.paused; this.emit('pause', this.paused); }

    banner(text, color, sub, dur) { this.bannerObj = { text, color: color || '#fff', sub, t: 0, dur: dur || 2 }; }
    floater(x, y, text, color, size) { this.floaters.push({ x, y, text, color: color || '#fff', size: size || 14, t: 0 }); }
    slowmo(scale, dur) { this.slow = { t: dur, scale }; }

    eliminate(m, anim) {
      if (!m.alive) return;
      m.alive = false; m.out = true; m.outT = this.time;
      this.elimOrder.push(m);
      this.world.removeBody(m);
      if (anim === 'fall') this.dying.push({ m, t: 0, type: 'fall', x: m.x, y: m.y, vx: m.vx * 0.3, vy: m.vy * 0.3 });
      else {
        this.dying.push({ m, t: 0, type: 'pop', x: m.x, y: m.y });
        this.burst(m.x, m.y, m.p.color, 26, 380);
        this.ringFx(m.x, m.y, m.p.color, m.r * 4);
      }
      MR.audio.pop();
      this.shake = Math.max(this.shake, anim === 'fall' ? 2 : 7);
    }

    finishGame(order, labels) {
      if (this.state === 'finished') return;
      this.state = 'finished';
      this.results = { list: order.map((m, i) => ({ m, label: labels ? labels[i] : '' })), t: 0 };
      this.slow = { t: 0, scale: 1 };
      for (let i = 0; i < 90; i++) this.confetti(true);
      MR.audio.fanfare();
      this.emit('state', this.state);
      this.emit('finish', this.results);
    }

    // ---------- tabrakan ----------
    handleHit(a, b, sp, x, y, nx, ny) {
      if (this.state === 'ready') return;
      const bm = b.tag === 'marble';
      if (!bm && b.kick) { MR.audio.bump(); this.burst(x, y, this.theme.bumper, 8, 260); }
      else MR.audio.tick(sp);
      if (sp > 420) this.burst(x, y, a.p ? a.p.color : '#fff', Math.min(6, 2 + (sp / 400) | 0), 160 + sp * 0.2);
      if (bm && this.mode.onMarbleHit && this.state === 'running') this.mode.onMarbleHit(this, a, b, sp, x, y);
    }

    // ---------- partikel ----------
    burst(x, y, color, n, speed) {
      if (this.particles.length > 700) return;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, s = (0.25 + Math.random() * 0.75) * (speed || 200);
        this.particles.push({ k: 's', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.35 + Math.random() * 0.45, size: 1.5 + Math.random() * 2.5, color });
      }
    }
    ringFx(x, y, color, r) { this.particles.push({ k: 'r', x, y, t: 0, max: 0.5, color, r }); }
    confetti(burstMode) {
      const cols = ['#ff4757', '#ffd32a', '#2ed573', '#1e90ff', '#ff6bd6', '#ffffff', '#ffa502'];
      this.particles.push({
        k: 'c', x: Math.random() * W, y: burstMode ? -Math.random() * 500 : -20, vx: (Math.random() - 0.5) * 90,
        vy: 90 + Math.random() * 160, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 10, t: 0,
        max: 9, size: 5 + Math.random() * 6, color: cols[(Math.random() * cols.length) | 0], ph: Math.random() * TAU,
      });
    }

    // ---------- loop ----------
    loop(ts) {
      requestAnimationFrame(this.loop);
      const dt = Math.min(0.05, (ts - this.last) / 1000 || 0.016);
      this.last = ts;
      try {
        this.update(dt);
        this.render();
      } catch (e) { console.error(e); this.emit('error', e); }
    }

    advance(seconds) { // untuk pengujian: maju cepat tanpa render
      const n = Math.round(seconds / (1 / 60));
      for (let i = 0; i < n; i++) this.update(1 / 60);
    }

    update(dt) {
      this.clock += dt;
      if (this.paused) return;
      // slowmo
      if (this.slow.t > 0) { this.slow.t -= dt; this.timeScale = this.slow.scale; } else this.timeScale = 1;
      if (this.state === 'countdown') {
        this.cd -= dt;
        const num = Math.ceil(this.cd);
        if (num < this.lastBeep && num >= 1 && num <= 3) { MR.audio.beep(); this.lastBeep = num; }
        if (this.cd <= 0) this.go();
      }
      if (this.state === 'running') this.goT += dt;
      const sim = dt * (this.settings.speed || 1) * this.timeScale;
      this.acc += sim;
      let n = 0;
      while (this.acc >= STEP && n < 14) {
        this.mode.step(this, STEP);
        this.world.step(STEP);
        if (this.state === 'running') this.time += STEP;
        this.acc -= STEP; n++;
      }
      if (this.acc > STEP * 14) this.acc = 0;
      if (this.state === 'running') {
        this.mode.frame(this, sim);
        this.nudgeStuck(sim);
        if (this.endTimer !== null) {
          this.endTimer -= dt;
          if (this.endTimer <= 0) { this.endTimer = null; this.mode.finish(this); }
        }
      } else if (this.state === 'finished') {
        this.results.t += dt;
        if (this.results.t < 9 && Math.random() < 0.8) { this.confetti(false); this.confetti(false); }
      }
      // trails & fx
      for (const m of this.marbles) {
        if (!m.alive) continue;
        const sp = Math.hypot(m.vx, m.vy);
        if (sp > 70) { m.trail.push({ x: m.x, y: m.y }); if (m.trail.length > 14) m.trail.shift(); }
        else if (m.trail.length) m.trail.shift();
      }
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.t += dt;
        if (p.t >= p.max) { this.particles.splice(i, 1); continue; }
        if (p.k === 's') { p.vy += 500 * dt; p.vx *= 1 - 2 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
        else if (p.k === 'c') { p.x += (p.vx + Math.sin(p.t * 4 + p.ph) * 40) * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
      }
      for (let i = this.floaters.length - 1; i >= 0; i--) { const f = this.floaters[i]; f.t += dt; if (f.t > 1.1) this.floaters.splice(i, 1); }
      for (let i = this.dying.length - 1; i >= 0; i--) {
        const d = this.dying[i]; d.t += dt;
        if (d.type === 'fall') { d.x += d.vx * dt; d.y += d.vy * dt; }
        if (d.t > 0.9) this.dying.splice(i, 1);
      }
      for (const c of this.world.statics) if (c.pulse > 0) c.pulse = Math.max(0, c.pulse - dt * 4);
      if (this.bannerObj) { this.bannerObj.t += dt; if (this.bannerObj.t > this.bannerObj.dur) this.bannerObj = null; }
      this.shake *= Math.pow(0.001, dt);
      this.flash *= Math.pow(0.0005, dt);
      // kamera
      const t = this.mode.camTarget(this);
      const k = Math.min(1, dt * (this.state === 'ready' ? 6 : 3.5));
      this.cam.y += (t.y - this.cam.y) * k;
      this.cam.z += (t.z - this.cam.z) * Math.min(1, dt * 2.2);
    }

    nudgeStuck(dt) {
      if (!this.mode.nudge) return;
      for (const m of this.marbles) {
        if (!m.alive || m.finished || m.landed) continue;
        const sp = Math.hypot(m.vx, m.vy);
        if (sp < 22) {
          m.still += dt;
          if (m.still > 1.6) { m.vx += (Math.random() - 0.5) * 320; m.vy -= 220; m.still = 0; }
        } else m.still = 0;
      }
    }

    // ---------- sprite marble ----------
    sprite(p, r) {
      const key = p.id + '|' + (p.v || 0) + '|' + r.toFixed(1) + '|' + this.S;
      let sp = this.spriteCache.get(key);
      if (sp) return sp;
      if (this.spriteCache.size > 400) this.spriteCache.clear();
      const pad = 5, L = (r + pad) * 2, px = Math.max(8, Math.ceil(L * this.S));
      const mk = () => { const c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d'); g.scale(px / L, px / L); g.translate(L / 2, L / 2); return [c, g]; };
      const [c, g] = mk();
      const col = p.color || '#ff4757';
      let gr = g.createRadialGradient(0, 0, r * 0.7, 0, 0, r + pad);
      gr.addColorStop(0, MR.rgba(col, 0.5)); gr.addColorStop(1, MR.rgba(col, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r + pad, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.clip();
      const img = p.imgEl && p.imgEl.complete && p.imgEl.naturalWidth ? p.imgEl : null;
      if (img) {
        const iw = img.naturalWidth, ih = img.naturalHeight, s = Math.max((2 * r) / iw, (2 * r) / ih);
        g.drawImage(img, (-iw * s) / 2, (-ih * s) / 2, iw * s, ih * s);
      } else {
        const bg = g.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
        bg.addColorStop(0, MR.shade(col, 0.45)); bg.addColorStop(0.55, col); bg.addColorStop(1, MR.shade(col, -0.45));
        g.fillStyle = bg; g.fillRect(-r, -r, 2 * r, 2 * r);
        g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = r * 0.28;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, r * (0.35 + i * 0.3), i * 2.1, i * 2.1 + 1.6); g.stroke(); }
        if (r >= 9 && p.name) {
          const ch = ([...p.name.trim()][0] || '').toUpperCase();
          g.font = fontStr(r * 1.15, 700); g.textAlign = 'center'; g.textBaseline = 'middle';
          g.lineWidth = r * 0.2; g.strokeStyle = MR.shade(col, -0.6); g.lineJoin = 'round';
          g.strokeText(ch, 0, r * 0.05); g.fillStyle = '#fff'; g.fillText(ch, 0, r * 0.05);
        }
      }
      const sh = g.createRadialGradient(0, 0, r * 0.55, 0, 0, r);
      sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.38)');
      g.fillStyle = sh; g.fillRect(-r, -r, 2 * r, 2 * r);
      g.restore();
      g.lineWidth = Math.max(1.6, r * 0.14); g.strokeStyle = col;
      g.beginPath(); g.arc(0, 0, r - g.lineWidth / 2, 0, TAU); g.stroke();
      g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(0, 0, r + 0.4, 0, TAU); g.stroke();
      // kilap (tidak ikut berputar)
      const [gc, gg] = mk();
      gg.save(); gg.rotate(-0.65); gg.translate(-r * 0.12, -r * 0.5);
      const hl = gg.createRadialGradient(0, 0, 0, 0, 0, r * 0.55);
      hl.addColorStop(0, 'rgba(255,255,255,.9)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      gg.fillStyle = hl; gg.scale(1, 0.55); gg.beginPath(); gg.arc(0, 0, r * 0.55, 0, TAU); gg.fill(); gg.restore();
      gg.fillStyle = 'rgba(255,255,255,.35)'; gg.beginPath(); gg.arc(r * 0.42, r * 0.46, r * 0.09, 0, TAU); gg.fill();
      sp = { c, g: gc, L };
      this.spriteCache.set(key, sp);
      return sp;
    }

    drawMarble(m, scale, alpha) {
      const ctx = this.ctx, sp = this.sprite(m.p, m.r), L = sp.L;
      ctx.save();
      ctx.translate(m.x, m.y);
      if (scale !== undefined && scale !== 1) ctx.scale(scale, scale);
      if (alpha !== undefined) ctx.globalAlpha = alpha;
      if (this.settings.spin) ctx.rotate(m.ang);
      ctx.drawImage(sp.c, -L / 2, -L / 2, L, L);
      if (this.settings.spin) ctx.rotate(-m.ang);
      ctx.drawImage(sp.g, -L / 2, -L / 2, L, L);
      ctx.restore();
    }

    drawAvatar(p, cx, cy, size, alpha) {
      const ctx = this.ctx, r = 20, sp = this.sprite(p, r), k = size / (2 * r), L = sp.L * k;
      ctx.save();
      if (alpha !== undefined) ctx.globalAlpha = alpha;
      ctx.drawImage(sp.c, cx - L / 2, cy - L / 2, L, L);
      ctx.drawImage(sp.g, cx - L / 2, cy - L / 2, L, L);
      ctx.restore();
    }

    // ---------- render ----------
    makeDecor() {
      const r = MR.mulberry32(77), d = this.theme.decor, items = [];
      const n = d === 'grid' ? 0 : 70;
      for (let i = 0; i < n; i++) items.push({ x: r() * W, y: r() * H, s: 0.6 + r() * 2.2, l: (r() * 3) | 0, p: r() * TAU });
      this.decor = items;
    }

    drawBackground() {
      const ctx = this.ctx, th = this.theme, camY = this.cam.y, t = this.clock;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, th.bg[0]); g.addColorStop(0.55, th.bg[1]); g.addColorStop(1, th.bg[2]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const par = [0.06, 0.14, 0.26];
      if (th.decor === 'grid') {
        const sun = ctx.createLinearGradient(0, 120, 0, 380);
        sun.addColorStop(0, '#ffe14d'); sun.addColorStop(1, '#ff2e88');
        ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = sun;
        ctx.beginPath(); ctx.arc(W / 2, 260, 140, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 8; i++) ctx.fillRect(W / 2 - 150, 270 + i * 15, 300, 2 + i * 1.3);
        ctx.restore();
        ctx.strokeStyle = MR.rgba(th.decorColor, 0.16); ctx.lineWidth = 1;
        ctx.beginPath();
        const off = (-camY * 0.3) % 54;
        for (let y = off - 54; y < H + 54; y += 54) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
        const offx = Math.sin(camY * 0.0006) * 20;
        for (let x = -100; x < W + 100; x += 54) { ctx.moveTo(x + offx, 0); ctx.lineTo(x + offx, H); }
        ctx.stroke();
      } else {
        for (const it of this.decor) {
          const f = par[it.l];
          let y = it.y - camY * f;
          if (th.decor === 'bubbles') y -= t * (6 + it.l * 7);
          if (th.decor === 'embers') y -= t * (14 + it.l * 14);
          y = ((y % H) + H) % H;
          let x = it.x;
          if (th.decor === 'embers' || th.decor === 'bubbles') x += Math.sin(t * 0.8 + it.p) * 8;
          let a = 0.25 + it.l * 0.22;
          if (th.decor === 'stars') a *= 0.55 + 0.45 * Math.sin(t * 2 + it.p);
          ctx.fillStyle = MR.rgba(th.decorColor, a);
          ctx.beginPath();
          if (th.decor === 'dots') { ctx.arc(x, y, it.s * 4 + 2, 0, TAU); ctx.globalAlpha = 0.5; }
          else if (th.decor === 'bubbles') { ctx.arc(x, y, it.s * 3.2, 0, TAU); }
          else ctx.arc(x, y, it.s * (th.decor === 'embers' ? 1.3 : 0.9), 0, TAU);
          ctx.fill(); ctx.globalAlpha = 1;
        }
      }
    }

    drawVignette() {
      if (!this.vignette) {
        const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
        const rg = g.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
        rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,.5)');
        g.fillStyle = rg; g.fillRect(0, 0, W, H);
        this.vignette = c;
      }
      this.ctx.drawImage(this.vignette, 0, 0, W, H);
    }

    drawCollider(c) {
      const ctx = this.ctx, th = this.theme;
      if (!c.active || c.hidden) return;
      const v = this.view;
      if (c.maxx < v.x0 || c.minx > v.x1 || c.maxy < v.y0 || c.miny > v.y1) return;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (c.type === 'seg') {
        ctx.beginPath(); ctx.moveTo(c.x1, c.y1); ctx.lineTo(c.x2, c.y2);
        const st = c.style;
        if (st === 'wall' || st === 'divider') {
          ctx.globalAlpha = 0.28; ctx.strokeStyle = th.wall; ctx.lineWidth = c.rad * 2 + 12; ctx.stroke(); ctx.globalAlpha = 1;
          ctx.strokeStyle = th.wall; ctx.lineWidth = c.rad * 2 + 4; ctx.stroke();
          ctx.strokeStyle = th.wallFill; ctx.lineWidth = c.rad * 2; ctx.stroke();
        } else if (st === 'gate') {
          ctx.strokeStyle = '#000'; ctx.lineWidth = c.rad * 2 + 4; ctx.stroke();
          ctx.strokeStyle = th.hazard; ctx.lineWidth = c.rad * 2; ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = c.rad * 1.2; ctx.setLineDash([12, 12]); ctx.stroke(); ctx.setLineDash([]);
        } else {
          const col = st === 'bouncy' ? th.accent2 : st === 'blade' ? th.hazard : th.accent;
          ctx.globalAlpha = 0.3; ctx.strokeStyle = col; ctx.lineWidth = c.rad * 2 + 12; ctx.stroke(); ctx.globalAlpha = 1;
          ctx.strokeStyle = MR.shade(col, -0.55); ctx.lineWidth = c.rad * 2 + 3; ctx.stroke();
          ctx.strokeStyle = col; ctx.lineWidth = c.rad * 2; ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(2, c.rad * 0.7);
          if (st === 'bouncy') ctx.setLineDash([8, 10]);
          ctx.stroke(); ctx.setLineDash([]);
          if (c.hub) {
            ctx.fillStyle = '#fff'; ctx.strokeStyle = MR.shade(col, -0.5); ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(c.hub[0], c.hub[1], c.rad + 4, 0, TAU); ctx.fill(); ctx.stroke();
          }
        }
      } else if (c.type === 'circle') {
        const x = c.x1, y = c.y1;
        if (c.style === 'peg') {
          ctx.fillStyle = MR.rgba(th.peg, 0.28); ctx.beginPath(); ctx.arc(x, y, c.rad + 5, 0, TAU); ctx.fill();
          ctx.fillStyle = th.peg; ctx.beginPath(); ctx.arc(x, y, c.rad, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(x - c.rad * 0.3, y - c.rad * 0.3, c.rad * 0.35, 0, TAU); ctx.fill();
        } else {
          const s = 1 + c.pulse * 0.16, rr = c.rad * s;
          ctx.fillStyle = MR.rgba(th.bumper, 0.3 + c.pulse * 0.3); ctx.beginPath(); ctx.arc(x, y, rr + 9, 0, TAU); ctx.fill();
          const gr = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.35, rr * 0.1, x, y, rr);
          gr.addColorStop(0, MR.shade(th.bumper, 0.55)); gr.addColorStop(1, MR.shade(th.bumper, -0.25));
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, rr * 0.55, 0, TAU); ctx.stroke();
        }
      }
    }

    drawStatics() {
      for (const c of this.world.statics) this.drawCollider(c);
      for (const c of this.world.movers) this.drawCollider(c);
    }

    drawName(m) {
      const ctx = this.ctx;
      let nm = m.p.name || '';
      if (nm.length > 10) nm = nm.slice(0, 9) + '…';
      ctx.font = fontStr(11, 700);
      const w = ctx.measureText(nm).width + 10, x = m.x - w / 2, y = m.y - m.r - 19;
      ctx.fillStyle = 'rgba(8,4,24,.62)';
      this.rr(x, y, w, 15, 7.5); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(nm, m.x, y + 8);
    }

    rr(x, y, w, h, r) {
      const ctx = this.ctx; r = Math.min(r, w / 2, h / 2);
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    text(str, x, y, size, o) {
      o = o || {};
      const ctx = this.ctx;
      ctx.font = fontStr(size, o.weight);
      if (o.maxW) { const w = ctx.measureText(str).width; if (w > o.maxW) { size = (size * o.maxW) / w; ctx.font = fontStr(size, o.weight); } }
      ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'middle'; ctx.lineJoin = 'round';
      if (o.stroke !== false) { ctx.lineWidth = o.sw || Math.max(2, size * 0.2); ctx.strokeStyle = o.stroke || 'rgba(12,6,34,.9)'; ctx.strokeText(str, x, y); }
      ctx.fillStyle = o.fill || '#fff'; ctx.fillText(str, x, y);
    }

    render() {
      const ctx = this.ctx, S = this.S, cam = this.cam;
      ctx.setTransform(S, 0, 0, S, 0, 0);
      ctx.globalAlpha = 1;
      this.drawBackground();
      let sx = 0, sy = 0;
      if (this.shake > 0.2) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; }
      const z = cam.z;
      ctx.save();
      ctx.setTransform(S * z, 0, 0, S * z, S * (W / 2 - cam.x * z + sx), S * (H / 2 - cam.y * z + sy));
      this.view = { x0: cam.x - W / 2 / z - 40, x1: cam.x + W / 2 / z + 40, y0: cam.y - H / 2 / z - 40, y1: cam.y + H / 2 / z + 40 };
      this.mode.drawWorld(this);
      this.drawStatics();
      // jejak
      if (this.settings.trails && this.marbles.length <= 40) {
        ctx.lineCap = 'round';
        for (const m of this.marbles) {
          if (!m.alive || m.trail.length < 2) continue;
          const tr = m.trail;
          for (let i = 1; i < tr.length; i++) {
            const k = i / tr.length;
            ctx.strokeStyle = MR.rgba(m.p.color, k * 0.45); ctx.lineWidth = m.r * 1.5 * k;
            ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke();
          }
        }
      }
      // marble: yang di belakang digambar dulu
      for (const m of this.marbles) {
        if (!m.alive) continue;
        if (m.y < this.view.y0 - 30 || m.y > this.view.y1 + 30) continue;
        this.drawMarble(m, m.pulse ? 1 + m.pulse * 0.15 : 1);
      }
      for (const d of this.dying) {
        if (d.type === 'fall') {
          const k = Math.min(1, d.t / 0.8), m = d.m, old = [m.x, m.y];
          m.x = d.x; m.y = d.y + k * 30;
          this.drawMarble(m, 1 - k, 1 - k * 0.6);
          m.x = old[0]; m.y = old[1];
        }
      }
      this.mode.drawOver(this);
      // nama
      const nm = this.settings.names;
      if (nm !== 'none') {
        for (const m of this.marbles) {
          if (!m.alive) continue;
          if (m.y < this.view.y0 || m.y > this.view.y1) continue;
          if (nm === 'all' || this.marbles.length <= 14 || m.top) this.drawName(m);
        }
      }
      // partikel dunia
      for (const p of this.particles) {
        if (p.k === 's') { ctx.globalAlpha = 1 - p.t / p.max; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - p.t / p.max * 0.5), 0, TAU); ctx.fill(); }
        else if (p.k === 'r') { const k = p.t / p.max; ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.color; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * MR.easeOutCubic(k), 0, TAU); ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
      for (const f of this.floaters) {
        const k = f.t / 1.1;
        ctx.globalAlpha = 1 - k * k;
        this.text(f.text, f.x, f.y - k * 34, f.size, { fill: f.color });
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      ctx.setTransform(S, 0, 0, S, 0, 0);
      this.drawVignette();
      if (this.flash > 0.02) { ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.6})`; ctx.fillRect(0, 0, W, H); }
      this.drawHUD();
      if (this.state === 'finished') this.drawResults();
      // konfeti (layar)
      for (const p of this.particles) {
        if (p.k !== 'c') continue;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, (p.max - p.t) * 2);
        ctx.scale(1, Math.abs(Math.sin(p.t * 6 + p.ph)) * 0.8 + 0.2);
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // ---------- HUD ----------
    drawHUD() {
      const ctx = this.ctx, th = this.theme, s = this.settings;
      // judul
      const title = (s.title || '').toUpperCase();
      if (title) this.text(title, W / 2, 62, 34, { maxW: 496, sw: 7, stroke: 'rgba(12,6,34,.92)' });
      // pill mode + waktu
      const m = this.mode;
      let label = `${m.icon}  ${m.name.toUpperCase()}`;
      if (this.state === 'running' || this.state === 'finished') label += `   •   ${MR.fmtTime(this.time)}`;
      ctx.font = fontStr(14, 700);
      const w = Math.min(500, ctx.measureText(label).width + 36);
      const g = ctx.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0);
      g.addColorStop(0, MR.rgba(th.accent, 0.92)); g.addColorStop(1, MR.rgba(th.accent2, 0.92));
      ctx.fillStyle = g; this.rr(W / 2 - w / 2, 92, w, 26, 13); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; ctx.stroke();
      this.text(label, W / 2, 105.5, 14, { stroke: false, fill: '#10062e', maxW: 480 });
      m.drawHUD(this);
      // footer
      if (s.footer) {
        ctx.font = fontStr(20, 700);
        const fw = Math.min(480, ctx.measureText(s.footer).width + 40);
        const fy = m.footerY || 806;
        ctx.fillStyle = 'rgba(10,5,30,.55)'; this.rr(W / 2 - fw / 2, fy, fw, 38, 19); ctx.fill();
        ctx.strokeStyle = MR.rgba(th.accent2, 0.8); ctx.lineWidth = 2; ctx.stroke();
        this.text(s.footer, W / 2, fy + 19.5, 20, { stroke: false, maxW: 440 });
      }
      // banner
      const b = this.bannerObj;
      if (b) {
        const k = Math.min(1, b.t / 0.35), out = b.t > b.dur - 0.4 ? (b.dur - b.t) / 0.4 : 1;
        ctx.save(); ctx.globalAlpha = Math.max(0, out);
        ctx.translate(W / 2, 205); ctx.scale(0.4 + 0.6 * MR.easeOutBack(k), 0.4 + 0.6 * MR.easeOutBack(k));
        this.text(b.text, 0, 0, 40, { fill: b.color, maxW: 470, sw: 8 });
        if (b.sub) this.text(b.sub, 0, 34, 18, { maxW: 440 });
        ctx.restore();
      }
      // countdown
      if (this.state === 'countdown') {
        const num = Math.ceil(this.cd), fr = this.cd - Math.floor(this.cd);
        if (num >= 1 && num <= 3) {
          ctx.save(); ctx.translate(W / 2, 430); const sc = 1 + fr * 0.55; ctx.scale(sc, sc); ctx.globalAlpha = 0.35 + 0.65 * (1 - fr * 0.6);
          this.text(String(num), 0, 0, 170, { fill: th.accent2, sw: 18 }); ctx.restore();
        } else this.text('SIAP?', W / 2, 430, 70, { fill: th.accent2, sw: 12 });
      } else if (this.state === 'running' && this.goT < 0.9) {
        ctx.save(); ctx.translate(W / 2, 430); const k = this.goT / 0.9, sc = 1 + k * 0.8; ctx.scale(sc, sc); ctx.globalAlpha = 1 - k;
        this.text('GO!', 0, 0, 150, { fill: '#ffe14d', sw: 16 }); ctx.restore();
      } else if (this.state === 'ready' && !this.hidePrompt) {
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.clock * 4);
        this.text('TEKAN MULAI', W / 2, 700, 30, { sw: 6 }); ctx.globalAlpha = 1;
      }
    }

    // baris papan peringkat: rows = [{m, val}]
    drawLeaderboard(rows, x, y, opt) {
      opt = opt || {};
      const ctx = this.ctx, n = Math.min(rows.length, opt.max || 5), w = opt.w || 172, rh = 29;
      if (!n) return;
      ctx.fillStyle = 'rgba(10,5,30,.5)'; this.rr(x, y, w, n * rh + 8, 14); ctx.fill();
      const medal = ['#ffd23f', '#d5dbe6', '#e0954f'];
      for (let i = 0; i < n; i++) {
        const r = rows[i], cy = y + 4 + i * rh + rh / 2;
        r.m.top = true;
        ctx.fillStyle = i < 3 ? medal[i] : 'rgba(255,255,255,.2)';
        ctx.beginPath(); ctx.arc(x + 15, cy, 10, 0, TAU); ctx.fill();
        this.text(String(i + 1), x + 15, cy + 0.5, 12, { stroke: false, fill: i < 3 ? '#2a1600' : '#fff' });
        this.drawAvatar(r.m.p, x + 42, cy, 22);
        const nm = r.m.p.name || '';
        this.text(nm, x + 58, cy + 0.5, 13, { align: 'left', maxW: opt.val ? w - 58 - 44 : w - 66, stroke: false });
        if (r.val !== undefined && r.val !== null) this.text(String(r.val), x + w - 8, cy + 0.5, 13, { align: 'right', stroke: false, fill: this.theme.accent2 });
      }
    }

    // deretan avatar pemain (mode eliminasi)
    drawRoster(y) {
      const ctx = this.ctx, ms = this.marbles, n = ms.length;
      if (!n) return;
      const sz = n <= 12 ? 30 : n <= 24 ? 24 : n <= 40 ? 18 : 14, gap = 4, perRow = Math.floor(500 / (sz + gap));
      const rows = Math.ceil(n / perRow);
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / perRow), inRow = Math.min(perRow, n - row * perRow);
        const x0 = W / 2 - (inRow * (sz + gap) - gap) / 2, col = i - row * perRow;
        const cx = x0 + col * (sz + gap) + sz / 2, cy = y + row * (sz + gap) + sz / 2, m = ms[i];
        this.drawAvatar(m.p, cx, cy, sz, m.alive ? 1 : 0.25);
        if (!m.alive) {
          ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 2.5; ctx.beginPath();
          ctx.moveTo(cx - sz * 0.3, cy - sz * 0.3); ctx.lineTo(cx + sz * 0.3, cy + sz * 0.3);
          ctx.moveTo(cx + sz * 0.3, cy - sz * 0.3); ctx.lineTo(cx - sz * 0.3, cy + sz * 0.3); ctx.stroke();
        }
      }
      return rows * (sz + gap);
    }

    drawResults() {
      const ctx = this.ctx, th = this.theme, R = this.results, t = R.t, list = R.list;
      const a = Math.min(1, t / 0.6);
      ctx.fillStyle = `rgba(6,2,22,${0.66 * a})`; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2, 360); ctx.rotate(t * 0.3); ctx.globalAlpha = 0.16 * a;
      for (let i = 0; i < 14; i++) {
        ctx.rotate(TAU / 14); ctx.fillStyle = i % 2 ? th.accent2 : th.accent;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-30, -420); ctx.lineTo(30, -420); ctx.closePath(); ctx.fill();
      }
      ctx.restore(); ctx.globalAlpha = 1;
      const e = MR.easeOutBack(Math.min(1, t / 0.7));
      ctx.save(); ctx.translate(W / 2, 168); ctx.scale(e, e);
      this.text('🏆 PEMENANG 🏆', 0, 0, 44, { fill: '#ffd23f', sw: 9, maxW: 480 }); ctx.restore();
      const win = list[0];
      if (!win) return;
      const big = this.sprite(win.m.p, 64), L = big.L;
      const bob = Math.sin(t * 3) * 6;
      ctx.save(); ctx.translate(W / 2, 330 + bob); const es = MR.easeOutBack(Math.min(1, Math.max(0, (t - 0.15) / 0.7)));
      ctx.scale(es, es);
      ctx.fillStyle = MR.rgba(win.m.p.color, 0.3); ctx.beginPath(); ctx.arc(0, 0, 96 + Math.sin(t * 4) * 4, 0, TAU); ctx.fill();
      ctx.rotate(this.settings.spin ? Math.sin(t * 1.6) * 0.25 : 0);
      ctx.drawImage(big.c, -L / 2, -L / 2, L, L);
      ctx.rotate(this.settings.spin ? -Math.sin(t * 1.6) * 0.25 : 0);
      ctx.drawImage(big.g, -L / 2, -L / 2, L, L);
      ctx.restore();
      this.text((win.m.p.name || '').toUpperCase(), W / 2, 450, 46, { maxW: 470, fill: '#fff', sw: 10 });
      if (win.label) this.text(win.label, W / 2, 488, 20, { fill: th.accent2 });
      // peringkat 2..7
      const rows = Math.min(6, list.length - 1);
      for (let i = 0; i < rows; i++) {
        const r = list[i + 1], k = Math.min(1, Math.max(0, (t - 0.5 - i * 0.12) / 0.4)), y = 530 + i * 42;
        ctx.save(); ctx.globalAlpha = k; ctx.translate((1 - MR.easeOutCubic(k)) * 120, 0);
        ctx.fillStyle = 'rgba(255,255,255,.12)'; this.rr(70, y, 400, 36, 18); ctx.fill();
        const medal = ['#d5dbe6', '#e0954f'][i] || 'rgba(255,255,255,.25)';
        ctx.fillStyle = medal; ctx.beginPath(); ctx.arc(94, y + 18, 13, 0, TAU); ctx.fill();
        this.text(String(i + 2), 94, y + 18.5, 15, { stroke: false, fill: i < 2 ? '#2a1600' : '#fff' });
        this.drawAvatar(r.m.p, 130, y + 18, 28);
        this.text(r.m.p.name || '', 154, y + 18.5, 18, { align: 'left', maxW: 200, stroke: false });
        if (r.label) this.text(r.label, 458, y + 18.5, 15, { align: 'right', stroke: false, fill: th.accent2 });
        ctx.restore();
      }
    }
  }

  MR.Game = Game;
})();
