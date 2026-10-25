const { ipcRenderer } = require('electron');
const Look = require('../pet/look.js');

const $ = (id) => document.getElementById(id);
let look = { ...Look.PRESETS.hitam };

async function render() {
  const c = await Look.composite(look);
  const p = $('preview');
  p.width = c.width;
  p.height = c.height;
  p.getContext('2d').drawImage(c, 0, 0);
}

function fill() {
  $('cBody').value = look.body;
  $('cOutline').value = look.outline;
  $('cP1').value = look.p1;
  $('cP2').value = look.p2;
  $('pattern').value = look.pattern;
}

function readInputs() {
  look = {
    body: $('cBody').value,
    outline: $('cOutline').value,
    p1: $('cP1').value,
    p2: $('cP2').value,
    pattern: $('pattern').value,
  };
}

function send() {
  ipcRenderer.send('look-set', look);
}

Object.keys(Look.PRESETS).forEach((name) => {
  const b = document.createElement('button');
  b.textContent = name[0].toUpperCase() + name.slice(1);
  b.onclick = () => {
    look = { ...Look.PRESETS[name] };
    fill();
    render();
    send();
  };
  $('presets').appendChild(b);
});

['cBody', 'cOutline', 'cP1', 'cP2', 'pattern'].forEach((id) => {
  $(id).addEventListener('input', () => {
    readInputs();
    render();
  });
  $(id).addEventListener('change', () => {
    readInputs();
    send();
  });
});

(async () => {
  const saved = await ipcRenderer.invoke('look-get');
  if (saved) look = { ...look, ...saved };
  fill();
  render();
})();
// ===== Pesan pengingat =====
let msgs = { name: '', messages: [] };

function saveMsgs() {
  msgs.name = $('uName').value.trim();
  ipcRenderer.send('msgs-set', msgs);
}

function renderMsgs() {
  const box = $('mList');
  box.innerHTML = '';
  msgs.messages.sort((a, b) => a.time.localeCompare(b.time));
  msgs.messages.forEach((m) => {
    const row = document.createElement('div');
    row.className = 'msg';

    const on = document.createElement('input');
    on.type = 'checkbox';
    on.checked = m.enabled;
    on.onchange = () => {
      m.enabled = on.checked;
      saveMsgs();
    };

    const t = document.createElement('span');
    t.className = 't';
    t.textContent = m.time;

    const x = document.createElement('span');
    x.className = 'x';
    x.textContent = m.text;

    const del = document.createElement('button');
    del.textContent = 'Hapus';
    del.onclick = () => {
      msgs.messages = msgs.messages.filter((q) => q !== m);
      renderMsgs();
      saveMsgs();
    };

    row.append(on, t, x, del);
    box.appendChild(row);
  });
}

$('mAdd').onclick = () => {
  const time = $('mTime').value;
  const text = $('mText').value.trim();
  if (!time || !text) return;
  msgs.messages.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    time,
    text,
    enabled: true,
  });
  $('mText').value = '';
  renderMsgs();
  saveMsgs();
};
$('uName').addEventListener('change', saveMsgs);

(async () => {
  const saved = await ipcRenderer.invoke('msgs-get');
  if (saved) msgs = { name: saved.name || '', messages: saved.messages || [] };
  $('uName').value = msgs.name;
  renderMsgs();
})();