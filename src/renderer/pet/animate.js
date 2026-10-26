const S = require('./state');
const { rand, setSleep, spawnLove } = require('./actions');
const Scroll = require('./scroll');

// Variabel yang hanya dipakai di loop animasi
let prevT = 0;
let sleepAmt = 0; // 0 = bangun, 1 = tidur melingkar
let fx = 0, fvx = 0, fy = 0, fvy = 0, bx = 0, bvx = 0; // pegas kepala/badan
let tilt = 0, tiltV = 0;
let plant = 1; // 1 = kaki menapak, 0 = diangkat (saat di-drag)
let nextBlink = 2000, blinkEnd = 0;
let nextEar = 4000, earEnd = 0, earAngle = -4;
let nextLook = 3000, lookX = 0;
// Mengetik
let heat = 0; // 0 = tenang, 1 = memerah
let hot = false, hotUntil = 0, tiredUntil = 0;
let kick = 0, kickV = 0, seenKey = 0, wagPhase = 0;
let nextDizzy = 0, dizzyStart = -10000; // pupil pusing saat memerah
const DIZZY_MS = 880; // 8 langkah x 110 ms = 2 putaran
const DIZZY_RING = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // atas, kanan, bawah, kiri

const spring = (pos, vel, target, k, c, sec) => {
  vel += ((target - pos) * k - vel * c) * sec;
  return [pos + vel * sec, vel];
};

