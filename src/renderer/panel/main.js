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