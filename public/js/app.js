// ── STATE ──
let vendedorAnterior = "";
let filaAtualGlobal  = [];
let inicioVez        = parseInt(localStorage.getItem('amofila_inicio_vez') || Date.now());

// ── RELÓGIO ──
(function tick() {
  document.getElementById('relogio').textContent =
    new Date().toLocaleTimeString('pt-BR', { hour12: false });
  setTimeout(tick, 1000);
})();

// ── CRONÔMETRO ──
function resetarCronometro() {
  inicioVez = Date.now();
  localStorage.setItem('amofila_inicio_vez', inicioVez);
  localStorage.setItem('amofila_vendedor_vez', vendedorAnterior);
}

(function tickCrono() {
  const seg = Math.floor((Date.now() - inicioVez) / 1000);
  const el  = document.getElementById('cronometro');
  el.textContent = String(Math.floor(seg/60)).padStart(2,'0') + ':' + String(seg%60).padStart(2,'0');
  el.className   = seg > 600 ? 'critico' : seg > 300 ? 'urgente' : '';
  setTimeout(tickCrono, 1000);
})();

// ── TOAST ──
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

// ── RENDER FILA (chips) ──
function renderFila(lista, atual) {
  const el = document.getElementById('lista-fila');
  if (!lista?.length) { el.innerHTML = '<p class="vazio">FILA VAZIA</p>'; return; }
  const idx = lista.indexOf(atual);
  const ord = idx !== -1 ? [...lista.slice(idx), ...lista.slice(0, idx)] : lista;
  el.innerHTML = ord.map((nome, i) => `
    <div class="fila-chip ${i === 0 ? 'atual' : ''}">
      <span class="fila-pos-num">${i + 1}</span>
      ${nome}
    </div>`).join('');
}

// ── RENDER PLACAR ──
function renderPlacar(hist) {
  const el  = document.getElementById('lista-placar');
  const cnt = {};
  hist.filter(v => v.nome && v.nome !== 'undefined').forEach(v => { cnt[v.nome] = (cnt[v.nome] || 0) + 1; });
  const ord = Object.entries(cnt).sort((a,b) => b[1]-a[1]);
  if (!ord.length) { el.innerHTML = '<p class="vazio">SEM VENDAS AINDA</p>'; return; }
  const max = ord[0][1];
  el.innerHTML = ord.map(([nome, qtd], i) => `
    <div class="placar-row ${i === 0 ? 'lider' : ''}">
      <span class="placar-rank">${i + 1}</span>
      <span class="placar-nome">${nome}</span>
      <div class="placar-bar-track">
        <div class="placar-bar-fill" style="width:${Math.round(qtd/max*100)}%"></div>
      </div>
      <span class="placar-count">${qtd}</span>
    </div>`).join('');
}

// ── RENDER HISTÓRICO ──
function renderHistorico(hist) {
  const el = document.getElementById('scroll-historico');
  if (!hist.length) { el.innerHTML = '<p class="vazio">NENHUM REGISTRO</p>'; return; }
  hist = hist.filter(v => v.nome && v.nome !== 'undefined');
  if (!hist.length) { el.innerHTML = '<p class="vazio">NENHUM REGISTRO</p>'; return; }
  el.innerHTML = hist.map((v, i) => `
    <div class="hist-row">
      <div class="hist-info">
        <span class="hist-nome">${v.nome}</span>
        <span class="hist-hora">${v.hora}</span>
      </div>
      <button class="btn-del" onclick="excluirVenda(${i})">×</button>
    </div>`).join('');
  renderPlacar(hist);
}

// ── RENDER AUSENTES ──
function renderAusentes(lista) {
  const el = document.getElementById('lista-ausentes');
  if (!lista?.length) { el.innerHTML = ''; return; }
  el.innerHTML = lista.map(n => `
    <div class="ausente-chip">
      <span class="ausente-nome">${n}</span>
      <button class="btn-retornar" onclick="retornar('${n}')">RETORNAR</button>
    </div>`).join('');
}

function popularSelect(lista) {
  const sel = document.getElementById('select-ausente');
  const val = sel.value;
  sel.innerHTML = '<option value="">Marcar ausente...</option>' +
    lista.map(n => `<option value="${n}"${n===val?' selected':''}>${n}</option>`).join('');
}

