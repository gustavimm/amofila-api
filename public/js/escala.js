// ── PAINEL DO GESTOR ──
const SENHA_GESTOR = 'amo2025';
const BLOCOS_LABELS = {
  "08": "08:00 — Gustavo, Isabella, Lavinia",
  "09": "09:00 — Luis, Tifani, Amanda",
  "10": "10:00 — Lucas, Ana Carolina",
  "11": "11:00 às 16:59 — Todos",
  "17": "17:00 — Luis, Tifani, Amanda, Lucas, Ana Carolina",
  "18": "18:00 — Lucas, Ana Carolina"
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
      for (const chave in d.filaAtual) {
        escalaEditavel[chave] = [...d.filaAtual[chave]];
      }
      // Garante que todos os blocos existem
      for (const chave in d.blocos) {
        if (!escalaEditavel[chave]) escalaEditavel[chave] = [...d.blocos[chave]];
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
    else alert('Erro ao salvar: ' + (d.message || ''));
  });
}

function resetAusentes() {
  if (!confirm('Devolver todos os ausentes para a fila?')) return;
  fetch('/reset-ausentes')
    .then(r => r.json())
    .then(() => { toast('AUSENTES RESETADOS ✓'); fecharEscala(); buscarVez(); });
}

function resetGeral() {
  if (!confirm('⚠️ RESET GERAL — apaga histórico, placar e reinicia tudo. Tem certeza?')) return;
  fetch('/reset-geral')
    .then(r => r.json())
    .then(() => { toast('SISTEMA RESETADO ✓'); fecharEscala(); buscarVez(); });
}