function frame(t) {
  const { parts, groups, stage, SCALE } = S;
  const s = t / 1000;
  const dt = Math.min(t - prevT, 100);
  prevT = t;

  // ----- Napas -----
  const breathPeriod = S.sleeping ? 4.5 : 3.2;
  const breath = Math.round((Math.sin((s * 2 * Math.PI) / breathPeriod) + 1) / 2);

  // ----- Transisi tidur: kepala turun ke badan, bergerak per piksel -----
  const target = S.sleeping ? 1 : 0;
  sleepAmt += Math.sign(target - sleepAmt) * Math.min(Math.abs(target - sleepAmt), dt / 700);
  const dropPx = Math.round((stage.offsetHeight * S.SLEEP_HEAD_DROP) / SCALE);
  const drop = Math.round(sleepAmt * dropPx) * SCALE;

  // ----- Bermain: menunduk, badan geol-geol -----
  if (S.playing && (t > S.playUntil || S.sleeping || S.dragging)) S.playing = false;
  S.playAmt += ((S.playing ? 1 : 0) - S.playAmt) * Math.min(1, dt / 120);
  const crouchPx = Math.round((S.playAmt * stage.offsetHeight * 0.06) / SCALE) * SCALE;
  const wigDeg = Math.sin(t / 45) * 3 * S.playAmt; // geol-geol: badan miring dari kaki

  // ----- Elus: kursor digerakkan di atas kucing cukup lama -> mendengkur -----
  if (S.hovering && !S.dragging && t - S.lastHoverMove < 250) S.petTime += dt;
  else S.petTime = Math.max(0, S.petTime - dt * 2);
  if (S.sleeping && S.petTime > 1500) {
    setSleep(false);
    S.lastActivity = t;
  }
  S.purring = !S.sleeping && !S.playing && S.petTime > 1000;
  if (S.purring && t - S.lastPurrHeart > 1400) {
    S.lastPurrHeart = t;
    spawnLove();
  }
  const shake = S.purring ? (Math.floor(t / 70) % 2) * SCALE : 0;

  // ----- Kepala dan badan condong ke kursor dengan efek kenyal -----
  const fsec = Math.min(dt, 50) / 1000;
  let dirX = 0, dirY = 0;
  if (!S.sleeping && !S.dragging && t - S.lastCursorMove < 5000) {
    const fcx = stage.offsetLeft + stage.offsetWidth / 2;
    const fcy = stage.offsetTop + stage.offsetHeight / 2;
    dirX = Math.max(-1, Math.min(1, (S.cursorX - fcx) / 200));
    dirY = Math.max(-1, Math.min(1, (S.cursorY - fcy) / 200));
  }
  [fx, fvx] = spring(fx, fvx, dirX * S.FOLLOW_HEAD * SCALE, 140, 9, fsec);
  [fy, fvy] = spring(fy, fvy, dirY * S.FOLLOW_HEAD * 0.6 * SCALE, 140, 9, fsec);
  [bx, bvx] = spring(bx, bvx, dirX * S.FOLLOW_BODY * SCALE, 90, 8, fsec);
  const headTilt = (fx / SCALE) * 1.5;
  // Badan miring dari titik kaki (kaki tidak bergeser); kepala ikut terbawa
  const bodyDeg = (bx / SCALE) * 2 + wigDeg;
  const carry = (S.FEET_Y - 0.4) * stage.offsetHeight * Math.sin((bodyDeg * Math.PI) / 180);
  groups.head.style.transform =
    `translate(${Math.round(fx + shake + carry)}px, ${Math.round(fy + drop + crouchPx + breath * SCALE)}px) rotate(${headTilt}deg)`;
  groups.body.style.transform = `rotate(${bodyDeg}deg)`;

  // ----- Ekor goyang, bertahap per 5 derajat supaya terasa pixel art -----
  const tailPeriod = 2.6 - 2.25 * S.playAmt; // makin semangat makin cepat
  const amp = S.sleeping ? 5 : 10 + 15 * S.playAmt;
  const tail = Math.round((Math.sin((s * 2 * Math.PI) / tailPeriod) * amp) / 5) * 5;
  parts.ekor.style.transform = `rotate(${tail}deg)`;

  // ----- Kuping berkedut sesekali -----
  if (t >= nextEar) {
    earEnd = t + 180;
    earAngle = Math.random() < 0.5 ? -4 : 4;
    nextEar = t + rand(4000, 9000);
  }
  parts.kuping.style.transform = `rotate(${t < earEnd ? earAngle : 0}deg)`;

  // ----- Kedip -----
  if (t >= nextBlink) {
    blinkEnd = t + 160;
    nextBlink = t + rand(2500, 6000);
  }
  const closed = S.sleeping || S.purring || t < blinkEnd;
  parts.mata.style.display = closed ? 'none' : '';
  parts.pupil.style.display = closed ? 'none' : '';
  parts.mata_tidur.style.display = closed ? '' : 'none';

  // ----- Pupil: melirik acak, melihat ke bawah saat mengetik, mengikuti kursor -----
  if (t >= nextLook) {
    lookX = Math.floor(rand(-1, 2));
    nextLook = t + rand(2000, 5000);
  }
  const typing = !S.sleeping && t - S.lastKey < 1500;
  const following = !S.sleeping && t - S.lastCursorMove < 5000;
  let ex = lookX;
  let ey = 0;
  if (typing) {
    ey = 1;
  } else if (following) {
    const cx = stage.offsetLeft + stage.offsetWidth / 2;
    const cy = stage.offsetTop + stage.offsetHeight / 2;
    ex = Math.abs(S.cursorX - cx) > 30 ? Math.sign(S.cursorX - cx) : 0;
    ey = Math.abs(S.cursorY - cy) > 30 ? Math.sign(S.cursorY - cy) : 0;
  }
  parts.pupil.style.transform = `translate(${ex * SCALE}px, ${ey * SCALE}px)`;

  // ----- Tangan: sekarang hanya bergerak saat scroll -----
  parts.tangan.style.transform = `translate(0px, ${t < S.keyPulseEnd ? SCALE : 0}px)`;

  // ----- Mengetik cepat: frustrasi -> memerah -> lelah -----
  const keys = S.keyTimes;
  while (keys.length && t - keys[0] > 1000) keys.shift();
  const spd = Math.min(1, keys.length / 8); // 0 = pelan, 1 = ngebut
  const tired = !S.sleeping && t < tiredUntil;
  if (S.sleeping) {
    heat = 0;
    hot = false;
    tiredUntil = 0;
  } else if (tired) {
    heat = 0;
  } else if (hot) {
    if (t > hotUntil) {
      hot = false;
      heat = 0;
      tiredUntil = t + S.TIRED_MS;
      keys.length = 0;
    }
  } else {
    heat += keys.length >= S.HEAT_KPS ? dt / S.HEAT_RISE_MS : -dt / S.HEAT_FALL_MS;
    heat = Math.max(0, Math.min(1, heat));
    if (heat >= 1) {
      hot = true;
      hotUntil = t + S.HOT_MS;
    }
  }
  const frustrated = !hot && !tired && heat > S.FRUSTRATE_AT;

  // ----- Pose mengetik (layer terpisah) menggantikan kucing biasa -----
  const showTyping =
    !S.sleeping && !S.dragging && (t - S.lastKey < S.TYPE_HOLD_MS || hot || tired || heat > 0);
  // Pose scroll: tampil kalau baru scroll dan tidak sedang mengetik
  const showScroll =
    !showTyping && !S.sleeping && !S.dragging && t - S.lastScroll < S.SCROLL_HOLD_MS;
  for (const id in groups) groups[id].style.display = showTyping || showScroll ? 'none' : '';
  Scroll.update(t, dt, showScroll, breath);
  const T = S.typ;
  T.box.style.display = showTyping ? '' : 'none';
  const active = tired ? 0 : S.typeFrame; // kaki bergantian: click1 <-> click2
  T.clicks.forEach((c, i) => {
    const on = i === active ? '' : 'none';
    c.img.style.display = on;
    c.imgH.style.display = on;
  });

  if (showTyping) {
    // Setiap ketikan: kepala menekan sedikit ke bawah, lalu memantul kembali
    if (S.lastKey !== seenKey) {
      seenKey = S.lastKey;
      kickV += 26;
    }
    [kick, kickV] = spring(kick, kickV, 0, 260, 14, fsec);
    kick = Math.min(kick, 2);
    const dip = Math.min(2, breath + Math.max(0, Math.round(kick))) * SCALE;
    T.headBox.style.transform = `translateY(${dip}px)`;

    // Mata: melihat ke papan ketik; tertutup saat lelah atau kedip
    const shut = tired || t < blinkEnd;
    T.mata.style.display = shut ? 'none' : '';
    T.pupil.style.display = shut ? 'none' : '';
    T.closed.style.display = shut ? '' : 'none';
    // Pupil: menunduk ke papan ketik; saat memerah sesekali berputar pusing
    let pdx = 0, pdy = 1;
    if (hot) {
      if (t >= nextDizzy) {
        dizzyStart = t;
        nextDizzy = t + rand(1800, 3000);
      }
      const dz = t - dizzyStart;
      if (dz < DIZZY_MS) [pdx, pdy] = DIZZY_RING[Math.floor(dz / 110) % 4];
    } else {
      nextDizzy = t + 500; // putaran pertama 0,5 detik setelah mulai memerah
      dizzyStart = -10000;
    }
    T.pupil.style.transform = `translate(${pdx * SCALE}px, ${pdy * SCALE}px)`;

    // Ekor berkibas: makin cepat mengetik, makin cepat kibasannya.
    // Saat gelembung muncul atau memerah = sama persis dengan mode excited (0,35 dtk, 25 derajat)
    const excited = frustrated || hot;
    const wagPeriod = tired ? 3 : excited ? 0.35 : 1.4 - 1.0 * spd;
    const wagAmp = tired ? 5 : excited ? 25 : 10 + 12 * spd;
    wagPhase += ((dt / 1000) * (2 * Math.PI)) / wagPeriod;
    const wag = Math.round((Math.sin(wagPhase) * wagAmp) / 5) * 5;
    T.tailBox.style.transform = `rotate(${wag}deg)`;

    // Merah: naik pelan saat panas, penuh saat memerah, memudar saat lelah
    const red = hot
      ? 1
      : tired
        ? Math.max(0, (tiredUntil - t) / S.TIRED_MS)
        : Math.max(0, (heat - 0.3) / 0.7);
    T.tailH.style.opacity = red;
    T.kupingH.style.opacity = red;
    T.kepalaH.style.opacity = red;
    T.clicks.forEach((c) => (c.imgH.style.opacity = red));
  }

  // Gelembung: frustrasi dan memerah cepat, lelah pelan
  const showBubbles = showTyping && (frustrated || hot || tired);
  const bp = Math.floor(t / (tired ? 600 : 300)) % 2;
  S.angryImgs.forEach((img, i) => (img.style.display = showBubbles && i === bp ? '' : 'none'));

  // ----- Tidur kalau lama tidak ada aktivitas -----
  if (!S.sleeping && t - S.lastActivity > S.SLEEP_AFTER_MS) setSleep(true);

  // ----- Mochi: memanjang saat diangkat, memendek saat menunduk, memantul kembali -----
  const sec = Math.min(dt, 50) / 1000;
  S.dragVx *= 0.85;
  const held = S.dragging && S.dragMoved;
  const mochiTarget = held ? 0.18 : t < S.stretchUntil ? 0.14 : -0.1 * S.playAmt;
  S.mochiV += (mochiTarget - S.mochi) * 180 * sec - S.mochiV * 9 * sec;
  S.mochi += S.mochiV * sec;
  if (S.playing) S.lastActivity = t;
  const tiltTarget = held ? Math.max(-15, Math.min(15, S.dragVx * 0.5)) : 0;
  tiltV += (tiltTarget - tilt) * 140 * sec - tiltV * 8 * sec;
  tilt += tiltV * sec;
  // Kaki tetap menapak: saat tidak diangkat, geser panggung supaya kaki tidak ikut naik/turun
  plant += ((held ? 0 : 1) - plant) * Math.min(1, dt / 150);
  const sy = 1 + S.mochi;
  const ground = (S.FEET_Y - 0.25) * stage.offsetHeight * (1 - sy) * plant;
  const hotShake = hot && showTyping ? (Math.floor(t / 60) % 2) * SCALE : 0; // bergetar saat memerah
  stage.style.transform =
    `translateX(${hotShake}px) translateY(${ground}px) rotate(${tilt}deg) scale(${1 - S.mochi * 0.6}, ${sy})`;

  requestAnimationFrame(frame);
}

function startLoop() {
  requestAnimationFrame(frame);
}

module.exports = { startLoop };