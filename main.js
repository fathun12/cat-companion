const { app, BrowserWindow, ipcMain, screen, globalShortcut, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { uIOhook } = require('uiohook-napi');
const { spawn } = require('child_process');
const timers = require('./src/main/services/timers');

let win;
let tray; // harus disimpan di variabel supaya ikon tidak hilang
let peeking = false; // true = kucing sedang mengintip di tepi layar
let peekProc = null; // proses PowerShell pembaca status layar penuh

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit(); // sudah ada kucing yang jalan

app.whenReady().then(() => {
  if (!gotLock) return;
  const WIN = 260;

  // Posisi terakhir disimpan di pos.json; dipakai lagi kalau masih berada di salah satu monitor
  const posFile = path.join(app.getPath('userData'), 'pos.json');
  const defaultPos = () => {
    const wa = screen.getPrimaryDisplay().workArea;
    return { x: wa.x + wa.width - WIN - 50, y: wa.y + wa.height - WIN - 20 };
  };
  const onScreen = (p) =>
    screen.getAllDisplays().some((d) => {
      const b = d.workArea;
      const cx = p.x + WIN / 2;
      const cy = p.y + WIN / 2;
      return cx > b.x && cx < b.x + b.width && cy > b.y && cy < b.y + b.height;
    });
  let startPos = defaultPos();
  try {
    const p = JSON.parse(fs.readFileSync(posFile, 'utf8'));
    if (Number.isFinite(p.x) && Number.isFinite(p.y) && onScreen(p)) startPos = p;
  } catch (e) {}

  win = new BrowserWindow({
    width: WIN,
    height: WIN,
    x: startPos.x,
    y: startPos.y,
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
    const [x, y] = win.getPosition();
    if (!peeking) {
      try {
        fs.writeFileSync(posFile, JSON.stringify({ x, y }));
      } catch (e) {}
    }
  });

  // Monitor dicabut atau resolusi berubah: kalau kucing jadi di luar layar, pindah ke monitor utama
  const rescue = () => {
    if (!win || win.isDestroyed() || peeking) return;
    const [x, y] = win.getPosition();
    if (!onScreen({ x, y })) {
      const p = defaultPos();
      win.setPosition(p.x, p.y);
    }
  };
  screen.on('display-removed', rescue);
  screen.on('display-metrics-changed', rescue);

  // ===== Mode mengintip: kucing menyembul dari tepi bawah saat ada aplikasi layar penuh =====
  const PEEK_VISIBLE = 150; // tinggi bagian jendela yang terlihat (px). Kecilkan = lebih sedikit terlihat
  let restorePos = null;
  let slideTimer = null;
  const slideTo = (x, y) => {
    clearInterval(slideTimer);
    const [sx, sy] = win.getPosition();
    const t0 = Date.now();
    slideTimer = setInterval(() => {
      if (!win || win.isDestroyed()) return clearInterval(slideTimer);
      const k = Math.min(1, (Date.now() - t0) / 350);
      const e = 1 - Math.pow(1 - k, 3);
      win.setBounds({
        x: Math.round(sx + (x - sx) * e),
        y: Math.round(sy + (y - sy) * e),
        width: WIN,
        height: WIN,
      });
      if (k >= 1) clearInterval(slideTimer);
    }, 16);
  };
  const setPeek = (on) => {
    if (!win || win.isDestroyed() || on === peeking) return;
    if (on) {
      if (!win.isVisible()) return;
      const [x, y] = win.getPosition();
      restorePos = { x, y };
      const d = screen.getDisplayMatching(win.getBounds()).bounds;
      peeking = true;
      win.setAlwaysOnTop(true, 'screen-saver'); // di atas aplikasi layar penuh
      slideTo(Math.max(d.x, Math.min(x, d.x + d.width - WIN)), d.y + d.height - PEEK_VISIBLE);
    } else {
      peeking = false;
      const p = restorePos || defaultPos();
      slideTo(p.x, p.y);
      setTimeout(() => {
        if (!peeking && win && !win.isDestroyed()) win.setAlwaysOnTop(true);
      }, 450);
    }
  };

  // Satu proses PowerShell tersembunyi menulis satu angka tiap 1,5 detik:
  // 2 = aplikasi layar penuh, 3 = game Direct3D layar penuh, 4 = mode presentasi.
  // PRIVASI: hanya angka status, tidak ada judul jendela atau isi layar.
  let streak = 0;
  let lastFull = false;
  const onState = (n) => {
    const full = n === 2 || n === 3 || n === 4;
    if (full === lastFull) streak++;
    else {
      lastFull = full;
      streak = 1;
    }
    if (streak >= 2) setPeek(full && timers.peekEnabled());
  };
  const psScript = [
    'Add-Type -TypeDefinition \'using System.Runtime.InteropServices; public static class Q { [DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int s); }\'',
    'while ($true) { $s = 0; [void][Q]::SHQueryUserNotificationState([ref]$s); [Console]::WriteLine($s); Start-Sleep -Milliseconds 1500 }',
  ].join('\n');
  try {
    peekProc = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand',
        Buffer.from(psScript, 'utf16le').toString('base64')],
      { windowsHide: true }
    );
    let buf = '';
    peekProc.stdout.on('data', (chunk) => {
      buf += chunk;
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      lines.forEach((l) => {
        const n = parseInt(l, 10);
        if (!isNaN(n)) onState(n);
      });
    });
    peekProc.stderr.on('data', () => {});
    peekProc.on('error', () => {});
  } catch (e) {}

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

  // Preset buatan pemilik, disimpan di presets.json
  const presetsFile = path.join(app.getPath('userData'), 'presets.json');
  ipcMain.handle('presets-get', () => {
    try {
      return JSON.parse(fs.readFileSync(presetsFile, 'utf8'));
    } catch (e) {
      return [];
    }
  });
  ipcMain.on('presets-set', (event, list) => {
    try {
      fs.writeFileSync(presetsFile, JSON.stringify(list));
    } catch (e) {}
  });

  // Jendela kustomisasi (dibuka dari menu klik kanan atau tray)
  let panel = null;
  const openPanel = () => {
    if (panel && !panel.isDestroyed()) {
      panel.focus();
      return;
    }
    panel = new BrowserWindow({
      width: 800,
      height: 780,
      title: 'Kustomisasi Kucing',
      autoHideMenuBar: true,
      webPreferences: { nodeIntegration: true, contextIsolation: false },
    });
    panel.loadFile(path.join(__dirname, 'src/renderer/panel/index.html'));
  };
  ipcMain.on('open-panel', openPanel);

  // Ikon tray (pojok taskbar): klik = tampil/sembunyikan kucing, klik kanan = menu
  const trayIcon = nativeImage
    .createFromPath(path.join(__dirname, 'assets/cat/typing/kepala.png'))
    .crop({ x: 4, y: 4, width: 30, height: 30 })
    .resize({ width: 32, height: 32 });
  tray = new Tray(trayIcon);
  tray.setToolTip('Cat Companion');
  const toggleCat = () => {
    if (win.isVisible()) win.hide();
    else win.showInactive();
  };
  tray.on('click', toggleCat);
  // Auto-start Windows. Saat dev (npm start) harus menyebut path dan folder proyek.
  const loginOpts = app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] };
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Tampilkan / sembunyikan kucing', click: toggleCat },
      { label: 'Kustomisasi...', click: openPanel },
      {
        label: 'Jalankan saat Windows menyala',
        type: 'checkbox',
        checked: app.getLoginItemSettings(loginOpts).openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, ...loginOpts }),
      },
      { type: 'separator' },
      { label: 'Keluar', click: () => app.quit() },
    ])
  );
});

app.on('will-quit', () => {
  uIOhook.stop();
  if (peekProc) peekProc.kill();
});
app.on('window-all-closed', () => app.quit());