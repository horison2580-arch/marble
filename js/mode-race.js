/* Marble Mania - mode Balapan Gravitasi & Race Eliminasi (trek prosedural, berbeda tiap acak) */
(function () {
  const MR = window.MR;
  const W = MR.W, H = MR.H;

  function spinner(g, cx, cy, half, rad, w, phase, style) {
    return g.seg(cx - half, cy, cx + half, cy, rad, {
      style: style || 'bar', mover: true, tag: 'bar', cx, cy, w, hub: [cx, cy], e: 0.55, mu: 0.04, ang0: phase,
      update(t) {
        const a = this.ang0 + this.w * t, dx = Math.cos(a) * half, dy = Math.sin(a) * half;
        this.x1 = cx - dx; this.y1 = cy - dy; this.x2 = cx + dx; this.y2 = cy + dy;
      },
    });
  }
  function slider(g, cx, cy, half, amp, sp, ph, tilt, rad) {
    return g.seg(cx - half, cy - tilt, cx + half, cy + tilt, rad, {
      style: 'bar', mover: true, tag: 'bar', e: 0.5, mu: 0.1,
      update(t) {
        const x = cx + amp * Math.sin(sp * t + ph);
        this.vx = amp * sp * Math.cos(sp * t + ph);
        this.x1 = x - half; this.x2 = x + half;
      },
    });
  }
  const ramp = (g, x1, y1, x2, y2, rad, o) => g.seg(x1, y1, x2, y2, rad || 8, o);

  // pustaka potongan trek; masing-masing mengembalikan tinggi yang dipakai
  const SEGS = {
    zigzag(g, y, rng, r) {
      const gap = Math.max(118, r * 5.4), ang = 0.17 + rng() * 0.08, len = W - gap, dy = Math.tan(ang) * len;
      let yy = y + 40;
      for (let i = 0; i < 4; i++) {
        if (i % 2 === 0) ramp(g, 0, yy, len, yy + dy); else ramp(g, W, yy, gap, yy + dy);
        yy += dy + 92;
      }
      return yy - y;
    },
    pegs(g, y, rng, r) {
      const dx = Math.max(66, 2 * r + 38), rows = 7, dy = 70;
      for (let row = 0; row < rows; row++) {
        const yy = y + 50 + row * dy, off = (row % 2) * dx / 2;
        for (let x = off + dx / 2 - (row % 2 ? 0 : 0); x < W - 8; x += dx) {
          if (x < 10 || rng() < 0.07) continue;
          g.circ(x, yy, 7, { style: 'peg', tag: 'peg', e: 0.55 });
        }
      }
      return rows * dy + 90;
    },
    spinners(g, y, rng, r) {
      const dir = rng() < 0.5 ? 1 : -1, sp = 1.5 + rng() * 0.9;
      spinner(g, 135, y + 90, 96, 9, sp * dir, rng() * 6);
      spinner(g, 405, y + 200, 96, 9, -sp * dir, rng() * 6);
      spinner(g, 270, y + 320, 100, 9, sp * dir, rng() * 6);
      g.circ(24, y + 200, 10, { style: 'peg', tag: 'peg' }); g.circ(516, y + 90, 10, { style: 'peg', tag: 'peg' });
      return 450;
    },
    funnel(g, y, rng, r) {
      const gap = Math.max(104, r * 5.2);
      ramp(g, 0, y + 30, W / 2 - gap / 2, y + 150, 9); ramp(g, W, y + 30, W / 2 + gap / 2, y + 150, 9);
      spinner(g, W / 2, y + 215, gap * 0.62, 8, (rng() < 0.5 ? 1 : -1) * 2.6, rng() * 6);
      g.circ(90, y + 300, 9, { style: 'peg', tag: 'peg' }); g.circ(450, y + 300, 9, { style: 'peg', tag: 'peg' });
      return 340;
    },
    bumpers(g, y, rng, r) {
      const pts = [];
      for (let tries = 0; tries < 200 && pts.length < 7; tries++) {
        const rad = 26 + rng() * 10, x = 55 + rng() * (W - 110), yy = y + 60 + rng() * 410;
        const min = Math.max(96, r * 4.6);
        if (pts.every((p) => Math.hypot(p.x - x, p.y - yy) > p.r + rad + min * 0.62)) pts.push({ x, y: yy, r: rad });
      }
      pts.forEach((p) => g.circ(p.x, p.y, p.r, { style: 'bumper', tag: 'bumper', kick: 250, e: 0.8 }));
      return 540;
    },
    sliders(g, y, rng, r) {
      const ph = rng() * 6;
      slider(g, W / 2, y + 90, 105, 150, 1.0 + rng() * 0.4, ph, 22, 9);
      slider(g, W / 2, y + 230, 105, 150, 1.1 + rng() * 0.4, ph + 2.2, -22, 9);
      slider(g, W / 2, y + 370, 105, 150, 0.9 + rng() * 0.4, ph + 4.1, 22, 9);
      return 480;
    },
    wheel(g, y, rng, r) {
      const w = (rng() < 0.5 ? 1 : -1) * (1.1 + rng() * 0.4), c = rng() * 6;
      spinner(g, W / 2, y + 220, 165, 10, w, c); spinner(g, W / 2, y + 220, 165, 10, w, c + Math.PI / 2);
      ramp(g, 0, y + 40, 60, y + 70, 8); ramp(g, W, y + 40, W - 60, y + 70, 8);
      return 450;
    },
    bouncers(g, y, rng, r) {
      const xs = [120, 400, 200, 360];
      xs.forEach((x, i) => {
        const a = (i % 2 ? -1 : 1) * (0.32 + rng() * 0.12), l = 78;
        const yy = y + 70 + i * 105 + rng() * 20;
        ramp(g, x - Math.cos(a) * l, yy - Math.sin(a) * l, x + Math.cos(a) * l, yy + Math.sin(a) * l, 9, { style: 'bouncy', tag: 'bouncy', e: 1.08 });
      });
      return 470;
    },
  };
  const LIB = Object.keys(SEGS).filter((k) => k !== 'pegs');

  function makeRace(elim) {
    const mode = {
      id: elim ? 'elim' : 'race',
      name: elim ? 'Race Eliminasi' : 'Balapan Gravitasi',
      icon: elim ? '💀' : '🏁',
      desc: elim
        ? 'Balapan menuruni trek, tapi posisi paling buncit gugur berkala! Bertahan atau finis duluan.'
        : 'Marble meluncur di trek acak penuh spinner, bumper & jebakan. Yang pertama finis menang!',
      options: [
        { key: 'length', label: 'Panjang trek', def: 'medium', values: [['short', 'Pendek (±20 dtk)'], ['medium', 'Sedang (±35 dtk)'], ['long', 'Panjang (±55 dtk)']] },
      ].concat(elim
        ? [{ key: 'elimEvery', label: 'Eliminasi tiap', def: '6', values: [['4', '4 detik'], ['6', '6 detik'], ['9', '9 detik']] }]
        : [{ key: 'finishAt', label: 'Selesai saat', def: '3', values: [['1', 'Juara 1 finis'], ['3', 'Podium (3 besar)'], ['all', 'Semua finis']] }]),
      usesSeed: true,
      gravity: 1150, nudge: true, rMax: 20, eMul: 1,

      setup(g) {
        const o = g.modeOpts, rng = g.rng, r = g.marbleR, n = g.players.length;
        const st = (g.ms = { order: [], finishY: 0, startY: 126, nextElim: 7, elimCount: 0 });
        const segN = { short: 5, medium: 9, long: 14 }[o.length || 'medium'] || 7;
        st.gate = g.seg(0, 126, W, 126, 10, { style: 'gate', tag: 'gate', e: 0.3 });
        // pemain di ruang start
        const cols = Math.max(1, Math.floor((W - 30) / (2 * r + 3))), cw = (W - 30) / cols;
        const idx = g.players.map((_, i) => i);
        for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
        idx.forEach((pi, i) => {
          const row = Math.floor(i / cols), col = i % cols;
          g.spawn(g.players[pi], 15 + (col + 0.5) * cw + (rng() - 0.5) * 3, 126 - 10 - r - row * (2 * r + 3) - rng() * 2);
        });
        // trek
        let y = 170, prev = 'pegs';
        y += SEGS.pegs(g, y, rng, r);
        for (let s = 0; s < segN; s++) {
          let k; do { k = LIB[Math.floor(rng() * LIB.length)]; } while (k === prev && LIB.length > 1);
          prev = k; y += SEGS[k](g, y, rng, r);
        }
        st.finishY = y + 50;
        const floorY = st.finishY + 300;
        g.seg(0, floorY, W, floorY, 20, { style: 'wall' });
        g.seg(-30, -1200, -30, floorY + 40, 30, { style: 'wall' });
        g.seg(W + 30, -1200, W + 30, floorY + 40, 30, { style: 'wall' });
        st.floorY = floorY;
      },
      start(g) { g.ms.gate.active = false; g.ms.t0 = g.time; },
      step() {},

      rank(g) {
        const st = g.ms;
        const rest = g.marbles.filter((m) => m.alive && !m.finished).sort((a, b) => b.y - a.y);
        return st.order.concat(rest);
      },

      frame(g, dt) {
        const st = g.ms, o = g.modeOpts;
        for (const m of g.marbles) {
          if (!m.alive || m.finished || m.y < st.finishY) continue;
          m.finished = true; m.finishT = g.time; st.order.push(m);
          const pos = st.order.length;
          g.floater(m.x, st.finishY - 14, '#' + pos, '#ffe14d', 20);
          g.ringFx(m.x, st.finishY, m.p.color, 70);
          if (pos === 1) {
            g.banner('🏁 ' + (m.p.name || '').toUpperCase(), '#ffe14d', 'MELEWATI GARIS FINIS!', 2.2);
            g.slowmo(0.35, 0.9); g.flash = 0.9; g.shake = 9;
            MR.audio.finish();
          } else MR.audio.finish();
        }
        const alive = g.marbles.filter((m) => m.alive);
        if (elim && g.endTimer === null) {
          if (g.time >= st.nextElim) {
            const every = +o.elimEvery || 6;
            st.nextElim = g.time + every;
            const cands = alive.filter((m) => !m.finished).sort((a, b) => a.y - b.y);
            let cnt = Math.ceil(g.players.length / 12);
            while (cnt-- > 0 && cands.length > 1) {
              const v = cands.shift();
              g.eliminate(v, 'pop');
              g.banner('❌ ' + (v.p.name || '').toUpperCase(), '#ff4d6d', 'GUGUR! TERTINGGAL PALING JAUH', 1.6);
            }
          }
          if (alive.filter((m) => !m.finished).length <= 1 && st.order.length === 0) g.endTimer = 1.4;
        }
        const need = elim ? 1 : o.finishAt === 'all' ? alive.length : Math.min(+o.finishAt || 3, alive.length);
        if (st.order.length >= Math.max(1, need) && g.endTimer === null) g.endTimer = need === 1 ? 1.8 : 1.4;
      },

      finish(g) {
        const st = g.ms;
        const rest = g.marbles.filter((m) => m.alive && !m.finished).sort((a, b) => b.y - a.y);
        const out = g.elimOrder.slice().reverse();
        const order = st.order.concat(rest, out);
        const labels = order.map((m) => (m.finished ? (m.finishT - st.t0).toFixed(1) + ' dtk' : m.out ? 'gugur' : ''));
        g.finishGame(order, labels);
      },

      camTarget(g) {
        const st = g.ms;
        const act = g.marbles.filter((m) => m.alive && !m.finished);
        let lead, last, zmin = elim ? 0.55 : 0.78;
        if (act.length) { lead = -1e9; last = 1e9; for (const m of act) { if (m.y > lead) lead = m.y; if (m.y < last) last = m.y; } }
        else { lead = st.finishY; last = st.finishY - 100; }
        const below = g.state === 'ready' || g.state === 'countdown' ? 400 : 270;
        let bottom = Math.min(lead + below, st.floorY + 50);
        const span = bottom - (last - 70);
        let z = MR.clamp(H / span, zmin, 1);
        if (st.order.length && act.length === 0) z = 1;
        const cy = bottom - H / z / 2;
        return { y: cy, z };
      },

      drawWorld(g) {
        const ctx = g.ctx, st = g.ms, th = g.theme, y = st.finishY;
        // garis start
        ctx.fillStyle = MR.rgba(th.accent2, 0.9);
        g.text('START', W / 2, 150, 20, { stroke: 'rgba(0,0,0,.5)' });
        // garis finis
        if (y > g.view.y0 - 60 && y < g.view.y1 + 60) {
          const gr = ctx.createLinearGradient(0, y - 120, 0, y);
          gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, MR.rgba(th.accent2, 0.22));
          ctx.fillStyle = gr; ctx.fillRect(0, y - 120, W, 120);
          const sq = 18, nx = Math.ceil(W / sq);
          for (let row = 0; row < 2; row++) for (let i = 0; i < nx; i++) {
            ctx.fillStyle = (i + row) % 2 ? '#111' : '#fff'; ctx.fillRect(i * sq, y + row * sq - sq / 2, sq, sq);
          }
          ctx.fillStyle = th.accent2; ctx.fillRect(0, y - sq / 2 - 3, W, 3); ctx.fillRect(0, y + sq * 1.5, W, 3);
          g.text('FINISH', W / 2, y - 36, 34, { fill: '#fff', sw: 8 });
        }
        // kolam akhir
        if (st.floorY > g.view.y0 && st.floorY - 200 < g.view.y1) {
          ctx.fillStyle = MR.rgba(th.accent2, 0.07); ctx.fillRect(0, y + 28, W, st.floorY - y - 28);
        }
      },
      drawOver() {},

      drawHUD(g) {
        const st = g.ms, rows = mode.rank(g).map((m, i) => ({ m, val: m.finished ? '🏁' : null }));
        g.drawLeaderboard(rows, 10, 132, { max: 5, w: 176 });
        // rel progres
        const x = 20, y0 = 330, y1 = 780, ctx = g.ctx;
        ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
        g.text('🏁', x, y1 + 12, 16, { stroke: false });
        const span = st.finishY - st.startY;
        for (const m of g.marbles) {
          if (!m.alive) continue;
          const p = MR.clamp((m.y - st.startY) / span, 0, 1);
          g.drawAvatar(m.p, x, y0 + p * (y1 - y0), g.marbles.length > 30 ? 10 : 15);
        }
        if (elim && g.state === 'running') {
          const left = Math.max(0, st.nextElim - g.time);
          ctx.font = '700 13px Poppins, sans-serif';
          g.text(`💀 GUGUR DALAM ${Math.ceil(left)} DTK`, W - 12, 150, 13, { align: 'right', fill: '#ff8fa3', sw: 4 });
        }
      },
    };
    return mode;
  }

  MR.helpers = { spinner, slider };
  MR.registerMode(makeRace(false));
  MR.registerMode(makeRace(true));
})();
