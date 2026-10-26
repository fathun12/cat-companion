const { ipcRenderer } = require('electron');
const Look = require('../pet/look.js');

const $ = (id) => document.getElementById(id);
const clone = (o) => JSON.parse(JSON.stringify(o));
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const PALETTE = [
  '#ffffff', '#d9d9d9', '#8c8c8c', '#4a4a4a', '#000000', '#fff1d0', '#f2c98a', '#e09a4b',
  '#b8641c', '#7a4420', '#4a2a14', '#f4b6c8', '#e0698f', '#a63a5c', '#8ad3c4', '#7a9cff',
];
const LABEL = {
  earL: 'Kuping kiri', earR: 'Kuping kanan', head: 'Kepala', body: 'Badan',
  arm: 'Tangan', foot: 'Kaki', tail: 'Ekor',
};
const EYE_BG_DEFAULT = '#ffffff';
const EYE_DEFAULT = '#5b8cff';

let look = null; // tampilan yang sedang diedit
let baseline = null; // tampilan awal, untuk tombol Buang
let dims = null;
let sil = null;
let tool = 'paint';
let brush = 3;
let color = '#e09a4b';
let mine = []; // preset buatan pemilik
const history = []; // riwayat lukisan untuk Urungkan
const canv = {};

function send() {
  ipcRenderer.send('look-set', look);
}

// ===== Pratinjau =====
let busy = false;
let dirty = false;
async function renderPreview() {
  if (busy) {
    dirty = true;
    return;
  }
  busy = true;
  do {
    dirty = false;
    try {
      const c = await Look.composite(look);
      const p = $('preview');
      p.width = c.width;
      p.height = c.height;
      p.getContext('2d').drawImage(c, 0, 0);
    } catch (e) {}
  } while (dirty);
  busy = false;
}

// ===== Kisi pola =====
const cellSize = (key) => Math.max(5, Math.min(12, Math.floor(190 / Math.max(dims[key].w, dims[key].h))));

function drawGrid(key) {
  const cv = canv[key];
  const g = look.parts[key];
  const s = sil[key];
  const cs = cellSize(key);
  const ctx = cv.getContext('2d');
  const body = rgb(look.body);
  const outline = rgb(look.outline);
  ctx.fillStyle = '#2b2140';
  ctx.fillRect(0, 0, cv.width, cv.height);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const L = s.L[y * g.w + x];
      if (L < 0) continue;
      let col;
      if (L < 40) col = g.px[y * g.w + x] || look.body;
      else if (L > 215) col = look.outline;
      else {
        const m = body.map((v, k) => Math.round(v + (outline[k] - v) * (L / 255)));
        col = `rgb(${m[0]},${m[1]},${m[2]})`;
      }
      ctx.fillStyle = col;
      ctx.fillRect(x * cs, y * cs, cs, cs);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < g.w; x++) {
    ctx.moveTo(x * cs + 0.5, 0);
    ctx.lineTo(x * cs + 0.5, cv.height);
  }
  for (let y = 1; y < g.h; y++) {
    ctx.moveTo(0, y * cs + 0.5);
    ctx.lineTo(cv.width, y * cs + 0.5);
  }
  ctx.stroke();
}

const drawAll = () => Look.PART_KEYS.forEach(drawGrid);

function paintAt(key, gx, gy, erase) {
  const g = look.parts[key];
  const s = sil[key];
  const o = Math.floor((brush - 1) / 2);
  for (let dy = 0; dy < brush; dy++) {
    for (let dx = 0; dx < brush; dx++) {
      const x = gx - o + dx;
      const y = gy - o + dy;
      if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
      const L = s.L[y * g.w + x];
      if (L < 0 || L >= 40) continue; // hanya bagian isi badan yang bisa dilukis
      g.px[y * g.w + x] = erase ? '' : color;
    }
  }
}

