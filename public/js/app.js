// ── CONFIGURAÇÕES E ESTADO CENTRALIZADO ──
const AmoFila = {
  state: {
    vendedorAnterior: "",
    filaAtualGlobal: [],
    inicioVez: parseInt(localStorage.getItem('amofila_inicio_vez') || Date.now()),
    isDragging: false, // Evita corrida de dados no polling
    pollingTimer: null
  },

  // Seletores do DOM em cache (Evita buscas repetidas na árvore do DOM)
  dom: {
    relogio: document.getElementById('relogio'),
    cronometro: document.getElementById('cronometro'),
    listaFila: document.getElementById('lista-fila'),
    listaPlacar: document.getElementById('lista-placar'),
    historico: document.getElementById('scroll-historico'),
    listaAusentes: document.getElementById('lista-ausentes'),
    selectAusente: document.getElementById('select-ausente'),
    nomeVez: document.getElementById('nome-vez'),
    tvNome: document.getElementById('tv-nome'),
    horarioVal: document.getElementById('horario-val'),
    horarioBadge: document.getElementById('horario-badge'),
    btnSalvarOrdem: document.getElementById('btn-salvar-ordem'),
    som: document.getElementById('som')
  },

  init() {
    this.initClock();
    this.initCronometro();
    this.buscarVez();
    this.startPolling();
    this.agendarResetFrontend();
  },

  // ── GERENCIAMENTO DO POLLING ──
  startPolling() {
    if (this.state.pollingTimer) clearInterval(this.state.pollingTimer);
    this.state.pollingTimer = setInterval(() => {
      if (!this.state.isDragging) this.buscarVez();
    }, 5000);
  },

  pausePolling() {
    clearInterval(this.state.pollingTimer);
  }
};

// ── RECURSOS DE RELÓGIO E TEMPO ──
AmoFila.initClock = function() {
  const updateClock = () => {
    this.dom.relogio.textContent = new Date().toLocaleTimeString('pt-BR', { hour12: false });
  };
  updateClock();
  setInterval(updateClock, 1000);
};

AmoFila.initCronometro = function() {
  const updateCrono = () => {
    const seg = Math.floor((Date.now() - this.state.inicioVez) / 1000);
    const minStr = String(Math.floor(seg / 60)).padStart(2, '0');
    const segStr = String(seg % 60).padStart(2, '0');
    
    this.dom.cronometro.textContent = `${minStr}:${segStr}`;
    this.dom.cronometro.className = seg > 600 ? 'critico' : seg > 300 ? 'urgente' : '';
  };
  updateCrono();
  setInterval(updateCrono, 1000);
};

AmoFila.resetarCronometro = function(novoVendedor) {
  this.state.inicioVez = Date.now();
  localStorage.setItem('amofila_inicio_vez', this.state.inicioVez);
  localStorage.setItem('amofila_vendedor_vez', novoVendedor ?? this.state.vendedorAnterior);
};

// ── UI / RENDERS ──
AmoFila.toast = function(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
};

AmoFila.renderFila = function(lista, atual) {
  if (!lista?.length) { 
    this.dom.listaFila.innerHTML = '<p class="vazio">FILA VAZIA</p>'; 
    return; 
  }
  const idx = lista.indexOf(atual);
  const ord = idx !== -1 ? [...lista.slice(idx), ...lista.slice(0, idx)] : lista;

  this.dom.listaFila.innerHTML = ord.map((nome, i) => `
    <div class="fila-chip ${i === 0 ? 'atual' : ''}">
      <span class="fila-pos-num">${i + 1}</span>
      ${nome}
    </div>`).join('');
};

AmoFila.renderPlacar = function(hist) {
  const cnt = {};
  hist.filter(v => v.nome && v.nome !== 'undefined')
      .forEach(v => { cnt[v.nome] = (cnt[v.nome] || 0) + 1; });
      
  const ord = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
  if (!ord.length) { 
    this.dom.listaPlacar.innerHTML = '<p class="vazio">SEM VENDAS AINDA</p>'; 
    return; 
  }
  
  const max = ord[0][1];
  this.dom.listaPlacar.innerHTML = ord.map(([nome, qtd], i) => `
    <div class="placar-row ${i === 0 ? 'lider' : ''}">
      <span class="placar-rank">${i + 1}</span>
      <span class="placar-nome">${nome}</span>
      <div class="placar-bar-track">
        <div class="placar-bar-fill" style="width:${Math.round(qtd / max * 100)}%"></div>
      </div>
      <span class="placar-count">${qtd}</span>
    </div>`).join('');
};

AmoFila.renderHistorico = function(hist) {
  hist = hist.filter(v => v.nome && v.nome !== 'undefined');
  if (!hist.length) { 
    this.dom.historico.innerHTML = '<p class="vazio">NENHUM REGISTRO</p>'; 
    return; 
  }
  
  this.dom.historico.innerHTML = hist.map((v, i) => `
    <div class="hist-row">
      <div class="hist-info">
        <span class="hist-nome">${v.nome}</span>
        <span class="hist-hora">${v.hora}</span>
      </div>
      <button class="btn-del" onclick="AmoFila.excluirVenda(${i})">×</button>
    </div>`).join('');
    
  this.renderPlacar(hist);
};

AmoFila.renderAusentes = function(lista) {
  if (!lista?.length) { this.dom.listaAusentes.innerHTML = ''; return; }
  this.dom.listaAusentes.innerHTML = lista.map(n => `
    <div class="ausente-chip">
      <span class="ausente-nome">${n}</span>
      <button class="btn-retornar" onclick="AmoFila.retornar('${n}')">RETORNAR</button>
    </div>`).join('');
};

