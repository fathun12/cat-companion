const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

const W = 270; // lebar jendela (CSS: menu 256 + ruang bayangan 10 + sisa)
let menu = null;
let at = { x: 0, y: 0 }; // posisi kursor saat menu dibuka

// Menu muncul di samping kursor; kalau tidak muat, dibalik ke kiri atau atas
function place(h) {
  const d = screen.getDisplayNearestPoint(at).workArea;
  let x = at.x + W > d.x + d.width ? at.x - W : at.x;
  let y = at.y + h > d.y + d.height ? at.y - h : at.y;
  x = Math.max(d.x, Math.min(x, d.x + d.width - W));
  y = Math.max(d.y, Math.min(y, d.y + d.height - h));
  return { x, y };
}

function open() {
  if (menu && !menu.isDestroyed()) menu.close();
  at = screen.getCursorScreenPoint();
  const p = place(480);
  const m = new BrowserWindow({
    width: W,
    height: 480,
    x: p.x,
    y: p.y,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  menu = m;
  m.setAlwaysOnTop(true, 'screen-saver');
  m.loadFile(path.join(__dirname, '..', '..', 'renderer', 'menu', 'index.html'));
  m.on('blur', () => {
    if (!m.isDestroyed()) m.close(); // klik di luar menu = tutup
  });
  // Jaga-jaga kalau tampilan gagal memberi tahu ukurannya
  setTimeout(() => {
    if (!m.isDestroyed() && !m.isVisible()) {
      m.show();
      m.focus();
    }
  }, 1500);
}

// Tampilan menu memberi tahu tingginya; jendela disesuaikan lalu ditampilkan
ipcMain.on('menu-size', (event, h) => {
  if (!menu || menu.isDestroyed()) return;
  h = Math.max(100, Math.min(Math.ceil(h), 900));
  const p = place(h);
  menu.setBounds({ x: p.x, y: p.y, width: W, height: h });
  if (!menu.isVisible()) {
    menu.show();
    menu.focus();
  }
});

ipcMain.on('menu-close', () => {
  if (menu && !menu.isDestroyed()) menu.close();
});

module.exports = { open };