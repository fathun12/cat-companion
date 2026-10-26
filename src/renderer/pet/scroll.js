const fs = require('fs');
const path = require('path');
const S = require('./state');

// Pose scroll: kucing menarik gulungan tisu. Aset ada di assets/cat/scroll/.
// Urutan tumpuk dari bawah: tisu, ekor, badan, tangan, kaki, lalu kepala (kuping, kepala, kumis, mata, pupil).
// Kalau ada bagian yang tertutup atau terbalik, ubah urutan penyusunan di buildScroll().

const DIR = path.join(__dirname, '..', '..', '..', 'assets', 'cat', 'scroll');
const pct = (v) => v * 100 + '%';

const mkImg = (file) => {
  const img = new Image();
  img.className = 'layer';
  img.draggable = false;
  if (file) img.src = S.BASE + 'cat/scroll/' + file;
  return img;
};

const mkDiv = (parent) => {
  const d = document.createElement('div');
  d.className = 'group';
  parent.appendChild(d);
  return d;
};

const spring = (pos, vel, target, k, c, sec) => {
  vel += ((target - pos) * k - vel * c) * sec;
  return [pos + vel * sec, vel];
};

let A = null;
const kick = [0, 0]; // 0 = tangan kiri, 1 = tangan kanan
const kickV = [0, 0];
let seenTick = 0;
let wagPhase = 0;
let stripLen = 0;

// Cari kotak pembatas gulungan di tisu.png, untuk menentukan asal kertas tisu
function measureRoll() {
  const img = new Image();
  img.onload = () => {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, w, h).data;
    let minX = w, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return;
    const sw = Math.max(2, Math.round((maxX - minX + 1) * 0.6));
    A.roll = {
      size: h,
      left: Math.round((minX + maxX + 1) / 2 - sw / 2),
      top: maxY + 1,
      w: sw,
    };
  };
  const file = path.join(DIR, 'tisu.png');
  img.src = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
}

function buildScroll() {
  A = { img: {}, roll: null };
  S.scr = A;

  A.box = mkDiv(S.stage);
  A.box.style.display = 'none';
  A.box.style.transform = `translateY(${S.SCROLL_SHIFT_Y * S.SCALE}px)`;

  // Kertas tisu (digambar lewat kode), paling bawah
  A.strip = document.createElement('div');
  A.strip.style.cssText =
    'position:absolute;display:none;background:#fff;box-sizing:border-box;pointer-events:none;' +
    `border:${S.SCALE}px solid #333;border-top:none;`;
  A.box.appendChild(A.strip);

  A.img.tisu = mkImg('tisu.png');
  A.box.appendChild(A.img.tisu);

  A.tailBox = mkDiv(A.box);
  const [px, py] = S.rig.pivots.ekor;
  A.tailBox.style.transformOrigin = pct(px) + ' ' + pct(py);
  A.img.ekor = mkImg();
  A.tailBox.appendChild(A.img.ekor);

  for (const id of ['badan', 'tangan_kanan', 'tangan_kiri', 'kaki_kanan', 'kaki_kiri']) {
    A.img[id] = mkImg();
    A.box.appendChild(A.img[id]);
  }

  A.headBox = mkDiv(A.box);
  A.headBox.style.transformOrigin = '50% 45%';
  for (const id of ['kuping', 'kepala']) {
    A.img[id] = mkImg();
    A.headBox.appendChild(A.img[id]);
  }
  for (const id of ['kumis', 'mata', 'pupil']) {
    A.img[id] = mkImg(id + '.png'); // tidak diwarnai ulang
    A.headBox.appendChild(A.img[id]);
  }

  measureRoll();
}

// Dipanggil dari rig.js setiap warna atau pola berubah
function applyLook(urls) {
  A.img.ekor.src = urls.s_ekor;
  A.img.badan.src = urls.s_badan;
  A.img.tangan_kiri.src = urls.s_tangan_kiri;
  A.img.tangan_kanan.src = urls.s_tangan_kanan;
  A.img.kaki_kiri.src = urls.s_kaki_kiri;
  A.img.kaki_kanan.src = urls.s_kaki_kanan;
  A.img.kuping.src = urls.s_kuping;
  A.img.kepala.src = urls.s_kepala;
}

function update(t, dt, active, breath) {
  if (!A) return;
  A.box.style.display = active ? '' : 'none';
  if (!active) {
    stripLen = 0;
    return;
  }
  const sec = Math.min(dt, 50) / 1000;
  const SC = S.SCALE;

  // Setiap event scroll: satu tangan menarik, bergantian kiri dan kanan
  if (S.scrollTick !== seenTick) {
    seenTick = S.scrollTick;
    kickV[S.scrollFrame] += 26;
    stripLen = Math.min(S.STRIP_MAX, stripLen + S.STRIP_STEP);
  }
  for (let i = 0; i < 2; i++) {
    [kick[i], kickV[i]] = spring(kick[i], kickV[i], 0, 260, 14, sec);
    kick[i] = Math.min(kick[i], 2);
  }
  const off = (v) => Math.max(0, Math.min(2, Math.round(v))) * SC;
  A.img.tangan_kiri.style.transform = `translateY(${off(kick[0])}px)`;
  A.img.tangan_kanan.style.transform = `translateY(${off(kick[1])}px)`;

  const peak = Math.max(0, Math.round(Math.max(kick[0], kick[1])));
  A.img.tisu.style.transform = `translateX(${Math.min(1, peak) * SC}px)`;
  A.headBox.style.transform = `translateY(${Math.min(2, breath + peak) * SC}px)`;

  // Ekor berkibas, bertahap per 5 derajat
  wagPhase += ((dt / 1000) * 2 * Math.PI) / 0.8;
  const wag = Math.round((Math.sin(wagPhase) * 10) / 5) * 5;
  A.tailBox.style.transform = `rotate(${wag}deg)`;

  // Kertas tisu: memanjang saat scroll, memendek pelan saat berhenti
  stripLen = Math.max(0, stripLen - dt * 0.003);
  const R = A.roll;
  const len = R ? Math.min(Math.round(stripLen), R.size - R.top - 1) : 0;
  const st = A.strip.style;
  if (S.TISSUE_STRIP && R && len >= 1) {
    st.display = '';
    st.left = R.left * SC + 'px';
    st.top = R.top * SC + 'px';
    st.width = R.w * SC + 'px';
    st.height = len * SC + 'px';
  } else {
    st.display = 'none';
  }
}

module.exports = { buildScroll, applyLook, update };