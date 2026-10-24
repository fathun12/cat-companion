const { app, BrowserWindow, ipcMain, screen, globalShortcut } = require('electron');
const path = require('path');
const { uIOhook } = require('uiohook-napi');

let win;

app.whenReady().then(() => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 200,
    height: 200,
    x: width - 250,
    y: height - 220,
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
});

app.on('will-quit', () => uIOhook.stop());
app.on('window-all-closed', () => app.quit());