const { ipcRenderer } = require('electron');
const S = require('./state');

// Pose minum: kepala turun ke mangkuk (DRINK_DROP_PX), lidah di mulut (anak grup kepala, ikut gerak kepala),
// kepala naik-turun kecil sambil lidah keluar-masuk. Dipicu IPC 'say' jenis 'drink' dari timers.js.
// Gambar: assets/cat/drink/bowl.png dan lidah.png (48x48, tidak diwarnai ulang).
// lidah.png digambar pada posisi SAAT kepala sudah turun, jadi di grup kepala digeser naik sebesar DRINK_DROP_PX.

let bowl = null;
let tongue = null;
let startAt = -1;

const mkImg = (file) => {
  const img = new Image();
  img.className = 'layer';
  img.draggable = false;
  img.src = S.BASE + 'cat/drink/' + file;
  img.style.display = 'none';
  return img;
};

function buildDrink() {
  bowl = mkImg('bowl.png');
  tongue = mkImg('lidah.png');
  tongue.style.transform = `translateY(${-S.DRINK_DROP_PX * S.SCALE}px)`;
  S.stage.appendChild(bowl); // paling atas, di bawah dagu
  S.groups.head.appendChild(tongue); // di kepala, ikut turun-naik
}

const isActive = (t) => startAt >= 0 && t >= startAt && t < startAt + S.DRINK_MS;

// 0 = kepala duduk biasa, 1 = kepala sudah di mangkuk
function amount(t) {
  const e = t - startAt;
  if (e < 0 || e >= S.DRINK_MS) return 0;
  if (e < S.DRINK_IN_MS) return e / S.DRINK_IN_MS;
  if (e > S.DRINK_MS - S.DRINK_OUT_MS) return (S.DRINK_MS - e) / S.DRINK_OUT_MS;
  return 1;
}

// true = kepala di mangkuk + lidah keluar; false = kepala naik sedikit, lidah masuk
const licking = (t) =>
  amount(t) >= 1 && (t - startAt - S.DRINK_IN_MS) % S.DRINK_BOB_MS < S.DRINK_BOB_MS / 2;

// Seberapa turun kepala (piksel layar), dipakai animate.js
function dip(t) {
  if (!isActive(t) || S.dragging || S.sleeping) return 0;
  const a = amount(t);
  const drop = Math.round(a * S.DRINK_DROP_PX);
  const up = a >= 1 && !licking(t) ? S.DRINK_BOB_UP_PX : 0;
  return (drop - up) * S.SCALE;
}

function update(t, active) {
  if (!bowl) return;
  bowl.style.display = active ? '' : 'none';
  tongue.style.display = active && licking(t) ? '' : 'none';
}

ipcRenderer.on('say', (event, text, kind) => {
  if (kind === 'drink') startAt = performance.now() + S.DRINK_DELAY_MS;
});

module.exports = { buildDrink, isActive, dip, update };