function pushHistory() {
  history.push(JSON.stringify(look.parts));
  if (history.length > 30) history.shift();
}

function undo() {
  if (!history.length) return;
  look.parts = JSON.parse(history.pop());
  drawAll();
  renderPreview();
  send();
}

function bindCanvas(key, cv) {
  let down = false;
  let erase = false;
  const cell = (e) => {
    const r = cv.getBoundingClientRect();
    const cs = cellSize(key);
    return [Math.floor((e.clientX - r.left) / cs), Math.floor((e.clientY - r.top) / cs)];
  };
  const stroke = (e) => {
    const [x, y] = cell(e);
    paintAt(key, x, y, erase);
    drawGrid(key);
    renderPreview();
  };
  cv.addEventListener('mousedown', (e) => {
    e.preventDefault();
    down = true;
    erase = e.button === 2 || tool === 'erase';
    pushHistory();
    stroke(e);
  });
  cv.addEventListener('mousemove', (e) => {
    if (down) stroke(e);
  });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('mouseup', () => {
    if (!down) return;
    down = false;
    send();
  });
}

function buildGrids() {
  const box = $('grids');
  box.innerHTML = '';
  for (const key of Look.PART_KEYS) {
    const { w, h } = dims[key];
    const cs = cellSize(key);
    const part = document.createElement('div');
    part.className = 'part';
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.textContent = LABEL[key];
    const wrap = document.createElement('div');
    wrap.className = 'cwrap';
    const cv = document.createElement('canvas');
    cv.width = w * cs;
    cv.height = h * cs;
    canv[key] = cv;
    bindCanvas(key, cv);
    wrap.appendChild(cv);
    part.append(tag, wrap);
    box.appendChild(part);
  }
}

// ===== Alat =====
function refreshTools() {
  document.querySelectorAll('#tools .chip').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool));
  document.querySelectorAll('#brushes .chip').forEach((b) => b.classList.toggle('on', Number(b.dataset.brush) === brush));
  document.querySelectorAll('#palette .sw').forEach((b) => b.classList.toggle('on', b.dataset.color === color));
}

function buildPalette() {
  PALETTE.forEach((c) => {
    const b = document.createElement('button');
    b.className = 'sw';
    b.style.background = c;
    b.dataset.color = c;
    b.onclick = () => {
      color = c;
      tool = 'paint';
      $('cCustom').value = c;
      refreshTools();
    };
    $('palette').appendChild(b);
  });
}

document.querySelectorAll('#tools .chip').forEach((b) =>
  b.addEventListener('click', () => {
    tool = b.dataset.tool;
    refreshTools();
  })
);
document.querySelectorAll('#brushes .chip').forEach((b) =>
  b.addEventListener('click', () => {
    brush = Number(b.dataset.brush);
    refreshTools();
  })
);
$('cCustom').addEventListener('input', () => {
  color = $('cCustom').value;
  tool = 'paint';
  refreshTools();
});

// ===== Tampilan dan mata =====
function fillInputs() {
  $('cBody').value = look.body;
  $('cOutline').value = look.outline;
  $('eBg').value = look.eyeBg || EYE_BG_DEFAULT;
  $('eIris').value = look.eyeColor || EYE_DEFAULT;
  $('eIris2').value = look.eyeColor2 || look.eyeColor || EYE_DEFAULT;
  $('eBgNote').textContent = look.eyeBg ? '' : '(asli)';
  $('eIrisNote').textContent = look.eyeColor ? '' : '(asli)';
  $('eIris2Note').textContent = look.eyeColor2 ? '' : '(asli)';
  $('eOdd').checked = !!look.odd;
  $('eIris2row').style.display = look.odd ? '' : 'none';
}

$('cBody').addEventListener('input', () => {
  look.body = $('cBody').value;
  drawAll();
  renderPreview();
});
$('cBody').addEventListener('change', send);
$('cOutline').addEventListener('input', () => {
  look.outline = $('cOutline').value;
  drawAll();
  renderPreview();
});
$('cOutline').addEventListener('change', send);

