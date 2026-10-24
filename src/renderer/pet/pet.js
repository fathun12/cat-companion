const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');

const BASE = '../../../assets/';
const rig = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', '..', 'assets', 'cat', 'rig.json'), 'utf8')
);

const stage = document.getElementById('stage');
const parts = {};
const groups = {};
let SCALE = 2;
let sleeping = false;
let bubble = null;
let lastActivity = performance.now();
let lastKey = -10000;
let keyPulseEnd = 0;
const SLEEP_AFTER_MS = 10 * 1000; // TES: 10 detik
const LOVE_START_UP = 0.42; // makin besar, hati muncul makin tinggi

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

const rand = (a, b) => a + Math.random() * (b - a);
const pct = (v) => v * 100 + '%';

async function init() {
  const imgs = await Promise.all(rig.layers.map((l) => loadImg(BASE + 'cat/' + l.file)));

  // Ukuran dibaca otomatis dari gambar, skala bilangan bulat
  const size = imgs[0].naturalWidth;
  SCALE = Math.max(1, Math.floor(190 / size));
  const px = size * SCALE;
  stage.style.width = px + 'px';
  stage.style.height = px + 'px';
  stage.style.left = (200 - px) / 2 + 'px';
  stage.style.top = (200 - px) / 2 + 'px';

  rig.layers.forEach((l, i) => {
    if (!groups[l.group]) {
      const g = document.createElement('div');
      g.className = 'group';
      stage.appendChild(g);
      groups[l.group] = g;
    }
    groups[l.group].appendChild(imgs[i]);
    parts[l.id] = imgs[i];
  });

  for (const id in rig.pivots) {
    const [x, y] = rig.pivots[id];
    if (parts[id]) parts[id].style.transformOrigin = pct(x) + ' ' + pct(y);
  }

  bubble = await loadImg(BASE + rig.effects.gelembung);
  bubble.classList.add('bubble');
  bubble.style.transformOrigin = pct(rig.pivots.gelembung[0]) + ' ' + pct(rig.pivots.gelembung[1]);
  bubble.style.display = 'none';
  stage.appendChild(bubble);

  // Hanya tangkap klik saat kursor di atas kucing
  stage.addEventListener('mouseenter', () => ipcRenderer.send('set-ignore-mouse', false));
  stage.addEventListener('mouseleave', () => ipcRenderer.send('set-ignore-mouse', true));

  // Klik kucing: keluarkan hati
  stage.addEventListener('click', () => {
    if (!sleeping) spawnLove();
  });

  // Aktivitas dari luar (dibaca di main.js, tanpa isi ketikan)
  ipcRenderer.on('activity', (event, type) => {
    const now = performance.now();
    lastActivity = now;
    if (type !== 'mouse' && sleeping) setSleep(false); // gerak mouse saja tidak membangunkan
    if (type === 'key') {
      lastKey = now;
      keyPulseEnd = now + 90;
    }
  });

  requestAnimationFrame(frame);
}

function setSleep(value) {
  sleeping = value;
  bubble.style.display = sleeping ? '' : 'none';
}

function spawnLove() {
  const heart = new Image();
  heart.src = BASE + rig.effects.love;
  heart.className = 'layer effect';
  stage.appendChild(heart);
  const dx = Math.round(rand(-3, 3)) * SCALE;
  const startY = -Math.round(stage.offsetHeight * LOVE_START_UP);
  heart
    .animate(
      [
        { transform: `translate(0px, ${startY}px)`, opacity: 1 },
        { transform: `translate(${dx}px, ${startY - 3 * SCALE}px)`, opacity: 0 },
      ],
      { duration: 1500, easing: 'steps(8)' }
    )
    .addEventListener('finish', () => heart.remove());
}

// Jadwal kejadian acak
let nextBlink = 2000, blinkEnd = 0;
let nextEar = 4000, earEnd = 0, earAngle = -4;
let nextLook = 3000, lookX = 0;

function frame(t) {
  const s = t / 1000;

  // Napas: kepala turun 1 piksel, bergantian
  const breathPeriod = sleeping ? 4.5 : 3.2;
  const breath = Math.round((Math.sin((s * 2 * Math.PI) / breathPeriod) + 1) / 2);
  groups.head.style.transform = `translate(0px, ${breath * SCALE}px)`;

  // Ekor goyang, bertahap per 5 derajat supaya terasa pixel art
  const amp = sleeping ? 5 : 10;
  const tail = Math.round((Math.sin((s * 2 * Math.PI) / 2.6) * amp) / 5) * 5;
  parts.ekor.style.transform = `rotate(${tail}deg)`;

  // Kuping berkedut sesekali
  if (t >= nextEar) {
    earEnd = t + 180;
    earAngle = Math.random() < 0.5 ? -4 : 4;
    nextEar = t + rand(4000, 9000);
  }
  parts.kuping.style.transform = `rotate(${t < earEnd ? earAngle : 0}deg)`;

  // Kedip
  if (t >= nextBlink) {
    blinkEnd = t + 160;
    nextBlink = t + rand(2500, 6000);
  }
  const closed = sleeping || t < blinkEnd;
  parts.mata.style.display = closed ? 'none' : '';
  parts.pupil.style.display = closed ? 'none' : '';
  parts.mata_tidur.style.display = closed ? '' : 'none';

  // Pupil melirik kiri/kanan; saat mengetik melihat ke bawah
  if (t >= nextLook) {
    lookX = Math.floor(rand(-1, 2));
    nextLook = t + rand(2000, 5000);
  }
  const typing = !sleeping && t - lastKey < 1500;
  parts.pupil.style.transform = `translate(${lookX * SCALE}px, ${typing ? SCALE : 0}px)`;

  // Tangan menekan keyboard setiap ada ketikan
  parts.tangan.style.transform = `translate(0px, ${t < keyPulseEnd ? SCALE : 0}px)`;

  // Tidur kalau lama tidak ada aktivitas
  if (!sleeping && t - lastActivity > SLEEP_AFTER_MS) setSleep(true);

  requestAnimationFrame(frame);
}

init().catch((err) => {
  document.body.insertAdjacentHTML(
    'beforeend',
    '<pre style="color:red;background:#fff;font-size:11px">' + err.message + '</pre>'
  );
});