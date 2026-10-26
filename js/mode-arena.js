/* Marble Mania - mode Plinko Jackpot, Sumo Ring, Battle Arena */
(function () {
  const MR = window.MR;
  const W = MR.W, H = MR.H, TAU = Math.PI * 2;
  const { spinner } = MR.helpers;
  const STATIC_CAM = () => ({ y: H / 2, z: 1 });

  // ======================= PLINKO =======================
  MR.registerMode({
    id: 'plinko', name: 'Plinko Jackpot', icon: '🎰',
    desc: 'Semua marble dijatuhkan lewat papan paku & kincir. Masuk slot berpoin, ada slot JACKPOT yang berubah tiap ronde!',
    options: [{ key: 'bins', label: 'Jumlah slot', def: '7', values: [['5', '5 slot'], ['7', '7 slot'], ['9', '9 slot']] }],
    usesSeed: true, gravity: 820, nudge: true, rMax: 13.5, drag: 0.04, footerY: 884,

    setup(g) {
      const o = g.modeOpts, rng = g.rng, r = g.marbleR, nb = +o.bins || 7;
      const st = (g.ms = { nb, binTop: 700, landed: [], values: [], jackpot: 0 });
      g.seg(-30, -300, -30, 900, 30, { style: 'wall' });
      g.seg(W + 30, -300, W + 30, 900, 30, { style: 'wall' });
      g.seg(0, 150, 180, 246, 9, { style: 'wall' });
      g.seg(W, 150, W - 180, 246, 9, { style: 'wall' });
      st.gate = g.seg(176, 254, W - 176, 254, 8, { style: 'gate', tag: 'gate' });
      // pemain di hopper
      const cols = Math.max(1, Math.floor((W - 40) / (2 * r + 3))), cw = (W - 40) / cols;
      const idx = g.players.map((_, i) => i);
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      idx.forEach((pi, i) => {
        const row = Math.floor(i / cols), col = i % cols;
        g.spawn(g.players[pi], 20 + (col + 0.5) * cw + (rng() - 0.5) * 4, 140 - r - row * (2 * r + 3));
      });
      // kincir
      const mills = [[135, 450], [405, 540]];
      mills.forEach(([x, y], k) => spinner(g, x, y, 62, 7, (k ? -1 : 1) * (1.8 + rng()), rng() * 6));
      // paku
      for (let row = 0; row < 8; row++) {
        const y = 310 + row * 50, off = row % 2 ? 30 : 0;
        for (let x = off; x <= W; x += 60) {
          if (x < 14 || x > W - 14) continue;
          if (mills.some(([mx, my]) => Math.hypot(mx - x, my - y) < 76)) continue;
          g.circ(x, y, 6.5, { style: 'peg', tag: 'peg', e: 0.6 });
        }
      }
      // slot
      const bw = W / nb;
      for (let i = 1; i < nb; i++) g.seg(i * bw, st.binTop + 6, i * bw, 856, 4.5, { style: 'divider', e: 0.35 });
      g.seg(0, 868, W, 868, 14, { style: 'wall' });
      const base = [10, 25, 50, 100, 200];
      st.jackpot = Math.floor(rng() * nb);
      for (let i = 0; i < nb; i++) {
        const d = Math.round(Math.abs(i - (nb - 1) / 2));
        st.values.push(i === st.jackpot ? 500 : base[Math.min(d, 4)]);
      }
    },
    start(g) { g.ms.gate.active = false; g.ms.t0 = g.time; },
    step() {},
    rank(g) {
      return g.marbles.slice().sort((a, b) => {
        const pa = a.landed ? a.points : -1, pb = b.landed ? b.points : -1;
        if (pa !== pb) return pb - pa;
        return (a.landT || 1e9) - (b.landT || 1e9);
      });
    },
    frame(g, dt) {
      const st = g.ms, bw = W / st.nb;
      for (const m of g.marbles) {
        if (m.landed || m.y < st.binTop + m.r * 0.8) continue;
        m.landed = true; m.landT = g.time;
        m.bin = MR.clamp(Math.floor(m.x / bw), 0, st.nb - 1);
        m.points = st.values[m.bin];
        st.landed.push(m);
        const jp = m.bin === st.jackpot;
        g.floater(m.x, st.binTop - 6, '+' + m.points, jp ? '#ffd23f' : '#fff', jp ? 26 : 18);
        g.ringFx(m.x, m.y, jp ? '#ffd23f' : m.p.color, jp ? 90 : 45);
        if (jp) { g.banner('💰 JACKPOT! ' + (m.p.name || '').toUpperCase(), '#ffd23f', '+500 POIN', 2); g.flash = 0.7; g.shake = 8; MR.audio.fanfare(); }
        else MR.audio.coin();
      }
      if (st.landed.length >= g.marbles.length && g.endTimer === null) g.endTimer = 1.6;
      if (g.time > 75 && g.endTimer === null) g.endTimer = 0.1;
    },
    finish(g) {
      const order = MR.modes.plinko.rank(g);
      g.finishGame(order, order.map((m) => (m.landed ? m.points + ' poin' : '—')));
    },
    camTarget: STATIC_CAM,
    drawWorld(g) {
      const ctx = g.ctx, st = g.ms, th = g.theme, bw = W / st.nb;
      const pulse = 0.5 + 0.5 * Math.sin(g.clock * 5);
      for (let i = 0; i < st.nb; i++) {
        const jp = i === st.jackpot, x = i * bw;
        const gr = ctx.createLinearGradient(0, st.binTop, 0, 856);
        gr.addColorStop(0, jp ? MR.rgba('#ffd23f', 0.15 + pulse * 0.25) : MR.rgba(th.accent2, 0.04));
        gr.addColorStop(1, jp ? MR.rgba('#ffd23f', 0.55) : MR.rgba(th.accent, 0.3));
        ctx.fillStyle = gr; ctx.fillRect(x + 2, st.binTop, bw - 4, 156);
        g.text(String(st.values[i]), x + bw / 2, 806, jp ? 24 : 22, { fill: jp ? '#ffd23f' : '#fff', sw: 5, maxW: bw - 6 });
        if (jp) g.text('JACKPOT', x + bw / 2, 832, 11, { fill: '#ffd23f', sw: 3, maxW: bw - 4 });
      }
      g.text('▼ PUTAR & JATUH ▼', W / 2, 205, 14, { fill: MR.rgba('#fff', 0.7), sw: 3 });
    },
    drawOver() {},
    drawHUD(g) {
      const st = g.ms;
      const rows = MR.modes.plinko.rank(g).map((m) => ({ m, val: m.landed ? m.points : '-' }));
      g.drawLeaderboard(rows, 10, 132, { max: 5, w: 176, val: true });
      g.text(`MASUK SLOT ${st.landed.length}/${g.marbles.length}`, W - 12, 150, 13, { align: 'right', sw: 4 });
    },
  });

  // ======================= util arena =======================
  function placeRings(g, cx, cy, R, rng) {
    const n = g.players.length, r = g.marbleR, list = [];
    let k = 0, placed = 0;
    const idx = g.players.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    while (placed < n && k < 12) {
      const rad = k === 0 && n <= 8 ? R * 0.5 : R * (0.28 + 0.17 * k);
      const cap = k === 0 && n === 1 ? 1 : Math.max(1, Math.floor((TAU * rad) / (2 * r + 5)));
      const take = Math.min(cap, n - placed), a0 = rng() * TAU;
      for (let i = 0; i < take; i++) {
        const a = a0 + (i / take) * TAU;
        list.push({ pi: idx[placed + i], x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
      }
      placed += take; k++;
    }
    return list;
  }
  function nearestEnemy(g, m) {
    let best = null, bd = 1e18;
    for (const o of g.marbles) {
      if (o === m || !o.alive) continue;
      const d = (o.x - m.x) ** 2 + (o.y - m.y) ** 2;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  function dash(g, m, tx, ty, sp, jitter) {
    const a = Math.atan2(ty - m.y, tx - m.x) + (g.rng() - 0.5) * jitter;
    m.vx += Math.cos(a) * sp; m.vy += Math.sin(a) * sp;
  }
  function aliveCount(g) { let c = 0; for (const m of g.marbles) if (m.alive) c++; return c; }
  function drawCharging(g) {
    const ctx = g.ctx;
    for (const m of g.marbles) {
      if (!m.alive || !m.charging) continue;
      const k = 1 - m.chargeT / 0.35;
      ctx.strokeStyle = MR.rgba(m.p.color, 0.9); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r * (2.1 - k * 0.9), 0, TAU); ctx.stroke();
    }
  }

  // ======================= SUMO =======================
  MR.registerMode({
    id: 'sumo', name: 'Sumo Ring', icon: '🥊',
    desc: 'Saling dorong di ring melayang! Ring terus menyusut dan bilah raksasa berputar. Jatuh = gugur. Terakhir bertahan menang.',
    options: [
      { key: 'shrink', label: 'Ring menyusut', def: 'normal', values: [['slow', 'Pelan'], ['normal', 'Normal'], ['fast', 'Cepat']] },
      { key: 'blade', label: 'Bilah berputar', def: 'on', values: [['on', 'Aktif'], ['off', 'Mati']] },
    ],
    gravity: 0, drag: 1.15, eMul: 1.06, rMax: 24,

    setup(g) {
      const rng = g.rng, cx = W / 2, cy = 480, R = 238;
      const st = (g.ms = { cx, cy, R, R0: R, minR: 88, blade: null });
      placeRings(g, cx, cy, R, rng).forEach((p) => {
        const m = g.spawn(g.players[p.pi], p.x, p.y);
        m.dashT = 1.4 + rng() * 2.0; m.charging = false;
      });
      st.blade = g.seg(cx - 100, cy, cx + 100, cy, 11, {
        style: 'blade', mover: true, tag: 'blade', cx, cy, w: 1.5, kick: 170, e: 0.8, mu: 0.02, hub: [cx, cy], active: false, ang0: rng() * 6,
        update(t) {
          const half = Math.max(46, st.R * 0.8), a = this.ang0 + this.w * t;
          const dx = Math.cos(a) * half, dy = Math.sin(a) * half;
          this.x1 = cx - dx; this.y1 = cy - dy; this.x2 = cx + dx; this.y2 = cy + dy;
        },
      });
    },
    start() {},
    step() {},
    frame(g, dt) {
      const st = g.ms, o = g.modeOpts;
      const rate = { slow: 3.5, normal: 5.5, fast: 9 }[o.shrink || 'normal'];
      if (g.time > 10) st.R = Math.max(st.minR, st.R - rate * dt);
      if (o.blade !== 'off' && !st.blade.active && g.time >= 8) {
        st.blade.active = true; g.banner('⚠️ BILAH MUNCUL!', '#ff4d6d', '', 1.8); MR.audio.whoosh(); g.shake = 6;
      }
      for (const m of g.marbles) {
        if (!m.alive) continue;
        const d = Math.hypot(m.x - st.cx, m.y - st.cy);
        if (d > st.R + m.r * 0.35) {
          g.eliminate(m, 'fall');
          g.banner('💥 ' + (m.p.name || '').toUpperCase(), '#ff6b81', 'JATUH KELUAR RING!', 1.5);
          continue;
        }
        if (m.charging) {
          m.chargeT -= dt;
          if (m.chargeT <= 0) {
            m.charging = false; m.dashT = 1.3 + g.rng() * 1.8;
            if (d > st.R * 0.7 && g.rng() < 0.65) dash(g, m, st.cx, st.cy, 300 + g.rng() * 100, 0.5);
            else { const t = nearestEnemy(g, m); if (t) dash(g, m, t.x, t.y, 270 + g.rng() * 150, 0.5); }
          }
        } else { m.dashT -= dt; if (m.dashT <= 0) { m.charging = true; m.chargeT = 0.35; } }
      }
      if (aliveCount(g) <= 1 && g.endTimer === null) g.endTimer = 1.5;
    },
    finish(g) {
      const alive = g.marbles.filter((m) => m.alive);
      const out = g.elimOrder.slice().reverse();
      const order = alive.concat(out);
      g.finishGame(order, order.map((m) => (m.alive ? 'BERTAHAN' : (m.outT || 0).toFixed(0) + ' dtk')));
    },
    camTarget: STATIC_CAM,
    drawWorld(g) {
      const ctx = g.ctx, st = g.ms, th = g.theme, { cx, cy, R } = st;
      // aura jurang
      const ag = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R + 70);
      ag.addColorStop(0, MR.rgba(th.platformEdge, 0.3)); ag.addColorStop(1, MR.rgba(th.platformEdge, 0));
      ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(cx, cy, R + 70, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(cx, cy + 22, R + 4, 0, TAU); ctx.fill();
      ctx.fillStyle = MR.shade(th.platform, -0.55); ctx.beginPath(); ctx.arc(cx, cy + 14, R, 0, TAU); ctx.fill();
      const pg = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
      pg.addColorStop(0, MR.shade(th.platform, 0.25)); pg.addColorStop(1, th.platform);
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = MR.rgba(th.platformEdge, 0.18); ctx.lineWidth = 2;
      for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.arc(cx, cy, (R * k) / 5, 0, TAU); ctx.stroke(); }
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + g.clock * 0.05; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke(); }
      // tepi
      ctx.strokeStyle = MR.rgba(th.platformEdge, 0.35); ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.strokeStyle = th.platformEdge; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      if (st.R > st.minR + 1 && g.time > 4) {
        ctx.setLineDash([14, 12]); ctx.strokeStyle = MR.rgba(th.hazard, 0.5 + 0.4 * Math.sin(g.clock * 8)); ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(cx, cy, st.R - 10, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      // bagian yang sudah runtuh
    },
    drawOver(g) { drawCharging(g); },
    drawHUD(g) {
      const h = g.drawRoster(132) || 0;
      g.text(`TERSISA ${aliveCount(g)} / ${g.marbles.length}`, W / 2, 770, 26, { sw: 6 });
    },
  });

  // ======================= BATTLE =======================
  function hurt(g, m, d, crit) {
    if (!m.alive || d <= 0) return;
    m.hp -= d; m.hurtT = 0.25;
    g.floater(m.x + (g.rng() - 0.5) * 14, m.y - m.r, (crit ? 'CRIT -' : '-') + Math.round(d), crit ? '#ffd23f' : '#ff8fa3', crit ? 20 : 14);
    if (m.hp <= 0) {
      g.eliminate(m, 'pop');
      g.banner('☠️ ' + (m.p.name || '').toUpperCase(), '#ff4d6d', 'KO!', 1.4);
    }
  }

  MR.registerMode({
    id: 'battle', name: 'Battle Arena', icon: '⚔️',
    desc: 'Arena tertutup, setiap tabrakan mengurangi HP (ada critical hit!). Badai menyempit & orb penyembuh muncul. Last marble standing!',
    options: [
      { key: 'hp', label: 'HP awal', def: '100', values: [['60', 'Sedikit (60)'], ['100', 'Normal (100)'], ['160', 'Banyak (160)']] },
      { key: 'storm', label: 'Badai menyempit', def: 'on', values: [['on', 'Aktif'], ['off', 'Mati']] },
    ],
    gravity: 0, drag: 0.8, eMul: 1.08, rMax: 22,

    setup(g) {
      const rng = g.rng, cx = W / 2, cy = 490, R = 250, hp0 = +g.modeOpts.hp || 100;
      const st = (g.ms = { cx, cy, R, safeR: R, orbs: [], nextOrb: 8, hp0 });
      g.ring(cx, cy, R, { style: 'wall', hidden: true, e: 0.9, tag: 'wall' });
      const a0 = rng() * TAU;
      for (let i = 0; i < 3; i++) {
        const a = a0 + (i / 3) * TAU;
        g.circ(cx + Math.cos(a) * 112, cy + Math.sin(a) * 112, 24, { style: 'bumper', tag: 'bumper', kick: 210, e: 0.9 });
      }
      placeRings(g, cx, cy, R * 0.92, rng).forEach((p) => {
        const m = g.spawn(g.players[p.pi], p.x, p.y);
        m.hp = hp0; m.maxHp = hp0; m.dashT = 0.8 + rng() * 1.2; m.charging = false; m.hurtT = 0; m.lastHit = -9;
      });
    },
    start() {},
    step() {},
    onMarbleHit(g, a, b, sp) {
      if (sp < 120) return;
      if (g.time - a.lastHit < 0.2 && g.time - b.lastHit < 0.2) return;
      a.lastHit = b.lastHit = g.time;
      const sa = Math.hypot(a.vx, a.vy), sb = Math.hypot(b.vx, b.vy);
      let dmg = MR.clamp(sp * 0.02, 1.5, 18);
      const crit = g.rng() < 0.12; if (crit) dmg *= 1.7;
      const fa = (sb + 30) / (sa + sb + 60);
      hurt(g, a, dmg * fa * 1.5, crit && fa > 0.5);
      hurt(g, b, dmg * (1 - fa) * 1.5, crit && fa <= 0.5);
    },
    frame(g, dt) {
      const st = g.ms, o = g.modeOpts;
      // badai
      if (o.storm !== 'off' && g.time > 14) {
        const k = MR.clamp((g.time - 14) / 55, 0, 1);
        st.safeR = st.R - (st.R - 100) * k;
        if (g.time < 14.3) g.banner('🌪️ BADAI MENYEMPIT!', '#ff4d6d', 'Tetap di zona aman', 2);
        const dps = 4 + (g.time - 14) * 0.12;
        for (const m of g.marbles) {
          if (!m.alive) continue;
          if (Math.hypot(m.x - st.cx, m.y - st.cy) > st.safeR) { m.storm = true; m.hp -= dps * dt; m.hurtT = Math.max(m.hurtT, 0.08); if (m.hp <= 0) { g.eliminate(m, 'pop'); g.banner('🌪️ ' + (m.p.name || '').toUpperCase(), '#ff4d6d', 'TERTELAN BADAI!', 1.4); } }
          else m.storm = false;
        }
      }
      // orb penyembuh
      if (g.time >= st.nextOrb && st.orbs.length < 2) {
        st.nextOrb = g.time + 7;
        const a = g.rng() * TAU, d = Math.sqrt(g.rng()) * st.safeR * 0.7;
        st.orbs.push({ x: st.cx + Math.cos(a) * d, y: st.cy + Math.sin(a) * d, t: 0 });
      }
      for (let i = st.orbs.length - 1; i >= 0; i--) {
        const orb = st.orbs[i]; orb.t += dt;
        for (const m of g.marbles) {
          if (!m.alive || (m.x - orb.x) ** 2 + (m.y - orb.y) ** 2 > (m.r + 14) ** 2) continue;
          m.hp = Math.min(m.maxHp, m.hp + st.hp0 * 0.3);
          g.floater(m.x, m.y - m.r, '+' + Math.round(st.hp0 * 0.3), '#7bed9f', 18);
          g.ringFx(orb.x, orb.y, '#7bed9f', 60); MR.audio.coin();
          st.orbs.splice(i, 1); break;
        }
      }
      // AI
      for (const m of g.marbles) {
        if (!m.alive) continue;
        if (m.hurtT > 0) m.hurtT -= dt;
        if (m.charging) {
          m.chargeT -= dt;
          if (m.chargeT <= 0) {
            m.charging = false; m.dashT = 0.9 + g.rng() * 1.3;
            const d = Math.hypot(m.x - st.cx, m.y - st.cy);
            if (m.storm || d > st.safeR) dash(g, m, st.cx, st.cy, 300, 0.4);
            else {
              const orb = st.orbs[0];
              if (orb && m.hp < m.maxHp * 0.5 && g.rng() < 0.6) dash(g, m, orb.x, orb.y, 280, 0.3);
              else { const t = nearestEnemy(g, m); if (t) dash(g, m, t.x, t.y, 300 + g.rng() * 160, 0.4); }
            }
          }
        } else { m.dashT -= dt; if (m.dashT <= 0) { m.charging = true; m.chargeT = 0.3; } }
      }
      if (aliveCount(g) <= 1 && g.endTimer === null) g.endTimer = 1.6;
    },
    finish(g) {
      const alive = g.marbles.filter((m) => m.alive).sort((a, b) => b.hp - a.hp);
      const order = alive.concat(g.elimOrder.slice().reverse());
      g.finishGame(order, order.map((m) => (m.alive ? 'HP ' + Math.max(1, Math.round(m.hp)) : (m.outT || 0).toFixed(0) + ' dtk')));
    },
    camTarget: STATIC_CAM,
    drawWorld(g) {
      const ctx = g.ctx, st = g.ms, th = g.theme, { cx, cy, R } = st;
      const fg = ctx.createRadialGradient(cx, cy, 10, cx, cy, R);
      fg.addColorStop(0, MR.shade(th.platform, 0.18)); fg.addColorStop(1, MR.shade(th.platform, -0.35));
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = MR.rgba(th.wall, 0.14); ctx.lineWidth = 2;
      for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.arc(cx, cy, (R * k) / 6, 0, TAU); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      // badai
      if (st.safeR < R - 1) {
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.arc(cx, cy, st.safeR, 0, TAU, true); ctx.clip();
        ctx.fillStyle = MR.rgba(th.hazard, 0.26 + 0.1 * Math.sin(g.clock * 6)); ctx.fillRect(0, 0, W, H); ctx.restore();
        ctx.setLineDash([16, 12]); ctx.strokeStyle = th.hazard; ctx.lineWidth = 4;
        ctx.lineDashOffset = -g.clock * 30; ctx.beginPath(); ctx.arc(cx, cy, st.safeR, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      // dinding neon
      ctx.strokeStyle = MR.rgba(th.wall, 0.3); ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(cx, cy, R + 11, 0, TAU); ctx.stroke();
      ctx.strokeStyle = th.wallFill; ctx.lineWidth = 18; ctx.beginPath(); ctx.arc(cx, cy, R + 9, 0, TAU); ctx.stroke();
      ctx.strokeStyle = th.wall; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, R + 0.5, 0, TAU); ctx.stroke();
    },
    drawOver(g) {
      const ctx = g.ctx, st = g.ms;
      drawCharging(g);
      for (const orb of st.orbs) {
        const p = 1 + Math.sin(orb.t * 6) * 0.12;
        ctx.fillStyle = 'rgba(123,237,159,.3)'; ctx.beginPath(); ctx.arc(orb.x, orb.y, 24 * p, 0, TAU); ctx.fill();
        ctx.fillStyle = '#7bed9f'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(orb.x, orb.y, 13 * p, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillRect(orb.x - 6, orb.y - 1.8, 12, 3.6); ctx.fillRect(orb.x - 1.8, orb.y - 6, 3.6, 12);
      }
      for (const m of g.marbles) {
        if (!m.alive) continue;
        const w = Math.max(28, m.r * 2 + 8), x = m.x - w / 2, y = m.y + m.r + 5, k = MR.clamp(m.hp / m.maxHp, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,.65)'; g.rr(x - 1.5, y - 1.5, w + 3, 8, 4); ctx.fill();
        ctx.fillStyle = k > 0.55 ? '#2ed573' : k > 0.28 ? '#ffd23f' : '#ff4757'; g.rr(x, y, Math.max(2, w * k), 5, 2.5); ctx.fill();
        if (m.hurtT > 0) {
          ctx.globalAlpha = Math.min(0.6, m.hurtT * 3); ctx.fillStyle = '#ff2d55'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
        }
      }
    },
    drawHUD(g) {
      g.drawRoster(132);
      g.text(`TERSISA ${aliveCount(g)} / ${g.marbles.length}`, W / 2, 790, 26, { sw: 6 });
    },
  });

})();
