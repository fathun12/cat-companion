const fs = require('fs');
const path = require('path');
const { app, Menu, ipcMain } = require('electron');

const DEFAULTS = { focusMin: 25, breakMin: 5, stretchMin: 45, waterMin: 60, hunt: true }; // 0 = nonaktif
let settings = { ...DEFAULTS };
let file = '';
let win = null;

let pomo = { phase: 'idle', running: false, endAt: 0, left: 0 };
let nextStretch = 0;
let nextWater = 0;
let lastStatus = null;

function load() {
  file = path.join(app.getPath('userData'), 'settings.json');
  try {
    settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (e) {}
}

function save() {
  try {
    fs.writeFileSync(file, JSON.stringify(settings, null, 2));
  } catch (e) {}
}

function send(channel, ...args) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
}

function say(text, kind) {
  send('say', text, kind);
}

function schedule() {
  const now = Date.now();
  nextStretch = now + settings.stretchMin * 60000;
  nextWater = now + settings.waterMin * 60000;
}

function begin(phase) {
  const min = phase === 'focus' ? settings.focusMin : settings.breakMin;
  pomo = { phase, running: true, endAt: Date.now() + min * 60000, left: 0 };
}

function statusText() {
  if (pomo.phase === 'idle') return '';
  const left = pomo.running ? Math.max(0, pomo.endAt - Date.now()) : pomo.left;
  const s = Math.ceil(left / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  const label = !pomo.running ? 'JEDA' : pomo.phase === 'focus' ? 'FOKUS' : 'ISTIRAHAT';
  return `${label} ${mm}:${ss}`;
}

function sendStatus() {
  const text = statusText();
  if (text === lastStatus) return;
  lastStatus = text;
  send('status', text);
}

function tick() {
  const now = Date.now();
  let said = false;

  if (pomo.phase !== 'idle' && pomo.running && now >= pomo.endAt) {
    if (pomo.phase === 'focus') {
      begin('break');
      say('Waktunya istirahat! Minum dan regangkan badan.', 'stretch');
    } else {
      begin('focus');
      say('Istirahat selesai. Ayo fokus lagi!', 'hop');
    }
    said = true;
  }

  if (!said && settings.stretchMin > 0 && now >= nextStretch && pomo.phase !== 'break') {
    say('Waktunya peregangan! Berdiri sebentar.', 'stretch');
    nextStretch = now + settings.stretchMin * 60000;
    said = true;
  }

  if (!said && settings.waterMin > 0 && now >= nextWater) {
    say('Minum air dulu yuk!', 'hop');
    nextWater = now + settings.waterMin * 60000;
  }

  sendStatus();
}

function radio(label, key, values, fmt) {
  return {
    label,
    submenu: values.map((v) => ({
      label: fmt(v),
      type: 'radio',
      checked: settings[key] === v,
      click: () => {
        settings[key] = v;
        save();
        schedule();
      },
    })),
  };
}

function buildMenu() {
  const idle = pomo.phase === 'idle';
  const minutes = (v) => `${v} menit`;
  const every = (v) => (v === 0 ? 'Nonaktif' : `Tiap ${v} menit`);

  return Menu.buildFromTemplate([
    {
      label: idle ? 'Mulai Pomodoro' : pomo.running ? 'Jeda Pomodoro' : 'Lanjutkan Pomodoro',
      click: () => {
        if (idle) {
          begin('focus');
          say('Fokus dimulai! Semangat!', 'hop');
        } else if (pomo.running) {
          pomo.left = Math.max(0, pomo.endAt - Date.now());
          pomo.running = false;
        } else {
          pomo.endAt = Date.now() + pomo.left;
          pomo.running = true;
        }
        lastStatus = null;
        sendStatus();
      },
    },
    {
      label: 'Reset Pomodoro',
      enabled: !idle,
      click: () => {
        pomo = { phase: 'idle', running: false, endAt: 0, left: 0 };
        lastStatus = null;
        sendStatus();
      },
    },
    { type: 'separator' },
    radio('Durasi fokus', 'focusMin', [1, 15, 25, 45, 50], minutes),
    radio('Durasi istirahat', 'breakMin', [1, 5, 10, 15], minutes),
    { type: 'separator' },
    radio('Pengingat peregangan', 'stretchMin', [0, 1, 30, 45, 60], every),
    radio('Pengingat minum', 'waterMin', [0, 1, 30, 45, 60], every),
    { type: 'separator' },
    {
      label: 'Berburu kursor',
      type: 'checkbox',
      checked: settings.hunt,
      click: (item) => {
        settings.hunt = item.checked;
        save();
      },
    },
    { label: 'Kustomisasi kucing...', click: () => ipcMain.emit('open-panel') },
    { type: 'separator' },
    { label: 'Keluar', click: () => app.quit() },
  ]);
}

function init(browserWindow) {
  win = browserWindow;
  load();
  schedule();
  setInterval(tick, 1000);
  ipcMain.on('show-menu', () => buildMenu().popup({ window: win }));
}

module.exports = { init, huntEnabled: () => settings.hunt };