// ── BUSCAR VEZ ──
function buscarVez() {
  fetch('/vez')
    .then(r => r.json())
    .then(d => {
      const vendedorSalvo = localStorage.getItem('amofila_vendedor_vez') || '';
      const mudou = vendedorAnterior !== '' && vendedorAnterior !== d.vendedor;

      if (mudou) {
        const som = document.getElementById('som');
        som.volume = 0.35;
        som.play().catch(()=>{});
        resetarCronometro();
      } else if (vendedorAnterior === '' && vendedorSalvo !== d.vendedor) {
        resetarCronometro();
      }

      vendedorAnterior = d.vendedor;

      const nomeEl = document.getElementById('nome-vez');
      if (nomeEl.textContent !== d.vendedor) {
        nomeEl.classList.remove('trocando');
        void nomeEl.offsetWidth;
        nomeEl.classList.add('trocando');
        setTimeout(() => { nomeEl.textContent = d.vendedor; }, 150);
      }

      document.getElementById('tv-nome').textContent   = d.vendedor;
      document.getElementById('horario-val').textContent = d.horario;

      const badge = document.getElementById('horario-badge');
      badge.style.borderColor = d.foraDaEscala ? 'rgba(255,184,0,0.4)' : '';
      badge.style.color       = d.foraDaEscala ? 'var(--amber)' : '';

      if (d.filaAtual) {
        filaAtualGlobal = d.filaAtual;
        renderFila(d.filaAtual, d.vendedor);
        if (!ordemAlterada) renderDragList(d.filaAtual);
        popularSelect(d.filaAtual);
      }

      fetch('/historico').then(r => r.json()).then(renderHistorico).catch(()=>{});
      fetch('/ausentes').then(r => r.json()).then(d => renderAusentes(d.ausentes)).catch(()=>{});
    })
    .catch(()=>{});
}

// ── AÇÕES ──
function proximaVenda() {
  fetch('/proximo', { method: 'POST' })
    .then(r => r.json())
    .then(d => { if (d.success) { toast('VENDA REGISTRADA ✓'); buscarVez(); } });
}

function voltarVez() {
  if (!confirm('Desfazer a última venda e devolver a vez?')) return;
  fetch('/voltar-vez', { method: 'POST' })
    .then(r => r.json())
    .then(d => {
      if (d.success) { toast('DESFEITO ↩'); buscarVez(); }
      else alert('Não é possível voltar mais.');
    });
}

function excluirVenda(i) {
  if (!confirm('Remover este registro?')) return;
  fetch('/excluir-venda', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index: i })
  }).then(r => r.json()).then(d => { if (d.success) { toast('REMOVIDO'); buscarVez(); } });
}

function confirmarAusente() {
  const v = document.getElementById('select-ausente').value;
  if (!v) return;
  fetch('/ausente', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendedor: v })
  }).then(r => r.json()).then(d => {
    if (d.success) { toast(`${v} — AUSENTE`); renderAusentes(d.ausentes); buscarVez(); }
  });
}

function retornar(nome) {
  fetch('/retornar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendedor: nome })
  }).then(r => r.json()).then(d => {
    if (d.success) { toast(`${nome} — RETORNOU ✓`); renderAusentes(d.ausentes); buscarVez(); }
  });
}

// ── MODO TV ──
function abrirTV() {
  document.getElementById('overlay-tv').classList.add('ativo');
  document.addEventListener('keydown', _tvKey);
}
function fecharTV() {
  document.getElementById('overlay-tv').classList.remove('ativo');
  document.removeEventListener('keydown', _tvKey);
}
function _tvKey(e) { if (e.key === 'Escape') fecharTV(); }


// ── RESET DIÁRIO NO FRONTEND ──
function agendarResetFrontend() {
  const agora = new Date();
  const amanha = new Date();
  amanha.setFullYear(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
  amanha.setHours(0, 0, 0, 0);

  const msAteMeiaNoite = amanha - agora;

  setTimeout(() => {
    localStorage.removeItem('amofila_inicio_vez');
    localStorage.removeItem('amofila_vendedor_vez');
    inicioVez = Date.now();
    vendedorAnterior = '';
    buscarVez();
    agendarResetFrontend();
  }, msAteMeiaNoite);
}

agendarResetFrontend();

// ── INIT ──
buscarVez();
fetch('/ausentes').then(r => r.json()).then(d => renderAusentes(d.ausentes)).catch(()=>{});
setInterval(buscarVez, 5000);