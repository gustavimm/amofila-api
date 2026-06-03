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

  // Seção de resets no topo do editor
  const htmlResets = `
    <div style="padding: 16px 22px; border-bottom: 1px solid var(--border); display: flex; gap: 8px;">
      <button onclick="resetAusentes()" style="
        flex:1; padding:11px; background:none;
        border:1px solid rgba(255,184,0,0.3); color:var(--amber);
        border-radius:8px; font-family:var(--mono); font-size:10px;
        font-weight:700; letter-spacing:2px; text-transform:uppercase;
        cursor:pointer; transition:all 0.15s;">
        ↩ RESETAR AUSENTES
      </button>
      <button onclick="resetGeral()" style="
        flex:1; padding:11px; background:none;
        border:1px solid rgba(255,59,59,0.3); color:var(--red);
        border-radius:8px; font-family:var(--mono); font-size:10px;
        font-weight:700; letter-spacing:2px; text-transform:uppercase;
        cursor:pointer; transition:all 0.15s;">
        ⚠ RESET GERAL
      </button>
    </div>`;

  container.innerHTML = htmlResets + Object.keys(BLOCOS_LABELS).map(chave => {
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

function resetAusentes() {
  if (!confirm('Devolver todos os ausentes para a fila?')) return;
  fetch('/reset-ausentes')
    .then(r => r.json ? r : r)
    .then(() => { toast('AUSENTES RESETADOS ✓'); fecharEscala(); buscarVez(); });
}

function resetGeral() {
  if (!confirm('⚠️ RESET GERAL — apaga histórico, placar e reinicia a fila do zero. Tem certeza?')) return;
  fetch('/reset-geral')
    .then(() => { toast('SISTEMA RESETADO ✓'); fecharEscala(); buscarVez(); });
}