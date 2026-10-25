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

  // Pose mengetik, gelembung frustrasi, mata lelah (disembunyikan dulu)
  const load = async (files) => {
    const list = await Promise.all(files.map((f) => loadImg(S.BASE + f)));
    list.forEach((img) => (img.style.display = 'none'));
    return list;
  };
  S.typeImgs = await load(['cat/typing/click1.png', 'cat/typing/click2.png']);
  S.angryImgs = await load(['effects/gelembung2.png', 'effects/gelembung4.png']);
  [S.eyeTired] = await load(['cat/eyes/mata_tertutup2.png']);
  S.typeImgs.forEach((img) => S.stage.appendChild(img));
  S.angryImgs.forEach((img) => S.stage.appendChild(img));
  S.groups.head.appendChild(S.eyeTired);
}

async function applyLook(look) {
  const urls = await Look.recolorAll(look);
  for (const id in urls) S.parts[id].src = urls[id];
}

// Terapkan tampilan tersimpan, lalu dengarkan perubahan dari panel kustomisasi
async function initLook() {
  const saved = await ipcRenderer.invoke('look-get');
  await applyLook(saved || Look.PRESETS.hitam);
  ipcRenderer.on('look', (event, look) => applyLook(look));
}

module.exports = { buildRig, initLook };