const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', '..', '..', 'assets');

// Layer yang diwarnai ulang dan lokasi filenya
const SRC = {
  badan: 'cat/body/badan.png',
  kepala: 'cat/parts/kepala.png',
  kuping: 'cat/parts/kuping.png',
  ekor: 'cat/parts/ekor.png',
  tangan: 'cat/parts/tangan.png',
};
const RECOLOR = Object.keys(SRC);

// Titik tengah pola, relatif terhadap kotak pembatas tiap layer (0 kiri, 1 kanan).
// Kepala dan badan dihitung sendiri-sendiri. Untuk geser manual: kecilkan = ke kiri.
const CX_HEAD = 0.5;
const CX_BODY = 0.5;

const PRESETS = {
  hitam:  { body: '#000000', outline: '#ffffff', p1: '#ffffff', p2: '#888888', pattern: 'polos' },
  oren:   { body: '#e8832a', outline: '#ffffff', p1: '#b85d14', p2: '#ffffff', pattern: 'belang' },
  abu:    { body: '#7d8590', outline: '#ffffff', p1: '#5a616b', p2: '#ffffff', pattern: 'belang' },
  tuxedo: { body: '#1b1b1b', outline: '#ffffff', p1: '#ffffff', p2: '#ffffff', pattern: 'tuxedo' },
  calico: { body: '#f4ede4', outline: '#3b2f2f', p1: '#e8832a', p2: '#2b2b2b', pattern: 'calico' },
};

function hash(a, b) {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// Setiap pola mengembalikan: 0 = warna badan, 1 = warna pola, 2 = warna pola 2
const PATTERNS = {
  polos: () => 0,
  belang: (id, x, y, w, h) => {
    if (id === 'tangan') return 0;
    if (id === 'ekor') return (x + y) % 8 < 3 ? 1 : 0;
    if (id === 'kepala') return y / h < 0.2 && x % 6 < 2 ? 1 : 0;
    return x % 6 < 2 ? 1 : 0;
  },
  tuxedo: (id, x, y, w, h) => {
    const u = x / w;
    const v = y / h;
    if (id === 'tangan') return 1;
    if (id === 'ekor') return u > 0.75 ? 1 : 0;
    if (id === 'badan') return ((u - CX_BODY) / 0.4) ** 2 + ((v - 0.62) / 0.5) ** 2 < 1 ? 1 : 0;
    if (id === 'kepala') return Math.abs(u - CX_HEAD) < 0.1 && v > 0.3 ? 1 : 0;
    return 0;
  },
  calico: (id, x, y) => {
    if (id === 'tangan') return 0;
    const k = hash(Math.floor(x / 7), Math.floor(y / 7));
    return k < 0.3 ? 1 : k < 0.5 ? 2 : 0;
  },
};

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const dataUrl = (rel) =>
  'data:image/png;base64,' + fs.readFileSync(path.join(ASSETS, rel)).toString('base64');

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat gambar'));
    img.src = src;
  });
}

const sources = {};
async function getSource(id) {
  if (sources[id]) return sources[id];
  const img = await loadImage(dataUrl(SRC[id]));
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);

  // Kotak pembatas piksel yang terisi (untuk titik tengah tiap layer)
  let minX = c.width, maxX = 0, minY = c.height, maxY = 0;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data.data[(y * c.width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  data.bb = { minX, minY, w: Math.max(1, maxX - minX + 1), h: Math.max(1, maxY - minY + 1) };

  sources[id] = data;
  return data;
}

// Mengembalikan { badan: dataURL, kepala: dataURL, ... } yang sudah diwarnai
async function recolorAll(look) {
  const body = hex(look.body);
  const outline = hex(look.outline);
  const cols = [body, hex(look.p1), hex(look.p2)];
  const fn = PATTERNS[look.pattern] || PATTERNS.polos;
  const out = {};

  for (const id of RECOLOR) {
    const src = await getSource(id);
    const w = src.width;
    const h = src.height;
    const bb = src.bb;
    const img = new ImageData(new Uint8ClampedArray(src.data), w, h);
    const d = img.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] === 0) continue;
        const L = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
        let c;
        if (L < 40) c = cols[fn(id, x - bb.minX, y - bb.minY, bb.w, bb.h)];
        else if (L > 215) c = outline;
        else c = body.map((v, k) => v + (outline[k] - v) * (L / 255));
        d[i] = c[0];
        d[i + 1] = c[1];
        d[i + 2] = c[2];
      }
    }

    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    cv.getContext('2d').putImageData(img, 0, 0);
    out[id] = cv.toDataURL();
  }
  return out;
}

// Gambar kucing utuh (untuk pratinjau di panel)
async function composite(look) {
  const rig = JSON.parse(fs.readFileSync(path.join(ASSETS, 'cat', 'rig.json'), 'utf8'));
  const urls = await recolorAll(look);
  const layers = rig.layers.filter((l) => l.id !== 'mata_tidur');
  const imgs = await Promise.all(
    layers.map((l) => loadImage(RECOLOR.includes(l.id) ? urls[l.id] : dataUrl('cat/' + l.file)))
  );
  const c = document.createElement('canvas');
  c.width = imgs[0].naturalWidth;
  c.height = imgs[0].naturalHeight;
  const ctx = c.getContext('2d');
  imgs.forEach((img) => ctx.drawImage(img, 0, 0));
  return c;
}

module.exports = { PRESETS, recolorAll, composite };