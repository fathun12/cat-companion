const { app, BrowserWindow, ipcMain, screen, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { uIOhook } = require('uiohook-napi');
const timers = require('./src/main/services/timers');

let win;

app.whenReady().then(() => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const WIN = 260;

  win = new BrowserWindow({
    width: WIN,
    height: WIN,
    x: width - WIN - 50,
    y: height - WIN - 20,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Awalnya klik menembus jendela
  win.setIgnoreMouseEvents(true, { forward: true });

  win.loadFile(path.join(__dirname, 'src/renderer/pet/index.html'));

  // Kucing meminta: tembus klik atau tidak
  ipcMain.on('set-ignore-mouse', (event, ignore) => {
    if (ignore) {
      win.setIgnoreMouseEvents(true, { forward: true });
    } else {
      win.setIgnoreMouseEvents(false);
    }
  });

  // Tombol keluar darurat
  globalShortcut.register('Control+Shift+Q', () => app.quit());

  // Pembaca aktivitas global. PRIVASI: hanya jenis aktivitasnya yang dikirim,
  // isi ketikan (tombol apa) tidak pernah dibaca atau disimpan.
  const last = {};
  const notify = (type, minGap) => {
    const now = Date.now();
    if (now - (last[type] || 0) < minGap) return;
    last[type] = now;
    if (win && !win.isDestroyed()) win.webContents.send('activity', type);
  };
  uIOhook.on('keydown', () => notify('key', 30));
  uIOhook.on('mousemove', () => notify('mouse', 250));
  uIOhook.on('wheel', () => notify('scroll', 100));
  uIOhook.on('click', () => notify('click', 100));
  uIOhook.start();

  // Posisi kursor relatif terhadap jendela (hanya koordinat, untuk mata kucing)
  let lastCursor = { x: -1, y: -1, bx: -1, by: -1 };
  setInterval(() => {
    if (!win || win.isDestroyed()) return;
    const p = screen.getCursorScreenPoint();
    const b = win.getBounds();
    if (p.x === lastCursor.x && p.y === lastCursor.y && b.x === lastCursor.bx && b.y === lastCursor.by) return;
    lastCursor = { x: p.x, y: p.y, bx: b.x, by: b.y };
    win.webContents.send('cursor', p.x - b.x, p.y - b.y);
  }, 50);

  // Drag jendela kucing
  let dragTimer = null;
  ipcMain.on('drag-start', () => {
    const c = screen.getCursorScreenPoint();
    const [wx, wy] = win.getPosition();
    const ox = c.x - wx;
    const oy = c.y - wy;
    clearInterval(dragTimer);
    dragTimer = setInterval(() => {
      const p = screen.getCursorScreenPoint();
      win.setBounds({ x: p.x - ox, y: p.y - oy, width: WIN, height: WIN });
    }, 16);
  });
  ipcMain.on('drag-end', () => {
    clearInterval(dragTimer);
    dragTimer = null;
  });

  // (Bermain dengan kursor ada di pet.js; jendela tidak lagi berpindah sendiri)

  // Pomodoro, pengingat, dan menu klik kanan
  timers.init(win);

  // Tampilan kucing (warna dan pola) disimpan di look.json
  const lookFile = path.join(app.getPath('userData'), 'look.json');
  ipcMain.handle('look-get', () => {
    try {
      return JSON.parse(fs.readFileSync(lookFile, 'utf8'));
    } catch (e) {
      return null;
    }
  });
  ipcMain.on('look-set', (event, look) => {
    try {
      fs.writeFileSync(lookFile, JSON.stringify(look, null, 2));
    } catch (e) {}
    if (win && !win.isDestroyed()) win.webContents.send('look', look);
  });

  // Jendela kustomisasi (dibuka dari menu klik kanan)
  let panel = null;
  ipcMain.on('open-panel', () => {
    if (panel && !panel.isDestroyed()) {
      panel.focus();
      return;
    }
    panel = new BrowserWindow({
      width: 480,
      height: 700,
      title: 'Kustomisasi Kucing',
      autoHideMenuBar: true,
      webPreferences: { nodeIntegration: true, contextIsolation: false },
    });
    panel.loadFile(path.join(__dirname, 'src/renderer/panel/index.html'));
  });
});

app.on('will-quit', () => uIOhook.stop());
app.on('window-all-closed', () => app.quit());