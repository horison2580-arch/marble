/* Marble Mania - UI & penyimpanan */
(function () {
  const MR = window.MR;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const KEY = 'marblemania.v2';
  const MAX = 100;

  const state = {
    players: [], mode: 'race', opts: {},
    settings: { theme: 'neon', title: 'SIAPA YANG MENANG?', footer: '', names: 'auto', spin: true, trails: true, speed: 1, quality: 2, size: 1, sound: true, guide: false, auto: true },
  };
  let game, saveT = 0, imgTarget = -1, autoStopT = 0;

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------- data pemain ----------
  function newPlayer(i) {
    const used = new Set(state.players.map((p) => p.name));
    const name = MR.NAMES.find((n) => !used.has(n)) || 'Pemain ' + (i + 1);
    return { id: MR.uid(), name, color: MR.PALETTE[i % MR.PALETTE.length], img: null, v: 0 };
  }
  function hydrate(p) {
    if (p.img && !p.imgEl) {
      p.imgEl = new Image();
      p.imgEl.onload = () => { p.v = (p.v || 0) + 1; };
      p.imgEl.src = p.img;
    }
    return p;
  }
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify({
          players: state.players.map((p) => ({ id: p.id, name: p.name, color: p.color, img: p.img })),
          mode: state.mode, opts: state.opts, settings: state.settings,
        }));
      } catch (e) { toast('Penyimpanan penuh: gambar tidak tersimpan permanen.'); }
    }, 300);
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d && Array.isArray(d.players) && d.players.length) {
        state.players = d.players.slice(0, MAX).map((p) => hydrate({ id: p.id || MR.uid(), name: String(p.name || ''), color: p.color || '#ff4757', img: p.img || null, v: 0 }));
        if (MR.modes[d.mode]) state.mode = d.mode;
        state.opts = d.opts || {};
        Object.assign(state.settings, d.settings || {});
      }
    } catch (e) { /* abaikan */ }
    if (!state.players.length) for (let i = 0; i < 10; i++) state.players.push(newPlayer(i));
  }

  // ---------- sinkron ke game ----------
  function modeOpts() {
    const m = MR.modes[state.mode], o = state.opts[state.mode] || (state.opts[state.mode] = {});
    (m.options || []).forEach((op) => { if (o[op.key] === undefined) o[op.key] = op.def; });
    return o;
  }
  function applySettings() {
    const s = state.settings;
    game.setSettings({ theme: s.theme, title: s.title, footer: s.footer, names: s.names, spin: s.spin, trails: s.trails, speed: s.speed, quality: s.quality, size: s.size });
    MR.audio.setEnabled(s.sound);
    $('#btnSound').textContent = s.sound ? '🔊' : '🔇';
    $('#btnSound').classList.toggle('on', !s.sound);
    $('#safeGuide').hidden = !s.guide;
  }
  function rebuild(newSeed) {
    game.setPlayers(state.players);
    game.setMode(state.mode, modeOpts());
    game.restart(newSeed);
    renderModeOptions();
    refreshButtons();
  }

  // ---------- daftar pemain ----------
  function renderPlayers() {
    const ul = $('#playerList'); ul.innerHTML = '';
    state.players.forEach((p, i) => {
      const li = document.createElement('li'); li.className = 'prow'; li.dataset.i = i;
      const letter = ([...(p.name || '?').trim()][0] || '?').toUpperCase();
      li.innerHTML = `<span class="no">${i + 1}</span>
        <button class="av" style="--c:${p.color}" title="Ganti gambar" aria-label="Ganti gambar pemain ${i + 1}">${p.img ? `<img alt="" src="${p.img}">` : letter}</button>
        <input class="pname" maxlength="18" value="" aria-label="Nama pemain ${i + 1}">
        <input class="pcolor" type="color" value="${p.color}" aria-label="Warna">
        <button class="pdel" title="Hapus" aria-label="Hapus pemain">✕</button>`;
      $('.pname', li).value = p.name;
      ul.appendChild(li);
    });
    $('#playerCount').textContent = state.players.length;
  }
  function refreshAvatar(i) {
    const li = $(`.prow[data-i="${i}"]`); if (!li) return;
    const p = state.players[i], av = $('.av', li);
    av.style.setProperty('--c', p.color);
    av.innerHTML = p.img ? `<img alt="" src="${p.img}">` : ([...(p.name || '?').trim()][0] || '?').toUpperCase();
  }
  async function toDataURL(file, size) {
    size = size || 192;
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
      const c = document.createElement('canvas'); c.width = c.height = size;
      const g = c.getContext('2d'), s = Math.max(size / img.naturalWidth, size / img.naturalHeight);
      g.drawImage(img, (size - img.naturalWidth * s) / 2, (size - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
      return c.toDataURL('image/webp', 0.86);
    } finally { URL.revokeObjectURL(url); }
  }
  async function setImage(i, file) {
    if (!file || !file.type.startsWith('image/')) return toast('File harus berupa gambar.');
    try {
      const p = state.players[i];
      p.img = await toDataURL(file); p.imgEl = null; hydrate(p); p.v = (p.v || 0) + 1;
      refreshAvatar(i); save();
    } catch (e) { toast('Gagal membaca gambar (format tidak didukung).'); }
  }
  function setCount(n) {
    n = MR.clamp(n, 1, MAX);
    while (state.players.length < n) state.players.push(newPlayer(state.players.length));
    if (state.players.length > n) state.players.length = n;
    renderPlayers(); save(); rebuild(false);
  }

  function bindPlayers() {
    const ul = $('#playerList');
    ul.addEventListener('input', (e) => {
      const li = e.target.closest('.prow'); if (!li) return;
      const p = state.players[+li.dataset.i];
      if (e.target.classList.contains('pname')) { p.name = e.target.value; p.v = (p.v || 0) + 1; if (!p.img) refreshAvatar(+li.dataset.i); }
      if (e.target.classList.contains('pcolor')) { p.color = e.target.value; p.v = (p.v || 0) + 1; refreshAvatar(+li.dataset.i); }
      save();
    });
    ul.addEventListener('click', (e) => {
      const li = e.target.closest('.prow'); if (!li) return;
      const i = +li.dataset.i;
      if (e.target.closest('.av')) {
        if (state.players[i].img && e.shiftKey) { state.players[i].img = null; state.players[i].imgEl = null; state.players[i].v++; refreshAvatar(i); save(); return; }
        imgTarget = i; $('#fileInput').value = ''; $('#fileInput').click();
      }
      if (e.target.closest('.pdel')) {
        if (state.players.length <= 1) return toast('Minimal 1 pemain.');
        state.players.splice(i, 1); renderPlayers(); save(); rebuild(false);
      }
    });
    ul.addEventListener('dragover', (e) => { const li = e.target.closest('.prow'); if (li) { e.preventDefault(); li.classList.add('drag'); } });
    ul.addEventListener('dragleave', (e) => { const li = e.target.closest('.prow'); if (li) li.classList.remove('drag'); });
    ul.addEventListener('drop', (e) => {
      const li = e.target.closest('.prow'); if (!li) return;
      e.preventDefault(); li.classList.remove('drag');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) setImage(+li.dataset.i, f);
    });
    $('#fileInput').addEventListener('change', (e) => { if (imgTarget >= 0 && e.target.files[0]) setImage(imgTarget, e.target.files[0]); });
    // saat berhenti mengetik / ganti warna → muat ulang arena agar sprite benar
    ul.addEventListener('change', () => { if (game.state === 'ready') rebuild(false); });

    $('#btnAdd').onclick = () => { if (state.players.length >= MAX) return toast('Maksimal 100 pemain.'); setCount(state.players.length + 1); const l = $('#playerList'); l.lastElementChild && l.lastElementChild.scrollIntoView({ block: 'nearest' }); };
    $('#btnShuffleColor').onclick = () => {
      const pal = MR.PALETTE.slice().sort(() => Math.random() - 0.5);
      state.players.forEach((p, i) => { p.color = pal[i % pal.length]; p.v++; });
      renderPlayers(); save(); rebuild(false);
    };
    $('#btnShuffleOrder').onclick = () => {
      state.players.sort(() => Math.random() - 0.5); renderPlayers(); save(); rebuild(false);
    };
    $('#btnClearImgs').onclick = () => {
      state.players.forEach((p) => { p.img = null; p.imgEl = null; p.v++; }); renderPlayers(); save(); rebuild(false); toast('Semua gambar dihapus.');
    };
    const q = $('#quickCounts');
    [4, 8, 12, 20, 30, 50, 100].forEach((n) => {
      const b = document.createElement('button'); b.className = 'chip'; b.textContent = n; b.onclick = () => setCount(n); q.appendChild(b);
    });
    // tempel nama
    const dlg = $('#bulkDlg');
    $('#btnBulk').onclick = () => { $('#bulkText').value = state.players.map((p) => p.name).join('\n'); dlg.showModal(); };
    dlg.addEventListener('close', () => {
      const act = dlg.returnValue;
      if (act !== 'replace' && act !== 'append') return;
      const names = $('#bulkText').value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, MAX);
      if (!names.length) return;
      if (act === 'replace') {
        names.forEach((n, i) => { if (state.players[i]) { state.players[i].name = n; state.players[i].v++; } else { const p = newPlayer(i); p.name = n; state.players.push(p); } });
        state.players.length = Math.max(names.length, 1);
      } else names.forEach((n) => { if (state.players.length < MAX) { const p = newPlayer(state.players.length); p.name = n; state.players.push(p); } });
      renderPlayers(); save(); rebuild(false);
    });
  }

  // ---------- mode ----------
  function renderModes() {
    const g = $('#modeGrid'); g.innerHTML = '';
    MR.modeOrder.forEach((id) => {
      const m = MR.modes[id], b = document.createElement('button');
      b.className = 'mcard' + (id === state.mode ? ' sel' : ''); b.dataset.id = id;
      b.innerHTML = `<div class="ic">${m.icon}</div><div><b>${m.name}</b><span>${m.desc}</span></div>`;
      b.onclick = () => { state.mode = id; save(); $$('.mcard', g).forEach((x) => x.classList.toggle('sel', x.dataset.id === id)); rebuild(true); };
      g.appendChild(b);
    });
  }
  function renderModeOptions() {
    const m = MR.modes[state.mode], o = modeOpts(), box = $('#modeOptions');
    let h = '<h3>Pengaturan mode</h3>';
    (m.options || []).forEach((op) => {
      h += `<div class="optrow"><label>${op.label}</label><select class="inp" data-k="${op.key}">${op.values.map(([v, l]) => `<option value="${v}"${String(o[op.key]) === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>`;
    });
    if (m.usesSeed || true) h += `<div class="seedrow"><span class="muted">Layout arena <code>#${game.seed.toString(36)}</code></span><span><button class="btn ghost sm" id="btnSameSeed">↺ Ulangi</button> <button class="btn sm" id="btnNewSeed">🎲 Acak baru</button></span></div>`;
    box.innerHTML = h;
    $$('select', box).forEach((s) => s.onchange = () => { o[s.dataset.k] = s.value; save(); rebuild(false); });
    $('#btnSameSeed').onclick = () => rebuild(false);
    $('#btnNewSeed').onclick = () => rebuild(true);
  }

  // ---------- tampilan ----------
  function bindLook() {
    const s = state.settings, tg = $('#themeGrid');
    Object.entries(MR.THEMES).forEach(([id, t]) => {
      const b = document.createElement('button'); b.className = 'theme' + (id === s.theme ? ' sel' : ''); b.dataset.id = id;
      b.innerHTML = `<i style="background:linear-gradient(135deg,${t.swatch[0]},${t.swatch[1]} 60%,${t.swatch[2]})"></i><span>${t.name}</span>`;
      b.onclick = () => { s.theme = id; $$('.theme', tg).forEach((x) => x.classList.toggle('sel', x.dataset.id === id)); applySettings(); save(); };
      tg.appendChild(b);
    });
    const bind = (id, key, conv, ev) => {
      const el = $(id); const v = s[key];
      if (el.type === 'checkbox') el.checked = !!v; else el.value = String(v);
      el.addEventListener(ev || 'input', () => {
        s[key] = conv ? conv(el) : el.value; applySettings(); save();
        if (key === 'size') rebuild(false);
      });
    };
    bind('#inTitle', 'title'); bind('#inFooter', 'footer');
    bind('#selNames', 'names', null, 'change');
    bind('#selSpin', 'spin', (e) => e.value === '1', 'change');
    bind('#selSize', 'size', (e) => +e.value, 'change');
    bind('#selQuality', 'quality', (e) => +e.value, 'change');
    bind('#rngSpeed', 'speed', (e) => { $('#speedLbl').textContent = e.value + '×'; return +e.value; });
    $('#speedLbl').textContent = s.speed + '×';
    bind('#chkTrails', 'trails', (e) => e.checked, 'change');
    bind('#chkSound', 'sound', (e) => e.checked, 'change');
    bind('#chkGuide', 'guide', (e) => e.checked, 'change');
    bind('#chkAuto', 'auto', (e) => e.checked, 'change');
  }

  // ---------- kontrol & rekam ----------
  function refreshButtons() {
    const b = $('#btnStart'), st = game.state;
    b.classList.remove('stop');
    if (st === 'ready') b.textContent = '▶ MULAI';
    else if (st === 'countdown' || st === 'running') { b.textContent = '■ BERHENTI'; b.classList.add('stop'); }
    else b.textContent = '↻ MAIN LAGI';
    $('#btnPause').classList.toggle('on', game.paused);
  }
  function recFormatLabel() {
    if (!MR.recorder.supported()) return 'Browser ini tidak mendukung perekaman langsung. Gunakan screen-record bawaan perangkat.';
    const m = MR.recorder.pickMime() || 'default';
    return 'Format: ' + (m.includes('mp4') ? 'MP4' : 'WebM') + ' • 60 fps • suara game ikut terekam.';
  }
  function startRec() {
    if (!MR.recorder.supported()) return toast('Perekaman tidak didukung browser ini.');
    if (MR.recorder.start(game.canvas, game.settings.quality)) { game.hidePrompt = true; updateRecUI(); }
  }
  async function stopRec(download) {
    const r = await MR.recorder.stop();
    game.hidePrompt = false; updateRecUI();
    if (r) {
      $('#btnDownload').hidden = false;
      $('#recStatus').textContent = `Video siap (${(r.size / 1048576).toFixed(1)} MB, ${r.ext.toUpperCase()}).`;
      if (download) { MR.recorder.download('marble-mania'); toast('Video diunduh ✔'); }
    }
  }
  function updateRecUI() {
    const on = MR.recorder.recording;
    $('#recBadge').hidden = !on;
    $('#btnRecToggle').textContent = on ? '■ Stop & unduh' : '● Rekam manual';
  }
  function toggleFull() {
    const col = $('#stageCol');
    if (document.fullscreenEnabled && !document.fullscreenElement && !col.classList.contains('fake-full')) col.requestFullscreen().catch(() => col.classList.add('fake-full'));
    else if (document.fullscreenElement) document.exitFullscreen();
    else col.classList.toggle('fake-full');
  }
  function onStartClick() {
    const st = game.state;
    if (st === 'ready') game.start();
    else if (st === 'countdown' || st === 'running') { if (MR.recorder.recording) stopRec(false); clearTimeout(autoStopT); rebuild(false); }
    else { rebuild(true); game.start(); }
  }
  function bindControls() {
    $('#btnStart').onclick = onStartClick;
    $('#btnRestart').onclick = () => { if (MR.recorder.recording) stopRec(false); clearTimeout(autoStopT); rebuild(false); };
    $('#btnPause').onclick = () => { game.togglePause(); refreshButtons(); };
    $('#btnSound').onclick = () => { state.settings.sound = !state.settings.sound; $('#chkSound').checked = state.settings.sound; applySettings(); save(); };
    $('#btnFull').onclick = $('#btnFullTop').onclick = toggleFull;
    $('#btnRecToggle').onclick = () => { if (MR.recorder.recording) stopRec(true); else startRec(); };
    $('#btnDownload').onclick = () => MR.recorder.download('marble-mania');
    $('#recStatus').textContent = recFormatLabel();
    $$('.tab').forEach((t) => t.onclick = () => {
      $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
      $$('.pane').forEach((p) => p.classList.toggle('active', p.id === 'pane-' + t.dataset.tab));
    });
    document.addEventListener('keydown', (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === ' ') { e.preventDefault(); onStartClick(); }
      else if (k === 'r') $('#btnRestart').click();
      else if (k === 'f') toggleFull();
      else if (k === 'p') $('#btnPause').click();
      else if (k === 'm') $('#btnSound').click();
    });
    // sembunyikan kontrol saat layar penuh
    const col = $('#stageCol'); let hideT = 0;
    const poke = () => { col.classList.remove('hide-ui'); clearTimeout(hideT); if (document.fullscreenElement || col.classList.contains('fake-full')) hideT = setTimeout(() => col.classList.add('hide-ui'), 2500); };
    ['mousemove', 'touchstart', 'click'].forEach((ev) => col.addEventListener(ev, poke, { passive: true }));
    document.addEventListener('fullscreenchange', poke);
    setInterval(() => { if (MR.recorder.recording) $('#recTime').textContent = MR.fmtTime(MR.recorder.elapsed()); }, 500);
  }

  function bindGame() {
    game.on('state', (st) => {
      refreshButtons();
      if (st === 'countdown' && state.settings.auto && MR.recorder.supported() && !MR.recorder.recording) startRec();
    });
    game.on('finish', (res) => {
      toast('🏆 Pemenang: ' + (res.list[0] ? res.list[0].m.p.name : '-'));
      if (MR.recorder.recording && state.settings.auto) {
        clearTimeout(autoStopT);
        autoStopT = setTimeout(() => stopRec(true), 6500);
      }
    });
    game.on('error', (e) => { toast('Terjadi error: ' + (e && e.message)); });
  }

  async function init() {
    load();
    // muat font tampilan (jika tersedia)
    try {
      await Promise.race([Promise.all([document.fonts.load('700 24px Poppins'), document.fonts.load('400 24px "Lilita One"')]), new Promise((r) => setTimeout(r, 1800))]);
      if (document.fonts.check('400 24px "Lilita One"')) MR.font = { w: 400, f: '"Lilita One"' };
    } catch (e) { /* pakai fallback */ }
    game = MR.game = new MR.Game($('#stage'));
    bindGame(); renderModes(); bindPlayers(); bindLook(); bindControls();
    renderPlayers(); applySettings(); rebuild(true);
    updateRecUI();
  }
  window.addEventListener('DOMContentLoaded', init);
})();