function bindEye(id, field, resetId) {
  $(id).addEventListener('input', () => {
    look[field] = $(id).value;
    renderPreview();
  });
  $(id).addEventListener('change', () => {
    fillInputs();
    send();
  });
  $(resetId).onclick = () => {
    look[field] = null;
    fillInputs();
    renderPreview();
    send();
  };
}
bindEye('eBg', 'eyeBg', 'eBgReset');
bindEye('eIris', 'eyeColor', 'eIrisReset');
bindEye('eIris2', 'eyeColor2', 'eIris2Reset');
$('eOdd').addEventListener('change', () => {
  look.odd = $('eOdd').checked;
  fillInputs();
  renderPreview();
  send();
});

// ===== Preset =====
function normalize(l) {
  const out = clone(l);
  out.parts = out.parts || {};
  for (const key of Look.PART_KEYS) {
    const { w, h } = dims[key];
    const g = out.parts[key];
    if (!g || g.w !== w || g.h !== h || !Array.isArray(g.px) || g.px.length !== w * h) {
      out.parts[key] = { w, h, px: new Array(w * h).fill('') };
    }
  }
  return out;
}

function setLook(l, resetBase) {
  look = normalize(l);
  if (resetBase) {
    baseline = clone(look);
    history.length = 0;
  }
  fillInputs();
  drawAll();
  renderPreview();
  send();
}

function renderPresets() {
  const box = $('presets');
  box.innerHTML = '';
  Object.keys(Look.PRESETS).forEach((name) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = name[0].toUpperCase() + name.slice(1);
    b.onclick = async () => setLook(await Look.fromPreset(name), true);
    box.appendChild(b);
  });

  const m = $('mine');
  m.innerHTML = '';
  if (!mine.length) {
    m.textContent = 'Belum ada. Beri nama di kiri, lalu klik "Preset baru".';
    return;
  }
  mine.forEach((p, i) => {
    const pill = document.createElement('span');
    pill.className = 'pill';
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = p.name;
    b.onclick = () => setLook(p.look, true);
    const x = document.createElement('button');
    x.className = 'chip';
    x.textContent = 'x';
    x.title = 'Hapus preset ini';
    x.onclick = () => {
      mine.splice(i, 1);
      ipcRenderer.send('presets-set', mine);
      renderPresets();
    };
    pill.append(b, x);
    m.appendChild(pill);
  });
}

$('pSave').onclick = () => {
  const name = $('pName').value.trim() || 'Preset ' + (mine.length + 1);
  mine.push({ name, look: clone(look) });
  ipcRenderer.send('presets-set', mine);
  baseline = clone(look);
  $('pName').value = '';
  renderPresets();
};
$('bDiscard').onclick = () => {
  look = clone(baseline);
  history.length = 0;
  fillInputs();
  drawAll();
  renderPreview();
  send();
};
$('bUndo').onclick = undo;
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'z' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
    e.preventDefault();
    undo();
  }
});

// ===== Mulai =====
(async () => {
  dims = await Look.gridDims();
  sil = await Look.silhouette();
  buildGrids();
  buildPalette();
  refreshTools();
  mine = (await ipcRenderer.invoke('presets-get')) || [];
  renderPresets();

  const saved = await ipcRenderer.invoke('look-get');
  const start = saved && saved.parts ? saved : await Look.fromPreset(saved || 'hitam');
  look = normalize(start);
  baseline = clone(look);
  fillInputs();
  drawAll();
  renderPreview();
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

// ===== Catatan sematan =====
ipcRenderer.invoke('note-get').then((v) => ($('note').value = v || ''));
$('note').addEventListener('change', () => ipcRenderer.send('note-set', $('note').value));

// ===== Tab =====
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
    document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.id === 'pane-' + t.dataset.tab));
  });
});