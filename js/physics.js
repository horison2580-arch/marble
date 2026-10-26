/* Marble Mania - mesin fisika ringan (marble = lingkaran, penghalang = kapsul / lingkaran / cincin) */
(function () {
  const MR = (window.MR = window.MR || {});

  class World {
    constructor() {
      this.gravity = 1150; // px/s^2
      this.t = 0;
      this.bodies = [];
      this.statics = [];
      this.movers = [];
      this.rings = [];
      this.grid = new Map();
      this.cs = 96;
      this.stamp = 0;
      this.onHit = null;
      this.hitMin = 170; // kecepatan benturan minimum yang dilaporkan (px/s)
      this.restVel = 45; // di bawah ini tidak memantul
      this.dirty = false;
    }

    addBody(o) {
      const b = Object.assign({
        x: 0, y: 0, vx: 0, vy: 0, r: 10, eMul: 1, mu: 0.06, drag: 0.05,
        ang: 0, av: 0, gs: 1, active: true, tag: 'marble',
      }, o);
      b.m = o.m || b.r * b.r;
      b.im = 1 / b.m;
      this.bodies.push(b);
      return b;
    }
    removeBody(b) { b.active = false; this.dirty = true; }

    addStatic(c) {
      const s = Object.assign({
        type: 'seg', x1: 0, y1: 0, x2: 0, y2: 0, rad: 8, e: 0.45, mu: 0.05, kick: 0,
        tag: 'wall', style: 'wall', active: true, w: 0, cx: 0, cy: 0, vx: 0, vy: 0,
        mover: false, update: null, _s: 0, pulse: 0,
      }, c);
      this.calcBounds(s);
      if (s.type === 'ring') this.rings.push(s);
      else if (s.mover) this.movers.push(s);
      else this.statics.push(s);
      return s;
    }

    calcBounds(s) {
      if (s.type === 'ring') { s.minx = s.cx - s.R; s.maxx = s.cx + s.R; s.miny = s.cy - s.R; s.maxy = s.cy + s.R; return; }
      const x2 = s.type === 'seg' ? s.x2 : s.x1, y2 = s.type === 'seg' ? s.y2 : s.y1;
      s.minx = Math.min(s.x1, x2) - s.rad; s.maxx = Math.max(s.x1, x2) + s.rad;
      s.miny = Math.min(s.y1, y2) - s.rad; s.maxy = Math.max(s.y1, y2) + s.rad;
    }

    key(cx, cy) { return (cx + 64) * 8192 + (cy + 512); }

    build() {
      this.grid = new Map();
      const cs = this.cs;
      for (const s of this.statics) {
        const x0 = Math.floor(s.minx / cs), x1 = Math.floor(s.maxx / cs);
        const y0 = Math.floor(s.miny / cs), y1 = Math.floor(s.maxy / cs);
        for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
          const k = this.key(cx, cy);
          let a = this.grid.get(k);
          if (!a) { a = []; this.grid.set(k, a); }
          a.push(s);
        }
      }
    }

    step(h) {
      this.t += h;
      for (const mv of this.movers) {
        if (!mv.active) continue;
        if (mv.update) mv.update(this.t, h);
        this.calcBounds(mv);
      }
      const B = this.bodies;
      const g = this.gravity;
      for (let i = 0; i < B.length; i++) {
        const b = B[i];
        if (!b.active) continue;
        b.vy += g * b.gs * h;
        const dk = 1 - b.drag * h;
        b.vx *= dk; b.vy *= dk;
        const sp2 = b.vx * b.vx + b.vy * b.vy;
        if (sp2 > 2200 * 2200) { const f = 2200 / Math.sqrt(sp2); b.vx *= f; b.vy *= f; }
        b.x += b.vx * h; b.y += b.vy * h;
        b.ang += b.av * h;
        b.av *= 1 - 0.25 * h;
      }
      for (let it = 0; it < 2; it++) {
        this.collidePairs();
        for (let i = 0; i < B.length; i++) if (B[i].active) this.collideStatics(B[i]);
      }
      if (this.dirty) { this.bodies = B.filter((b) => b.active); this.dirty = false; }
    }

    collidePairs() {
      const B = this.bodies;
      // sort by x (hampir terurut => murah)
      for (let i = 1; i < B.length; i++) {
        const k = B[i]; let j = i - 1;
        while (j >= 0 && B[j].x > k.x) { B[j + 1] = B[j]; j--; }
        B[j + 1] = k;
      }
      let maxR = 0;
      for (let i = 0; i < B.length; i++) if (B[i].r > maxR) maxR = B[i].r;
      for (let i = 0; i < B.length; i++) {
        const a = B[i];
        if (!a.active) continue;
        for (let j = i + 1; j < B.length; j++) {
          const b = B[j];
          if (b.x - a.x > a.r + maxR) break;
          if (!b.active) continue;
          if (a.ghost || b.ghost) continue;
          const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
          if (dx * dx + dy * dy >= rr * rr) continue;
          let d = Math.sqrt(dx * dx + dy * dy), nx, ny;
          if (d < 1e-6) { nx = 0; ny = -1; d = 0; } else { nx = dx / d; ny = dy / d; }
          const pen = rr - d, sum = a.im + b.im;
          a.x -= nx * pen * (a.im / sum); a.y -= ny * pen * (a.im / sum);
          b.x += nx * pen * (b.im / sum); b.y += ny * pen * (b.im / sum);
          const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rvn < 0) {
            const e = -rvn < this.restVel ? 0 : 0.82 * a.eMul * b.eMul;
            const jn = (-(1 + e) * rvn) / sum;
            a.vx -= jn * a.im * nx; a.vy -= jn * a.im * ny;
            b.vx += jn * b.im * nx; b.vy += jn * b.im * ny;
            if (-rvn > this.hitMin && this.onHit) this.onHit(a, b, -rvn, a.x + nx * a.r, a.y + ny * a.r, nx, ny);
          }
        }
      }
    }

    collideStatics(b) {
      if (b.ghost) return;
      const cs = this.cs, r = b.r;
      const x0 = Math.floor((b.x - r) / cs), x1 = Math.floor((b.x + r) / cs);
      const y0 = Math.floor((b.y - r) / cs), y1 = Math.floor((b.y + r) / cs);
      const st = ++this.stamp;
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        const a = this.grid.get(this.key(cx, cy));
        if (!a) continue;
        for (let i = 0; i < a.length; i++) {
          const c = a[i];
          if (c._s === st || !c.active) continue;
          c._s = st;
          this.resolve(b, c);
        }
      }
      const M = this.movers;
      for (let i = 0; i < M.length; i++) {
        const c = M[i];
        if (!c.active) continue;
        if (b.x + r < c.minx || b.x - r > c.maxx || b.y + r < c.miny || b.y - r > c.maxy) continue;
        this.resolve(b, c);
      }
      const R = this.rings;
      for (let i = 0; i < R.length; i++) if (R[i].active) this.resolveRing(b, R[i]);
    }

    resolve(b, c) {
      let px, py;
      if (c.type === 'seg') {
        const ex = c.x2 - c.x1, ey = c.y2 - c.y1, l2 = ex * ex + ey * ey;
        let t = l2 > 0 ? ((b.x - c.x1) * ex + (b.y - c.y1) * ey) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        px = c.x1 + ex * t; py = c.y1 + ey * t;
      } else { px = c.x1; py = c.y1; }
      const dx = b.x - px, dy = b.y - py, rr = b.r + c.rad;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) return;
      let d = Math.sqrt(d2), nx, ny;
      if (d < 1e-6) { nx = 0; ny = -1; d = 0; } else { nx = dx / d; ny = dy / d; }
      const pen = rr - d;
      b.x += nx * pen; b.y += ny * pen;
      const vsx = c.vx - c.w * (py - c.cy), vsy = c.vy + c.w * (px - c.cx);
      this.contact(b, c, nx, ny, vsx, vsy, px + nx * c.rad, py + ny * c.rad);
    }

    resolveRing(b, c) {
      const dx = b.x - c.cx, dy = b.y - c.cy, d = Math.sqrt(dx * dx + dy * dy);
      const lim = c.R - b.r;
      if (d <= lim || d < 1e-6) return;
      const nx = -dx / d, ny = -dy / d, pen = d - lim;
      b.x += nx * pen; b.y += ny * pen;
      this.contact(b, c, nx, ny, 0, 0, c.cx + (dx / d) * c.R, c.cy + (dy / d) * c.R);
    }

    contact(b, c, nx, ny, vsx, vsy, hx, hy) {
      let rvx = b.vx - vsx, rvy = b.vy - vsy;
      const vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        const e = -vn < this.restVel ? 0 : c.e * b.eMul;
        const j = -(1 + e) * vn;
        rvx += j * nx; rvy += j * ny;
        const tx = -ny, ty = nx;
        const vt = rvx * tx + rvy * ty;
        const maxF = (c.mu + b.mu) * 0.5 * j;
        const dvt = vt > maxF ? maxF : vt < -maxF ? -maxF : vt;
        rvx -= dvt * tx; rvy -= dvt * ty;
        if (c.kick && -vn > 60) { rvx += nx * c.kick; rvy += ny * c.kick; c.pulse = 1; }
        b.vx = vsx + rvx; b.vy = vsy + rvy;
        if (-vn > this.hitMin && this.onHit) this.onHit(b, c, -vn, hx, hy, nx, ny);
      }
      // putaran visual (rolling tanpa slip)
      const vt2 = (b.vx - vsx) * -ny + (b.vy - vsy) * nx;
      b.av += (vt2 / b.r - b.av) * 0.3;
      b.cnx = nx; b.cny = ny; b.cT = this.t;
    }
  }

  MR.World = World;
})();
