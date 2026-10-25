// Semua pengaturan dan status bersama kucing.
// Modul lain memakainya lewat: const S = require('./state');

const S = {
  // ===== Pengaturan (boleh diubah) =====
  WIN: 260, // harus sama dengan WIN di main.js
  BASE: '../../../assets/', // lokasi folder assets dari index.html
  SLEEP_AFTER_MS: 10 * 1000, // diam sekian milidetik -> tidur
  LOVE_START_UP: 0.42, // makin besar, hati muncul makin tinggi
  SLEEP_HEAD_DROP: 0.14, // kepala turun saat tidur (pecahan tinggi kucing)
  FOLLOW_HEAD: 3, // seberapa jauh kepala condong ke kursor
  FOLLOW_BODY: 1, // seberapa jauh badan ikut
  PLAY_SPEED: 700, // kecepatan kursor (px/detik) agar kucing bermain
  PLAY_RADIUS: 140, // jarak kursor dari kucing agar dianggap "di depan kucing"
  FEET_X: 0.46, // posisi kaki di gambar (0 kiri, 1 kanan); badan miring dari titik ini
  FEET_Y: 0.82, // posisi telapak kaki (0 atas, 1 bawah); kaki tetap menapak di titik ini

  // ===== Elemen dan data (diisi saat start) =====
  stage: null,
  hud: null,
  bubble: null,
  rig: null,
  parts: {},
  groups: {},
  SCALE: 2,

  // ===== Status =====
  sleeping: false,
  lastActivity: performance.now(),
  lastKey: -10000,
  keyPulseEnd: 0,

  cursorX: 0,
  cursorY: 0,
  lastCursorMove: -10000,

  hovering: false,
  lastHoverMove: -10000,
  petTime: 0,
  purring: false,
  lastPurrHeart: 0,

  dragging: false,
  dragMoved: false,
  dragSX: 0,
  dragSY: 0,
  lastSX: 0,
  dragVx: 0,

  playing: false,
  playUntil: 0,
  playAmt: 0,
  playEnabled: true,

  mochi: 0,
  mochiV: 0,

  stretchUntil: 0,
  statusText: '',
  sayText: '',
  sayUntil: 0,
};

module.exports = S;