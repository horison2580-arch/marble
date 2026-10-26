/* Marble Mania - utilitas & tema */
(function () {
  const MR = (window.MR = window.MR || {});
  MR.W = 540; // lebar dunia logis (9:16)
  MR.H = 960;

  MR.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  MR.lerp = (a, b, t) => a + (b - a) * t;
  MR.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  MR.uid = () => Math.random().toString(36).slice(2, 9);
  MR.easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  MR.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  MR.hexToRgb = function (hex) {
    let h = (hex || '#888888').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  MR.rgba = (hex, a) => { const c = MR.hexToRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  // amt: -1 (gelap) .. 1 (terang)
  MR.shade = function (hex, amt) {
    const c = MR.hexToRgb(hex);
    const f = (v) => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
    return `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`;
  };
  MR.fmtTime = (s) => {
    s = Math.max(0, Math.floor(s));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };

  MR.PALETTE = [
    '#ff4757', '#1e90ff', '#2ed573', '#ffa502', '#a55eea', '#ff6b9d', '#00d2d3', '#ffe14d',
    '#7bed9f', '#70a1ff', '#ff7f50', '#e056fd', '#26de81', '#fd9644', '#45aaf2', '#fc5c65',
    '#2bcbba', '#f7b731', '#8854d0', '#eb3b5a', '#4b7bec', '#20bf6b', '#fa8231', '#0fb9b1',
  ];
  MR.NAMES = ['Merah', 'Biru', 'Hijau', 'Oranye', 'Ungu', 'Pink', 'Tosca', 'Kuning', 'Lime', 'Langit',
    'Kilat', 'Badai', 'Roket', 'Macan', 'Elang', 'Naga', 'Hiu', 'Petir', 'Komet', 'Bintang',
    'Sultan', 'Ninja', 'Banteng', 'Kobra', 'Phoenix', 'Raja', 'Bima', 'Gatot', 'Srikandi', 'Arjuna'];

  // Tema visual
  MR.THEMES = {
    neon: {
      name: 'Neon Galaxy', swatch: ['#150a3a', '#ff3df2', '#59f3ff'],
      bg: ['#07041a', '#150a3a', '#32095c'], decor: 'stars', decorColor: '#ffffff',
      wall: '#59f3ff', wallFill: '#120b33', accent: '#ff3df2', accent2: '#3dffb0', peg: '#ffe14d',
      bumper: '#ff3df2', hazard: '#ff3b6b', platform: '#1d1257', platformEdge: '#59f3ff',
    },
    candy: {
      name: 'Permen Pop', swatch: ['#ffb3ec', '#7a5cff', '#ffd23f'],
      bg: ['#ffc2ef', '#c4b2ff', '#8fe3ff'], decor: 'dots', decorColor: '#ffffff',
      wall: '#ffffff', wallFill: '#7a5cff', accent: '#ff4f9a', accent2: '#ffd23f', peg: '#ffffff',
      bumper: '#ff4f9a', hazard: '#ff3b5c', platform: '#8c6bff', platformEdge: '#ffffff',
    },
    lava: {
      name: 'Lava Inferno', swatch: ['#4a0d02', '#ff5a1f', '#ffd23f'],
      bg: ['#160400', '#4a0d02', '#9a2406'], decor: 'embers', decorColor: '#ffb347',
      wall: '#ffb347', wallFill: '#2a0a04', accent: '#ff5a1f', accent2: '#ffd23f', peg: '#ffcf4d',
      bumper: '#ff3b1f', hazard: '#ff2a2a', platform: '#3a1208', platformEdge: '#ffb347',
    },
    ocean: {
      name: 'Samudra Dalam', swatch: ['#003f6b', '#00e0c6', '#ffd166'],
      bg: ['#001a38', '#003f6b', '#00808f'], decor: 'bubbles', decorColor: '#bff6ff',
      wall: '#7ff0ff', wallFill: '#06345a', accent: '#00e0c6', accent2: '#ffd166', peg: '#bff6ff',
      bumper: '#ff7a9c', hazard: '#ff5470', platform: '#0a4a78', platformEdge: '#7ff0ff',
    },
    cyber: {
      name: 'Synthwave', swatch: ['#2a0a4f', '#ff2e88', '#00f0ff'],
      bg: ['#0d0021', '#3a0868', '#c01e78'], decor: 'grid', decorColor: '#ff6ac1',
      wall: '#00f0ff', wallFill: '#190338', accent: '#ff2e88', accent2: '#ffe14d', peg: '#00f0ff',
      bumper: '#ff2e88', hazard: '#ff2e5a', platform: '#240650', platformEdge: '#ff2e88',
    },
  };
})();
