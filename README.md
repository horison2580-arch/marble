# 🔮 Marble Mania

Pembuat video **marble race vertikal 9:16** untuk YouTube Shorts / TikTok / Reels.
Situs statis murni (HTML + CSS + JS), **tanpa build step, tanpa dependency** — langsung deploy ke Vercel.

## Fitur
- **5 mode game**: 🏁 Balapan Gravitasi · 💀 Race Eliminasi · 🎰 Plinko Jackpot · 🥊 Sumo Ring · ⚔️ Battle Arena
- **1–100 pemain**, nama / warna / **gambar (foto) bisa diganti**, tempel daftar nama sekaligus
- Trek & arena **acak tiap main** (tidak monoton), bisa diulang dengan layout yang sama
- 5 tema visual (Neon Galaxy, Permen Pop, Lava Inferno, Samudra Dalam, Synthwave)
- Judul & teks ajakan bisa diubah, efek suara sintetis, slow-mo finis, konfeti, layar pemenang + podium
- **Perekam video bawaan** (canvas 1080×1920, 60 fps + audio) → otomatis terunduh setelah pemenang muncul
- Mode layar penuh untuk screen-record, panduan area aman Shorts
- Pengaturan pemain & tampilan tersimpan di browser (localStorage)

## Jalankan lokal
```bash
# cukup server statis apa saja, contoh:
python3 -m http.server 3000
# atau
npx serve .
```
Buka http://localhost:3000

## Deploy: GitHub + Vercel
1. Buat repo baru di GitHub, lalu dari folder ini:
   ```bash
   git init
   git add .
   git commit -m "Marble Mania"
   git branch -M main
   git remote add origin https://github.com/USERNAME/marble-mania.git
   git push -u origin main
   ```
2. Buka https://vercel.com/new → **Import** repo tadi.
3. Biarkan semua default (Framework Preset: **Other**, tanpa Build Command, tanpa Output Directory) → **Deploy**.

Selesai. Setiap `git push` akan otomatis ter-deploy ulang.

## Pintasan keyboard
`Spasi` mulai / main lagi · `R` reset · `F` layar penuh · `P` jeda · `M` suara

## Alur membuat Shorts
1. Isi pemain + gambar, pilih mode & tema, ubah judul.
2. Tab **Rekam** → biarkan *Rekam otomatis* aktif.
3. Tekan **MULAI**. Setelah pemenang tampil video akan terunduh (MP4 atau WebM tergantung browser).
4. Upload ke YouTube (vertikal & ≤ 60 detik = Shorts). Gunakan Chrome/Edge desktop untuk hasil perekaman terbaik.

## Struktur
```
index.html          halaman utama
css/style.css       tampilan
js/utils.js         util + tema
js/physics.js       mesin fisika (lingkaran, kapsul, cincin)
js/audio.js         efek suara WebAudio
js/game.js          loop, renderer, HUD, hasil
js/mode-race.js     Balapan & Race Eliminasi
js/mode-arena.js    Plinko, Sumo, Battle
js/recorder.js      MediaRecorder dari canvas
js/app.js           UI & penyimpanan
fonts/              Poppins (SIL OFL) — judul memakai Lilita One dari Google Fonts bila online
```

## Menambah mode sendiri
Buat file JS baru, panggil `MR.registerMode({ id, name, icon, desc, options, setup, start, step, frame, finish, camTarget, drawWorld, drawOver, drawHUD })`
(lihat `mode-arena.js` sebagai contoh), lalu tambahkan `<script>` di `index.html`.
