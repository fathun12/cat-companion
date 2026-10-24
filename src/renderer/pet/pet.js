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
const SLEEP_AFTER_MS = 10 * 1000; // diam 10 detik -> tidur
const LOVE_START_UP = 0.42; // makin besar, hati muncul makin tinggi
const SLEEP_HEAD_DROP = 0.14; // kepala turun saat tidur (pecahan tinggi kucing)
let sleepAmt = 0; // 0 = bangun, 1 = tidur melingkar
let prevT = 0;

const WIN = 260; // harus sama dengan WIN di main.js
let cursorX = 0, cursorY = 0, lastCursorMove = -10000;
let hovering = false, lastHoverMove = -10000;
let petTime = 0, purring = false, lastPurrHeart = 0;
let dragging = false, dragMoved = false, dragSX = 0, dragSY = 0, lastSX = 0, dragVx = 0;
let mochi = 0, mochiV = 0, tilt = 0, tiltV = 0;

// Kepala/badan mengikuti kursor (pegas)
const FOLLOW_HEAD = 3; // seberapa jauh kepala condong (satuan piksel gambar)
const FOLLOW_BODY = 1; // seberapa jauh badan ikut
let fx = 0, fvx = 0, fy = 0, fvy = 0, bx = 0, bvx = 0;

