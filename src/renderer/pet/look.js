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

// ===== Pose mengetik (click1.png, click2.png) =====
const TYPING_FILES = ['cat/typing/click1.png', 'cat/typing/click2.png'];
const EYES_CLOSED = 'cat/eyes/mata_tertutup2.png';

// Pembagian bagian di gambar click (koordinat piksel, kanvas 48x48)
const isTail = (x, y) => y <= 21 && x >= (y <= 16 ? 36 : 40);
// Layer ekor ikut membawa 2 baris badan di bawahnya supaya tidak bolong saat berkibas
const tailLayer = (x, y) => isTail(x, y) || (y >= 22 && y <= 23 && x >= 40);
const isHead = (x, y) => y <= 24 && x <= 35 && !isTail(x, y);
const lum = (d, i) => d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;

// Mata = bagian hitam kecil di kepala + cincin putih di sekelilingnya (tidak diwarnai)
function findEyes(d, w, h) {
  const keep = new Uint8Array(w * h);
  const seen = new Uint8Array(w * h);
  const black = (p) => d[p * 4 + 3] > 0 && lum(d, p * 4) < 40;
  const white = (p) => d[p * 4 + 3] > 0 && lum(d, p * 4) > 215;
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || !black(s)) continue;
    const comp = [s];
    seen[s] = 1;
    for (let k = 0; k < comp.length; k++) {
      const x = comp[k] % w;
      const y = (comp[k] / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (!seen[n] && black(n)) {
          seen[n] = 1;
          comp.push(n);
        }
      }
    }
    if (comp.length >= 30 || !comp.every((p) => isHead(p % w, (p / w) | 0))) continue;
    for (const p of comp) {
      keep[p] = 1;
      const x = p % w;
      const y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && white(ny * w + nx)) keep[ny * w + nx] = 1;
        }
      }
    }
  }
  return keep;
}

// Mengembalikan { sets: [click1, click2, lelah], eyes } berisi dataURL.
// Tiap set: kb (papan ketik), cat, catH (merah), tail, tailH (merah)
async function recolorTyping(look) {
  const body = hex(look.body);
  const outline = hex(look.outline);
  const cols = [body, hex(look.p1), hex(look.p2)];
  const fn = PATTERNS[look.pattern] || PATTERNS.polos;
  const warm = (c) => c.map((v, k) => Math.round(v + ([235, 45, 45][k] - v) * 0.55));
  const url = (img) => {
    const cv = document.createElement('canvas');
    cv.width = img.width;
    cv.height = img.height;
    cv.getContext('2d').putImageData(img, 0, 0);
    return cv.toDataURL();
  };
  const idOf = (x, y) => (isTail(x, y) ? 'ekor' : isHead(x, y) ? 'kepala' : 'badan');
  const frames = [];

  for (const file of TYPING_FILES) {
    const im = await loadImage(dataUrl(file));
    const w = im.naturalWidth;
    const h = im.naturalHeight;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.drawImage(im, 0, 0);
    const d = ctx.getImageData(0, 0, w, h).data;
    const keep = findEyes(d, w, h);

    // Kotak pembatas tiap bagian (untuk pola)
    const bb = {};
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] === 0) continue;
        const L = lum(d, i);
        if (L >= 40 && L <= 215) continue;
        const id = idOf(x, y);
        const b = bb[id] || (bb[id] = { x0: x, x1: x, y0: y, y1: y });
        b.x0 = Math.min(b.x0, x);
        b.x1 = Math.max(b.x1, x);
        b.y0 = Math.min(b.y0, y);
        b.y1 = Math.max(b.y1, y);
      }
    }

    const o = {};
    for (const k of ['kb', 'cat', 'catH', 'tail', 'tailH', 'tired', 'tiredH']) o[k] = new ImageData(w, h);
    const put = (buf, i, c) => {
      buf.data[i] = c[0];
      buf.data[i + 1] = c[1];
      buf.data[i + 2] = c[2];
      buf.data[i + 3] = 255;
    };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        const i = p * 4;
        if (d[i + 3] === 0) continue;
        const L = lum(d, i);
        const orig = [d[i], d[i + 1], d[i + 2]];
        if (L >= 40 && L <= 215) {
          put(o.kb, i, orig); // papan ketik: tidak diwarnai
          continue;
        }
        const id = idOf(x, y);
        const b = bb[id];
        const face = cols[fn(id, x - b.x0, y - b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1)];
        const whisker = L < 40 && x <= 5; // kumis di luar wajah tetap hitam
        let c = orig;
        let ch = orig;
        let ct = orig; // versi lelah
        let cth = orig;
        if (keep[p]) {
          ct = face; // mata dihapus (jadi warna wajah), nanti ditimpa mata tertutup
          cth = warm(face);
        } else if (!whisker) {
          c = L < 40 ? face : outline;
          ch = warm(c);
          ct = c;
          cth = ch;
        }
        if (!isTail(x, y)) {
          put(o.cat, i, c);
          put(o.catH, i, ch);
          put(o.tired, i, ct);
          put(o.tiredH, i, cth);
        }
        if (tailLayer(x, y)) {
          put(o.tail, i, c);
          put(o.tailH, i, ch);
        }
      }
    }
    frames.push(o);
  }

  const mk = (o) => ({ kb: url(o.kb), cat: url(o.cat), catH: url(o.catH), tail: url(o.tail), tailH: url(o.tailH) });
  const f0 = frames[0];
  const sets = [
    mk(frames[0]),
    mk(frames[1]),
    { ...mk(f0), cat: url(f0.tired), catH: url(f0.tiredH) }, // pose lelah = click1 tanpa mata
  ];

  // Mata tertutup: semua piksel putih diganti warna garis tepi
  const em = await loadImage(dataUrl(EYES_CLOSED));
  const ec = document.createElement('canvas');
  ec.width = em.naturalWidth;
  ec.height = em.naturalHeight;
  const ectx = ec.getContext('2d');
  ectx.drawImage(em, 0, 0);
  const ed = ectx.getImageData(0, 0, ec.width, ec.height);
  for (let i = 0; i < ed.data.length; i += 4) {
    if (ed.data[i + 3] === 0) continue;
    ed.data[i] = outline[0];
    ed.data[i + 1] = outline[1];
    ed.data[i + 2] = outline[2];
    ed.data[i + 3] = 255;
  }
  return { sets, eyes: url(ed) };
}

module.exports = { PRESETS, recolorAll, recolorTyping, composite };