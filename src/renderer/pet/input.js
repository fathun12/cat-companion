const { ipcRenderer } = require('electron');
const S = require('./state');
const { setSleep, spawnLove, updateHud } = require('./actions');

function initInput() {
  const stage = S.stage;

  // ----- Mouse di atas kucing -----
  stage.addEventListener('mouseenter', () => {
    S.hovering = true;
    ipcRenderer.send('set-ignore-mouse', false);
  });
  stage.addEventListener('mouseleave', () => {
    S.hovering = false;
    if (!S.dragging) ipcRenderer.send('set-ignore-mouse', true);
  });
  stage.addEventListener('mousemove', () => {
    S.lastHoverMove = performance.now();
    S.lastActivity = S.lastHoverMove;
  });

  // Klik kucing (bukan drag): keluarkan hati
  stage.addEventListener('click', () => {
    if (!S.sleeping && !S.dragMoved) spawnLove();
  });

  // ----- Drag kucing -----
  stage.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    S.dragging = true;
    S.dragMoved = false;
    S.dragSX = S.lastSX = e.screenX;
    S.dragSY = e.screenY;
  });
  window.addEventListener('mousemove', (e) => {
    if (!S.dragging) return;
    if (!S.dragMoved) {
      if (Math.hypot(e.screenX - S.dragSX, e.screenY - S.dragSY) < 5) return;
      S.dragMoved = true;
      S.lastActivity = performance.now();
      if (S.sleeping) setSleep(false);
      ipcRenderer.send('drag-start');
    }
    S.dragVx = e.screenX - S.lastSX;
    S.lastSX = e.screenX;
  });
  window.addEventListener('mouseup', () => {
    if (!S.dragging) return;
    S.dragging = false;
    if (S.dragMoved) {
      ipcRenderer.send('drag-end');
      if (!S.hovering) ipcRenderer.send('set-ignore-mouse', true);
    }
  });

  // ----- Klik kanan: menu Pomodoro dan pengaturan -----
  stage.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    ipcRenderer.send('show-menu');
  });

  // ----- Pesan dari main.js -----

  // Aktivitas global (keyboard, mouse, scroll, klik). Isi ketikan tidak pernah dikirim.
  ipcRenderer.on('activity', (event, type) => {
    const now = performance.now();
    S.lastActivity = now;
    if (type !== 'mouse' && S.sleeping) setSleep(false); // gerak mouse saja tidak membangunkan
    if (type === 'key') {
      S.lastKey = now;
      S.keyPulseEnd = now + 90;
    }
    if (type === 'scroll') S.keyPulseEnd = now + 110;
  });

  // Posisi kursor relatif terhadap jendela kucing + deteksi "bermain"
  ipcRenderer.on('cursor', (event, x, y) => {
    const now = performance.now();
    const dtc = now - S.lastCursorMove;
    const speed = dtc > 0 && dtc < 300 ? (Math.hypot(x - S.cursorX, y - S.cursorY) / dtc) * 1000 : 0;
    S.cursorX = x;
    S.cursorY = y;
    S.lastCursorMove = now;

    // Kursor cepat di dekat kucing -> kucing bermain
    const cx = stage.offsetLeft + stage.offsetWidth / 2;
    const cy = stage.offsetTop + stage.offsetHeight / 2;
    const near = Math.hypot(x - cx, y - cy) < S.PLAY_RADIUS;
    const need = S.hovering ? S.PLAY_SPEED * 1.8 : S.PLAY_SPEED; // mengelus tidak dianggap bermain
    if (S.playEnabled && near && !S.dragging && !S.purring && speed > need) {
      S.playing = true;
      S.playUntil = now + 1500;
      S.lastActivity = now;
      if (S.sleeping) setSleep(false);
    }
  });

  // Teks timer Pomodoro
  ipcRenderer.on('status', (event, text) => {
    S.statusText = text;
    updateHud();
  });

  // Pengingat: kucing bangun dan beraksi
  ipcRenderer.on('say', (event, text, kind) => {
    const now = performance.now();
    S.sayText = text;
    S.sayUntil = now + 7000;
    updateHud();
    setTimeout(updateHud, 7100);
    S.lastActivity = now;
    if (S.sleeping) setSleep(false);
    if (kind === 'stretch') S.stretchUntil = now + 4000; // kucing meregang
    else S.mochiV += 2.5; // kucing melonjak kecil
  });

  // Pengaturan "Bermain dengan kursor" (menu klik kanan)
  ipcRenderer.invoke('play-get').then((v) => (S.playEnabled = v));
  ipcRenderer.on('play-enabled', (event, v) => (S.playEnabled = v));
}

module.exports = { initInput };