// Teks di atas kucing (timer dan pengingat)
const hud = document.getElementById('hud');
let statusText = '', sayText = '', sayUntil = 0, stretchUntil = 0;
function updateHud() {
  const text = performance.now() < sayUntil ? sayText : statusText;
  hud.textContent = text;
  hud.style.display = text ? 'block' : 'none';
}

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
  stage.style.left = (WIN - px) / 2 + 'px';
  stage.style.top = (WIN - px) / 2 + 'px';
  stage.style.transformOrigin = '50% 25%';

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
  groups.head.style.transformOrigin = '50% 45%'; // kepala miring dari area leher

  bubble = await loadImg(BASE + rig.effects.gelembung);
  bubble.classList.add('bubble');
  bubble.style.transformOrigin = pct(rig.pivots.gelembung[0]) + ' ' + pct(rig.pivots.gelembung[1]);
  bubble.style.display = 'none';
  stage.appendChild(bubble);

  // Hanya tangkap klik saat kursor di atas kucing
  stage.addEventListener('mouseenter', () => {
    hovering = true;
    ipcRenderer.send('set-ignore-mouse', false);
  });
  stage.addEventListener('mouseleave', () => {
    hovering = false;
    if (!dragging) ipcRenderer.send('set-ignore-mouse', true);
  });
  stage.addEventListener('mousemove', () => {
    lastHoverMove = performance.now();
    lastActivity = lastHoverMove;
  });

  // Klik kucing (bukan drag): keluarkan hati
  stage.addEventListener('click', () => {
    if (!sleeping && !dragMoved) spawnLove();
  });

  // Drag kucing
  stage.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    dragMoved = false;
    dragSX = lastSX = e.screenX;
    dragSY = e.screenY;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    if (!dragMoved) {
      if (Math.hypot(e.screenX - dragSX, e.screenY - dragSY) < 5) return;
      dragMoved = true;
      lastActivity = performance.now();
      if (sleeping) setSleep(false);
      ipcRenderer.send('drag-start');
    }
    dragVx = e.screenX - lastSX;
    lastSX = e.screenX;
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    if (dragMoved) {
      ipcRenderer.send('drag-end');
      if (!hovering) ipcRenderer.send('set-ignore-mouse', true);
    }
  });

  // Posisi kursor dari main.js
  ipcRenderer.on('cursor', (event, x, y) => {
    cursorX = x;
    cursorY = y;
    lastCursorMove = performance.now();
  });

  // Klik kanan: menu Pomodoro dan pengingat
  stage.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    ipcRenderer.send('show-menu');
  });

  // Teks timer Pomodoro dari main.js
  ipcRenderer.on('status', (event, text) => {
    statusText = text;
    updateHud();
  });

  // Pengingat dari main.js: kucing bangun dan beraksi
  ipcRenderer.on('say', (event, text, kind) => {
    const now = performance.now();
    sayText = text;
    sayUntil = now + 7000;
    updateHud();
    setTimeout(updateHud, 7100);
    lastActivity = now;
    if (sleeping) setSleep(false);
    if (kind === 'stretch') stretchUntil = now + 4000; // kucing meregang
    else mochiV += 2.5; // kucing melonjak kecil
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
    if (type === 'scroll') keyPulseEnd = now + 110;
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

  // Transisi tidur: kepala turun ke badan, bergerak per piksel
  const dt = Math.min(t - prevT, 100);
  prevT = t;
  const target = sleeping ? 1 : 0;
  sleepAmt += Math.sign(target - sleepAmt) * Math.min(Math.abs(target - sleepAmt), dt / 700);
  const dropPx = Math.round((stage.offsetHeight * SLEEP_HEAD_DROP) / SCALE);
  const drop = Math.round(sleepAmt * dropPx) * SCALE;
  // Elus: kursor digerakkan di atas kucing cukup lama -> mendengkur
  if (hovering && !dragging && t - lastHoverMove < 250) petTime += dt;
  else petTime = Math.max(0, petTime - dt * 2);
  if (sleeping && petTime > 1500) {
    setSleep(false);
    lastActivity = t;
  }
  purring = !sleeping && petTime > 1000;
  if (purring && t - lastPurrHeart > 1400) {
    lastPurrHeart = t;
    spawnLove();
  }
  const shake = purring ? (Math.floor(t / 70) % 2) * SCALE : 0;

  // Kepala dan badan condong ke kursor dengan efek kenyal (pegas)
  const fsec = Math.min(dt, 50) / 1000;
  let dirX = 0, dirY = 0;
  if (!sleeping && !dragging && t - lastCursorMove < 5000) {
    const fcx = stage.offsetLeft + stage.offsetWidth / 2;
    const fcy = stage.offsetTop + stage.offsetHeight / 2;
    dirX = Math.max(-1, Math.min(1, (cursorX - fcx) / 200));
    dirY = Math.max(-1, Math.min(1, (cursorY - fcy) / 200));
  }
  const spring = (pos, vel, target, k, c) => {
    vel += ((target - pos) * k - vel * c) * fsec;
    return [pos + vel * fsec, vel];
  };
  [fx, fvx] = spring(fx, fvx, dirX * FOLLOW_HEAD * SCALE, 140, 9);
  [fy, fvy] = spring(fy, fvy, dirY * FOLLOW_HEAD * 0.6 * SCALE, 140, 9);
  [bx, bvx] = spring(bx, bvx, dirX * FOLLOW_BODY * SCALE, 90, 8);
  const headTilt = (fx / SCALE) * 1.5;
  groups.head.style.transform =
    `translate(${Math.round(fx + shake)}px, ${Math.round(fy + drop + breath * SCALE)}px) rotate(${headTilt}deg)`;
  groups.body.style.transform = `translate(${Math.round(bx)}px, 0px)`;

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
  const closed = sleeping || purring || t < blinkEnd;
  parts.mata.style.display = closed ? 'none' : '';
  parts.pupil.style.display = closed ? 'none' : '';
  parts.mata_tidur.style.display = closed ? '' : 'none';

  // Pupil melirik kiri/kanan; saat mengetik melihat ke bawah
  if (t >= nextLook) {
    lookX = Math.floor(rand(-1, 2));
    nextLook = t + rand(2000, 5000);
  }
  const typing = !sleeping && t - lastKey < 1500;
  const following = !sleeping && t - lastCursorMove < 5000;
  let ex = lookX;
  let ey = 0;
  if (typing) {
    ey = 1;
  } else if (following) {
    const cx = stage.offsetLeft + stage.offsetWidth / 2;
    const cy = stage.offsetTop + stage.offsetHeight / 2;
    ex = Math.abs(cursorX - cx) > 30 ? Math.sign(cursorX - cx) : 0;
    ey = Math.abs(cursorY - cy) > 30 ? Math.sign(cursorY - cy) : 0;
  }
  parts.pupil.style.transform = `translate(${ex * SCALE}px, ${ey * SCALE}px)`;

  // Tangan menekan keyboard setiap ada ketikan
  parts.tangan.style.transform = `translate(0px, ${t < keyPulseEnd ? SCALE : 0}px)`;

  // Tidur kalau lama tidak ada aktivitas
  if (!sleeping && t - lastActivity > SLEEP_AFTER_MS) setSleep(true);

  // Mochi: saat diangkat badan memanjang, mengayun mengikuti gerakan,
  // lalu memantul kembali saat dilepas
  const sec = Math.min(dt, 50) / 1000;
  dragVx *= 0.85;
  const held = dragging && dragMoved;
  const mochiTarget = held ? 0.18 : t < stretchUntil ? 0.14 : 0;
  mochiV += (mochiTarget - mochi) * 180 * sec - mochiV * 9 * sec;
  mochi += mochiV * sec;
  const tiltTarget = held ? Math.max(-15, Math.min(15, dragVx * 0.5)) : 0;
  tiltV += (tiltTarget - tilt) * 140 * sec - tiltV * 8 * sec;
  tilt += tiltV * sec;
  stage.style.transform = `rotate(${tilt}deg) scale(${1 - mochi * 0.6}, ${1 + mochi})`;

  requestAnimationFrame(frame);
}

init().catch((err) => {
  document.body.insertAdjacentHTML(
    'beforeend',
    '<pre style="color:red;background:#fff;font-size:11px">' + err.message + '</pre>'
  );
});