AmoFila.popularSelect = function(lista) {
  const val = this.dom.selectAusente.value;
  this.dom.selectAusente.innerHTML = '<option value="">Marcar ausente...</option>' +
    lista.map(n => `<option value="${n}"${n === val ? ' selected' : ''}>${n}</option>`).join('');
};

// ── REQUISIÇÕES DA API ──
AmoFila.buscarVez = async function() {
  try {
    const r = await fetch('/vez');
    const d = await r.json();
    
    const vendedorSalvo = localStorage.getItem('amofila_vendedor_vez') || '';
    const mudou = this.state.vendedorAnterior !== '' && this.state.vendedorAnterior !== d.vendedor;

    if (mudou) {
      this.dom.som.volume = 0.35;
      this.dom.som.play().catch(() => {});
      this.resetarCronometro(d.vendedor);
    } else if (this.state.vendedorAnterior === '' && vendedorSalvo !== d.vendedor) {
      this.resetarCronometro(d.vendedor);
    }

    this.state.vendedorAnterior = d.vendedor;

    if (this.dom.nomeVez.textContent !== d.vendedor) {
      this.dom.nomeVez.classList.remove('trocando');
      void this.dom.nomeVez.offsetWidth;
      this.dom.nomeVez.classList.add('trocando');
      setTimeout(() => { this.dom.nomeVez.textContent = d.vendedor; }, 150);
    }

    this.dom.tvNome.textContent = d.vendedor;
    this.dom.horarioVal.textContent = d.horario;
    this.dom.horarioBadge.style.borderColor = d.foraDaEscala ? 'rgba(255,184,0,0.4)' : '';
    this.dom.horarioBadge.style.color = d.foraDaEscala ? 'var(--amber)' : '';

    // [TRECHO ATUALIZADO]: Sincroniza o cronômetro com o timestamp oficial do servidor
    if (d.inicioVezTimestamp) {
      this.state.inicioVez = d.inicioVezTimestamp;
      localStorage.setItem('amofila_inicio_vez', d.inicioVezTimestamp);
    }

    if (d.filaAtual) {
      this.state.filaAtualGlobal = d.filaAtual;
      this.renderFila(d.filaAtual, d.vendedor);
      
      if (!this.state.isDragging && typeof renderDragList === 'function') {
        renderDragList(d.filaAtual);
      }
      this.popularSelect(d.filaAtual);
    }

    Promise.all([
      fetch('/historico').then(r => r.json()).then(h => this.renderHistorico(h)),
      fetch('/ausentes').then(r => r.json()).then(a => this.renderAusentes(a.ausentes))
    ]).catch(() => {});

  } catch (err) {
    console.error("Erro ao buscar dados da vez:", err);
  }
};

// ── BOTÕES DE AÇÃO ──
AmoFila.proximaVenda = function() {
  fetch('/proximo', { method: 'POST' })
    .then(r => r.json())
    .then(d => {
      if (d.success) { this.toast('VENDA REGISTRADA ✓'); this.buscarVez(); }
      else this.toast('FILA VAZIA — NINGUÉM NA VEZ');
    });
};

AmoFila.voltarVez = function() {
  if (!confirm('Desfazer a última venda e devolver a vez?')) return;
  fetch('/voltar-vez', { method: 'POST' })
    .then(r => r.json())
    .then(d => {
      if (d.success) { this.toast('DESFEITO ↩'); this.buscarVez(); }
      else alert('Não é possível voltar mais.');
    });
};

// [TRECHO ATUALIZADO]: Adicionado header com senha do gestor
AmoFila.excluirVenda = function(i) {
  if (!confirm('Remover este registro?')) return;
  fetch('/excluir-venda', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Manager-Password': 'amo2025'
    },
    body: JSON.stringify({ index: i })
  }).then(r => r.json()).then(d => { if (d.success) { this.toast('REMOVIDO'); this.buscarVez(); } });
};

AmoFila.confirmarAusente = function() {
  const v = this.dom.selectAusente.value;
  if (!v) return;
  fetch('/ausente', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendedor: v })
  }).then(r => r.json()).then(d => {
    if (d.success) { this.toast(`${v} — AUSENTE`); this.renderAusentes(d.ausentes); this.buscarVez(); }
  });
};

AmoFila.retornar = function(nome) {
  fetch('/retornar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendedor: nome })
  }).then(r => r.json()).then(d => {
    if (d.success) { this.toast(`${nome} — RETORNOU ✓`); this.renderAusentes(d.ausentes); this.buscarVez(); }
  });
};

// ── EXTENSÕES INTERFACE (TV / RESET) ──
function abrirTV() { document.getElementById('overlay-tv').classList.add('ativo'); document.addEventListener('keydown', _tvKey); }
function fecharTV() { document.getElementById('overlay-tv').classList.remove('ativo'); document.removeEventListener('keydown', _tvKey); }
function _tvKey(e) { if (e.key === 'Escape') fecharTV(); }

AmoFila.agendarResetFrontend = function() {
  const agora = new Date();
  const amanha = new Date();
  amanha.setFullYear(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
  amanha.setHours(0, 0, 0, 0);

  setTimeout(() => {
    localStorage.removeItem('amofila_inicio_vez');
    localStorage.removeItem('amofila_vendedor_vez');
    this.state.inicioVez = Date.now();
    this.state.vendedorAnterior = '';
    this.buscarVez();
    this.agendarResetFrontend();
  }, amanha - agora);
};

document.addEventListener('DOMContentLoaded', () => AmoFila.init());