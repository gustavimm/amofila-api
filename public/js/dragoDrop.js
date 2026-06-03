// ── DRAG AND DROP — ORDENAR FILA ──
let ordemDrag = [], dragSrc = null, ordemAlterada = false;

function renderDragList(lista) {
  ordemDrag = [...lista];
  ordemAlterada = false;
  document.getElementById('btn-salvar-ordem').classList.remove('visivel');
  _buildDragList();
}

function _buildDragList() {
  const el = document.getElementById('lista-drag');
  if (!ordemDrag.length) { el.innerHTML = '<p class="vazio">FILA VAZIA</p>'; return; }

  el.innerHTML = ordemDrag.map((nome, i) => `
    <div class="drag-item" draggable="true" data-index="${i}">
      <div class="drag-handle"><span></span><span></span><span></span></div>
      <span class="drag-pos">${i + 1}</span>
      <span class="drag-nome">${nome}</span>
      ${i === 0 ? '<span class="drag-now">VEZ</span>' : ''}
    </div>`).join('');

  el.querySelectorAll('.drag-item').forEach(item => {
    item.addEventListener('dragstart', _onDragStart);
    item.addEventListener('dragover',  _onDragOver);
    item.addEventListener('drop',      _onDrop);
    item.addEventListener('dragend',   _onDragEnd);
    item.addEventListener('touchstart', _onTouchStart, { passive: true });
    item.addEventListener('touchmove',  _onTouchMove,  { passive: false });
    item.addEventListener('touchend',   _onTouchEnd);
  });
}

// Desktop
function _onDragStart(e) {
  dragSrc = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function _onDragOver(e) {
  e.preventDefault();
  document.querySelectorAll('.drag-item').forEach(i => i.classList.remove('drag-over'));
  this.classList.add('drag-over');
}
function _onDrop(e) {
  e.preventDefault();
  if (dragSrc === this) return;
  const from = parseInt(dragSrc.dataset.index);
  const to   = parseInt(this.dataset.index);
  ordemDrag.splice(to, 0, ordemDrag.splice(from, 1)[0]);
  ordemAlterada = true;
  _buildDragList();
  document.getElementById('btn-salvar-ordem').classList.add('visivel');
}
function _onDragEnd() {
  document.querySelectorAll('.drag-item').forEach(i => i.classList.remove('dragging','drag-over'));
}

// Mobile touch
let _touchItem = null, _touchClone = null, _touchFromIdx = null;

function _onTouchStart(e) {
  _touchItem    = this;
  _touchFromIdx = parseInt(this.dataset.index);
  const t = e.touches[0];
  _touchClone = this.cloneNode(true);
  _touchClone.style.cssText = `
    position:fixed; z-index:9999; pointer-events:none; opacity:0.85;
    width:${this.offsetWidth}px; left:${this.getBoundingClientRect().left}px;
    top:${t.clientY - this.offsetHeight/2}px;
    border:1px solid var(--green); background:var(--surface2);
    border-radius:8px; transform:scale(1.03);`;
  document.body.appendChild(_touchClone);
  this.classList.add('dragging');
}
function _onTouchMove(e) {
  e.preventDefault();
  const t = e.touches[0];
  if (_touchClone) _touchClone.style.top = (t.clientY - _touchClone.offsetHeight/2) + 'px';
  document.querySelectorAll('.drag-item').forEach(i => i.classList.remove('drag-over'));
  const over = document.elementFromPoint(t.clientX, t.clientY)?.closest('.drag-item');
  if (over && over !== _touchItem) over.classList.add('drag-over');
}
function _onTouchEnd(e) {
  if (_touchClone) { _touchClone.remove(); _touchClone = null; }
  document.querySelectorAll('.drag-item').forEach(i => i.classList.remove('dragging','drag-over'));
  const t      = e.changedTouches[0];
  const target = document.elementFromPoint(t.clientX, t.clientY)?.closest('.drag-item');
  if (target && target !== _touchItem) {
    const to = parseInt(target.dataset.index);
    ordemDrag.splice(to, 0, ordemDrag.splice(_touchFromIdx, 1)[0]);
    ordemAlterada = true;
    _buildDragList();
    document.getElementById('btn-salvar-ordem').classList.add('visivel');
  }
  _touchItem = null; _touchFromIdx = null;
}

function salvarOrdemDrag() {
  if (!ordemAlterada) return;
  fetch('/salvar-ordem-exata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ novaOrdem: ordemDrag })
  }).then(r => r.json()).then(d => {
    if (d.success) {
      toast('ORDEM SALVA ✓');
      ordemAlterada = false;
      document.getElementById('btn-salvar-ordem').classList.remove('visivel');
      buscarVez();
    }
  });
}