/* Marble Mania - perekam video langsung dari canvas (+ audio game) */
(function () {
  const MR = (window.MR = window.MR || {});
  const R = (MR.recorder = {
    rec: null, chunks: [], mime: '', t0: 0, last: null,
    supported() { return typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream; },
    pickMime() {
      const c = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4',
        'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      return c.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    },
    get recording() { return !!this.rec && this.rec.state !== 'inactive'; },
    start(canvas, quality) {
      if (!this.supported() || this.recording) return false;
      MR.audio.resume();
      const stream = canvas.captureStream(60);
      if (MR.audio.dest) MR.audio.dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      const mime = this.pickMime();
      const opts = { videoBitsPerSecond: quality >= 2 ? 12e6 : 7e6, audioBitsPerSecond: 160000 };
      if (mime) opts.mimeType = mime;
      this.mime = mime; this.chunks = [];
      try { this.rec = new MediaRecorder(stream, opts); } catch (e) { this.rec = new MediaRecorder(stream); }
      this.rec.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
      this.rec.start(250);
      this.t0 = performance.now();
      return true;
    },
    stop() {
      return new Promise((resolve) => {
        if (!this.recording) return resolve(null);
        this.rec.onstop = () => {
          const type = this.rec.mimeType || this.mime || 'video/webm';
          const blob = new Blob(this.chunks, { type });
          const ext = type.includes('mp4') ? 'mp4' : 'webm';
          if (this.last && this.last.url) URL.revokeObjectURL(this.last.url);
          this.last = { blob, ext, url: URL.createObjectURL(blob), size: blob.size };
          this.rec.stream.getTracks().forEach((t) => { if (t.kind === 'video') t.stop(); });
          this.rec = null;
          resolve(this.last);
        };
        this.rec.stop();
      });
    },
    download(name) {
      if (!this.last) return;
      const a = document.createElement('a');
      a.href = this.last.url; a.download = `${name || 'marble-mania'}-${Date.now()}.${this.last.ext}`;
      document.body.appendChild(a); a.click(); a.remove();
    },
    elapsed() { return this.recording ? (performance.now() - this.t0) / 1000 : 0; },
  });
})();
