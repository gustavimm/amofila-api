// ── PAINEL DE ESCALA ──
const SENHA_GESTOR = 'amo2025';
const BLOCOS_LABELS = {
  "08": "08:00 — Manhã",
  "09": "09:00 — Manhã",
  "10": "10:00 — Manhã",
  "11": "11:00 — 16:59",
  "17": "17:00 — Tarde",
  "18": "18:00 — Noite",
  "fora": "Fora do Expediente"
};

let escalaEditavel = {};
let todosVendedores = [];

function abrirEscala() {
  document.getElementById('overlay-escala').classList.add('ativo');
  document.getElementById('escala-senha-wrap').style.display = 'flex';
  document.getElementById('escala-editor-wrap').style.display = 'none';
  document.getElementById('input-senha').value = '';
  setTimeout(() => document.getElementById('input-senha').focus(), 100);
}

function fecharEscala() {
  document.getElementById('overlay-escala').classList.remove('ativo');
  escalaEditavel = {};
}

function confirmarSenha() {
  const senha = document.getElementById('input-senha').value;
  if (senha !== SENHA_GESTOR) {
    const inp = document.getElementById('input-senha');
    inp.classList.add('erro');
    setTimeout(() => inp.classList.remove('erro'), 400);
    return;
  }
  fetch('/escala')
    .then(r => r.json())
    .then(d => {
      todosVendedores = d.todos;
      escalaEditavel = {};
      for (const chave in d.escala) {
        escalaEditavel[chave] = [...d.escala[chave]];
      }
      document.getElementById('escala-senha-wrap').style.display = 'none';
      document.getElementById('escala-editor-wrap').style.display = 'flex';
      renderBlocosEscala();
    });
}

function renderBlocosEscala() {
  const container = document.getElementById('blocos-escala');
  container.innerHTML = Object.keys(BLOCOS_LABELS).map(chave => {
    const ativos = escalaEditavel[chave] || [];
    const chips = todosVendedores.map(nome => {
      const ativo = ativos.includes(nome);
      return `<div class="escala-chip ${ativo ? 'ativo' : ''}">
        ${nome}
        <button class="escala-chip-toggle" onclick="toggleVendedorEscala('${chave}','${nome}')">
          ${ativo ? '×' : '+'}
        </button>
      </div>`;
    }).join('');
    return `<div class="escala-bloco">
      <p class="escala-bloco-titulo">${BLOCOS_LABELS[chave]}</p>
      <div class="escala-vendedores">${chips}</div>
    </div>`;
  }).join('');
}

function toggleVendedorEscala(chave, nome) {
  if (!escalaEditavel[chave]) escalaEditavel[chave] = [];
  const idx = escalaEditavel[chave].indexOf(nome);
  if (idx === -1) escalaEditavel[chave].push(nome);
  else escalaEditavel[chave].splice(idx, 1);
  renderBlocosEscala();
}

function salvarEscala() {
  fetch('/salvar-escala', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ novaEscala: escalaEditavel })
  }).then(r => r.json()).then(d => {
    if (d.success) { toast('ESCALA SALVA ✓'); fecharEscala(); buscarVez(); }
    else alert('Erro ao salvar: ' + d.message);
  });
}