const { ipcRenderer } = require('electron');
const S = require('./state');

// Pose minum: mangkuk muncul di bawah dagu, kepala turun-naik, lidah menjulur saat kepala turun.
// Dipicu IPC 'say' jenis 'drink' (pengingat minum dari timers.js).
// Gambar: assets/cat/drink/bowl.png dan lidah.png (48x48, sejajar pose idle, tidak diwarnai ulang).

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
  S.stage.appendChild(bowl); // paling atas, menutupi dagu
  S.groups.head.appendChild(tongue); // ikut gerak kepala
}

const isActive = (t) => startAt >= 0 && t >= startAt && t - startAt < S.DRINK_MS;
const isDown = (t) => (t - startAt) % S.DRINK_BOB_MS >= S.DRINK_BOB_MS / 2;

// Seberapa turun kepala (piksel layar), dipakai animate.js
function dip(t) {
  return isActive(t) && !S.dragging && !S.sleeping && isDown(t) ? S.DRINK_DIP_PX * S.SCALE : 0;
}

function update(t, active) {
  if (!bowl) return;
  bowl.style.display = active ? '' : 'none';
  tongue.style.display = active && isDown(t) ? '' : 'none';
}

ipcRenderer.on('say', (event, text, kind) => {
  if (kind === 'drink') startAt = performance.now() + S.DRINK_DELAY_MS;
});

module.exports = { buildDrink, isActive, dip, update };