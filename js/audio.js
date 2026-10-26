/* Marble Mania - efek suara sintetis (WebAudio) yang ikut terekam */
(function () {
  const MR = (window.MR = window.MR || {});
  const A = (MR.audio = {
    ctx: null, master: null, dest: null, enabled: true, last: 0, volume: 0.55,
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
        if (this.ctx.createMediaStreamDestination) {
          this.dest = this.ctx.createMediaStreamDestination();
          this.master.connect(this.dest);
        }
      } catch (e) { this.ctx = null; }
    },
    resume() { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    setEnabled(v) { this.enabled = v; if (this.master) this.master.gain.value = v ? this.volume : 0; },
    tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
      if (!this.ctx || !this.enabled) return;
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.05);
    },
    noise(dur, vol = 0.15, freq = 1200, delay = 0) {
      if (!this.ctx || !this.enabled) return;
      const t = this.ctx.currentTime + delay;
      const n = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = this.ctx.createBufferSource(); s.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
      const g = this.ctx.createGain(); g.gain.value = vol;
      s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
    },
    tick(power) {
      const now = performance.now();
      if (now - this.last < 28) return;
      this.last = now;
      const p = Math.min(1, power / 900);
      this.tone(900 + Math.random() * 900, 0.06, 'triangle', 0.05 + p * 0.12, 420);
    },
    bump() { this.tone(180, 0.18, 'sine', 0.3, 60); this.tone(620, 0.1, 'square', 0.06, 900); },
    beep() { this.tone(660, 0.16, 'square', 0.14); },
    go() { this.tone(990, 0.5, 'square', 0.16); this.tone(1320, 0.5, 'sawtooth', 0.08, null, 0.02); },
    pop() { this.noise(0.25, 0.25, 700); this.tone(300, 0.2, 'sine', 0.25, 70); },
    coin() { this.tone(1046, 0.09, 'square', 0.1); this.tone(1568, 0.18, 'square', 0.1, null, 0.08); },
    finish() { this.tone(784, 0.12, 'triangle', 0.18); this.tone(1175, 0.25, 'triangle', 0.18, null, 0.1); },
    whoosh() { this.noise(0.5, 0.12, 500); },
    fanfare() {
      const n = [523, 659, 784, 1047, 784, 1047, 1319];
      n.forEach((f, i) => { this.tone(f, 0.32, 'square', 0.12, null, i * 0.13); this.tone(f / 2, 0.32, 'triangle', 0.14, null, i * 0.13); });
    },
  });
})();
