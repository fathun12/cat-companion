const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');
const S = require('./state');
const Look = require('./look.js');

const pct = (v) => v * 100 + '%';

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.className = 'layer';
    img.draggable = false;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat ' + src));
    img.src = src;
  });
}

const mkImg = () => {
  const img = new Image();
  img.className = 'layer';
  img.draggable = false;
  return img;
};

const mkDiv = (parent) => {
  const d = document.createElement('div');
  d.className = 'group';
  parent.appendChild(d);
  return d;
};

// Pose mengetik: 3 set (click1, click2, lelah).
// Tiap set = papan ketik (diam) + kucing (turun/miring) + ekor (berkibas).
// Kucing dan ekor punya versi merah; seberapa merah diatur lewat opacity di animate.js.
function buildTyping() {
  const shift = S.TYPE_SHIFT_Y * S.SCALE + 'px';
  for (let i = 0; i < 3; i++) {
    const box = mkDiv(S.stage);
    box.style.display = 'none';
    box.style.transform = `translateY(${shift})`;
    const kb = mkImg();
    box.appendChild(kb);
    const lean = mkDiv(box);
    lean.style.transformOrigin = pct(S.TFEET_X) + ' ' + pct(S.TFEET_Y);
    const tailBox = mkDiv(lean);
    tailBox.style.transformOrigin = pct(S.TAIL_PIVOT[0]) + ' ' + pct(S.TAIL_PIVOT[1]);
    const tail = mkImg();
    const tailH = mkImg();
    tailH.style.opacity = '0';
    tailBox.append(tail, tailH);
    const cat = mkImg();
    const catH = mkImg();
    catH.style.opacity = '0';
    lean.append(cat, catH);
    const set = { box, kb, lean, tailBox, tail, tailH, cat, catH, eyes: null };
    if (i === 2) {
      set.eyes = mkImg();
      set.eyes.style.transform = `translate(${S.TIRED_DX * S.SCALE}px, ${S.TIRED_DY * S.SCALE}px)`;
      lean.appendChild(set.eyes);
    }
    S.typing.push(set);
  }
  // Gelembung frustrasi (digambar di kanvas yang sama dengan pose click)
  for (const f of ['effects/gelembung2.png', 'effects/gelembung4.png']) {
    const img = mkImg();
    img.src = S.BASE + f;
    img.style.display = 'none';
    img.style.transform = `translateY(${shift})`;
    S.stage.appendChild(img);
    S.angryImgs.push(img);
  }
}

async function buildRig() {
  S.rig = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', '..', '..', 'assets', 'cat', 'rig.json'), 'utf8')
  );
  S.stage = document.getElementById('stage');
  S.hud = document.getElementById('hud');

  const imgs = await Promise.all(S.rig.layers.map((l) => loadImg(S.BASE + 'cat/' + l.file)));

  // Ukuran dibaca otomatis dari gambar, skala bilangan bulat
  const size = imgs[0].naturalWidth;
  S.SCALE = Math.max(1, Math.floor(190 / size));
  const px = size * S.SCALE;
  S.stage.style.width = px + 'px';
  S.stage.style.height = px + 'px';
  S.stage.style.left = (S.WIN - px) / 2 + 'px';
  S.stage.style.top = (S.WIN - px) / 2 + 'px';
  S.stage.style.transformOrigin = '50% 25%';

  S.rig.layers.forEach((l, i) => {
    if (!S.groups[l.group]) {
      const g = document.createElement('div');
      g.className = 'group';
      S.stage.appendChild(g);
      S.groups[l.group] = g;
    }
    S.groups[l.group].appendChild(imgs[i]);
    S.parts[l.id] = imgs[i];
  });

  for (const id in S.rig.pivots) {
    const [x, y] = S.rig.pivots[id];
    if (S.parts[id]) S.parts[id].style.transformOrigin = pct(x) + ' ' + pct(y);
  }
  S.groups.head.style.transformOrigin = '50% 45%'; // kepala miring dari area leher
  S.groups.body.style.transformOrigin = pct(S.FEET_X) + ' ' + pct(S.FEET_Y); // badan miring dari kaki

  S.bubble = await loadImg(S.BASE + S.rig.effects.gelembung);
  S.bubble.classList.add('bubble');
  S.bubble.style.transformOrigin =
    pct(S.rig.pivots.gelembung[0]) + ' ' + pct(S.rig.pivots.gelembung[1]);
  S.bubble.style.display = 'none';
  S.stage.appendChild(S.bubble);

  buildTyping();
}

async function applyLook(look) {
  const urls = await Look.recolorAll(look);
  for (const id in urls) S.parts[id].src = urls[id];

  // Pose mengetik ikut warna dan pola yang sama
  const ty = await Look.recolorTyping(look);
  ty.sets.forEach((u, i) => {
    const s = S.typing[i];
    s.kb.src = u.kb;
    s.cat.src = u.cat;
    s.catH.src = u.catH;
    s.tail.src = u.tail;
    s.tailH.src = u.tailH;
  });
  S.typing[2].eyes.src = ty.eyes;
}

// Terapkan tampilan tersimpan, lalu dengarkan perubahan dari panel kustomisasi
async function initLook() {
  const saved = await ipcRenderer.invoke('look-get');
  await applyLook(saved || Look.PRESETS.hitam);
  ipcRenderer.on('look', (event, look) => applyLook(look));
}

module.exports = { buildRig, initLook };