const express = require('express');
const fs      = require('fs');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 3000;

// ── VENDEDORES POR TURNO ──
const VENDEDORES = {
  manha1: ["Gustavo", "Isabella", "Lavinia"],
  manha2: ["Luis", "Tifani", "Amanda"],
  manha3: ["Lucas", "Ana Carolina"],
  todos:  ["Gustavo", "Isabella", "Lavinia", "Luis", "Tifani", "Amanda", "Lucas", "Ana Carolina"],
  tarde:  ["Luis", "Tifani", "Amanda", "Lucas", "Ana Carolina"],
  noite:  ["Lucas", "Ana Carolina"],
};

// ── PERSISTÊNCIA ──
const ARQUIVO_ESTADO = path.join(__dirname, 'estado.json');

function carregarEstado() {
  try {
    if (fs.existsSync(ARQUIVO_ESTADO)) {
      const estado = JSON.parse(fs.readFileSync(ARQUIVO_ESTADO, 'utf8'));
      console.log('✅ Estado restaurado do disco.');
      return estado;
    }
  } catch (err) {
    console.warn('⚠️ Erro ao ler estado.json:', err.message);
  }
  return null;
}

function salvarEstado() {
  try {
    fs.writeFileSync(ARQUIVO_ESTADO, JSON.stringify({
      indiceFila,
      ultimoBloco,
      historicoVendas,
      vendedoresAusentes,
      filaAtual,
      vezPausada, // ⬅ guarda quem estava na vez antes do "retornado" entrar
    }, null, 2));
  } catch (err) {
    console.error('❌ Erro ao salvar estado:', err.message);
  }
}

// ── ESTADO INICIAL ──
const estadoSalvo = carregarEstado();

let indiceFila         = estadoSalvo?.indiceFila         ?? 0;
let ultimoBloco        = estadoSalvo?.ultimoBloco        ?? "";
let historicoVendas    = estadoSalvo?.historicoVendas    ?? [];
let vendedoresAusentes = estadoSalvo?.vendedoresAusentes ?? [];
let filaAtual          = estadoSalvo?.filaAtual          ?? {};
let vezPausada         = estadoSalvo?.vezPausada         ?? null;
// vezPausada = { vendedorOriginal: "Amanda", chave: "11" }
// Significa: "tem alguém retornado na frente, mas depois que ele pegar
//             a venda, a vez deve voltar pra Amanda"

// Reaplica ausentes nas filas salvas
if (vendedoresAusentes.length > 0) {
  for (const chave in filaAtual) {
    filaAtual[chave] = filaAtual[chave].filter(v => !vendedoresAusentes.includes(v));
  }
}

app.use(express.static('public'));
app.use(express.json());

// ── HELPERS ──
function getChaveAtual(horaReal) {
  if (horaReal === 8)                  return "08";
  if (horaReal === 9)                  return "09";
  if (horaReal === 10)                 return "10";
  if (horaReal >= 11 && horaReal < 17) return "11";
  if (horaReal === 17)                 return "17";
  if (horaReal === 18)                 return "18";
  return "fora";
}

function getListaBase(chave) {
  switch(chave) {
    case "08": return VENDEDORES.manha1;
    case "09": return VENDEDORES.manha2;
    case "10": return VENDEDORES.manha3;
    case "11": return VENDEDORES.todos;
    case "17": return VENDEDORES.tarde;
    case "18": return VENDEDORES.noite;
    default:   return [];
  }
}

// Garante que a fila daquele bloco existe — se não existe, cria com a base
function getFilaDoBloco(chave) {
  if (!filaAtual[chave]) {
    filaAtual[chave] = getListaBase(chave).filter(v => !vendedoresAusentes.includes(v));
    salvarEstado();
  }
  return filaAtual[chave];
}

function getEstadoAtual() {
  const agora        = new Date();
  const horaBrasilia = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false });
  const horaReal     = parseInt(horaBrasilia);
  const horaLog      = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const chaveEscala  = getChaveAtual(horaReal);
  const lista        = getFilaDoBloco(chaveEscala);
  const vendedor     = lista.length > 0 ? lista[indiceFila % lista.length] : null;

  return { chaveEscala, lista, vendedor, horaBrasilia, horaLog };
}

// ── ROTAS ──

app.get('/vez', (req, res) => {
  const { chaveEscala, lista, vendedor, horaBrasilia } = getEstadoAtual();

  // Virada de bloco — ajusta índice proporcionalmente
  if (ultimoBloco !== "" && ultimoBloco !== chaveEscala) {
    indiceFila = lista.length > 0 ? indiceFila % lista.length : 0;
    salvarEstado();
  }
  ultimoBloco = chaveEscala;

  res.json({
    vendedor:     vendedor || "—",
    horario:      `${horaBrasilia}:00`,
    filaAtual:    lista,
    foraDaEscala: chaveEscala === "fora",
    chaveAtual:   chaveEscala,
  });
});

app.get('/historico', (req, res) => res.json(historicoVendas));
app.get('/ausentes',  (req, res) => res.json({ ausentes: vendedoresAusentes }));

app.get('/escala', (req, res) => {
  res.json({
    filaAtual,
    todos: VENDEDORES.todos,
    blocos: {
      "08": VENDEDORES.manha1,
      "09": VENDEDORES.manha2,
      "10": VENDEDORES.manha3,
      "11": VENDEDORES.todos,
      "17": VENDEDORES.tarde,
      "18": VENDEDORES.noite,
    }
  });
});

// ── PEGAR VENDA ──
app.post('/proximo', (req, res) => {
  const { lista, vendedor, horaLog, chaveEscala } = getEstadoAtual();

  if (!vendedor || lista.length === 0) {
    return res.json({ success: false, message: "Nenhum vendedor na fila." });
  }

  // Registra a venda
  historicoVendas.unshift({ nome: vendedor, hora: horaLog, bloco: chaveEscala });
  if (historicoVendas.length > 50) historicoVendas.pop();

  // ── LÓGICA DO RETORNO DE ALMOÇO ──
  // Se quem acabou de pegar venda é o vendedor "retornado" (está na posição 0),
  // a vez deve VOLTAR pra quem estava antes do retorno
  if (vezPausada && vezPausada.chave === chaveEscala && vezPausada.vendedorOriginal !== vendedor) {
    // Remove o retornado da posição atual
    filaAtual[chaveEscala] = lista.filter(v => v !== vendedor);
    // Adiciona o retornado no final
    filaAtual[chaveEscala].push(vendedor);
    // Coloca o índice de volta no vendedor original
    const novaPos = filaAtual[chaveEscala].indexOf(vezPausada.vendedorOriginal);
    indiceFila = novaPos !== -1 ? novaPos : 0;
    vezPausada = null;
  } else {
    // Comportamento normal — avança o índice
    indiceFila++;
  }

  salvarEstado();
  res.json({ success: true });
});

app.post('/voltar-vez', (req, res) => {
  if (indiceFila > 0) {
    indiceFila--;
    if (historicoVendas.length > 0) historicoVendas.shift();
    salvarEstado();
    res.json({ success: true });
  } else {
    res.json({ success: false, message: "Já estamos no início da fila." });
  }
});

app.post('/excluir-venda', (req, res) => {
  const { index } = req.body;
  if (index !== undefined && index >= 0 && index < historicoVendas.length) {
    historicoVendas.splice(index, 1);
    salvarEstado();
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// ── MARCAR AUSENTE ──
app.post('/ausente', (req, res) => {
  const { vendedor } = req.body;
  if (!vendedor) return res.json({ success: false, message: "Vendedor não informado." });

  if (!vendedoresAusentes.includes(vendedor)) {
    vendedoresAusentes.push(vendedor);
  }

  for (const chave in filaAtual) {
    filaAtual[chave] = filaAtual[chave].filter(v => v !== vendedor);
  }

  const { lista } = getEstadoAtual();
  indiceFila = lista.length > 0 ? indiceFila % lista.length : 0;

  salvarEstado();
  res.json({ success: true, ausentes: vendedoresAusentes });
});

// ── RETORNAR DO ALMOÇO ──
// Vai pra posição 1 (vez) e guarda quem estava antes
app.post('/retornar', (req, res) => {
  const { vendedor } = req.body;
  if (!vendedor) return res.json({ success: false, message: "Vendedor não informado." });

  vendedoresAusentes = vendedoresAusentes.filter(v => v !== vendedor);

  const { chaveEscala, lista, vendedor: vendedorAtual } = getEstadoAtual();

  // Insere em todas as filas onde o vendedor deveria estar
  for (const chave in filaAtual) {
    const listaBase = getListaBase(chave);
    if (!listaBase.includes(vendedor)) continue;
    if (filaAtual[chave].includes(vendedor)) continue;

    if (chave === chaveEscala) {
      // No bloco atual: insere NA POSIÇÃO 1 (vez)
      const novaFila = [...filaAtual[chave]];
      const posVez = lista.length > 0 ? indiceFila % lista.length : 0;
      novaFila.splice(posVez, 0, vendedor);
      filaAtual[chave] = novaFila;

      // GUARDA quem estava na vez antes — pra voltar depois que o retornado pegar venda
      vezPausada = { vendedorOriginal: vendedorAtual, chave: chaveEscala };
    } else {
      // Outros blocos: insere no final
      filaAtual[chave].push(vendedor);
    }
  }

  salvarEstado();
  res.json({ success: true, ausentes: vendedoresAusentes });
});

// ── ORDENAR FILA MANUALMENTE (drag and drop) ──
app.post('/salvar-ordem-exata', (req, res) => {
  const { novaOrdem } = req.body;
  const { chaveEscala, vendedor } = getEstadoAtual();

  const novaPosicao = novaOrdem.indexOf(vendedor);
  filaAtual[chaveEscala] = novaOrdem;
  indiceFila = novaPosicao !== -1 ? novaPosicao : 0;

  salvarEstado();
  res.json({ success: true, novaLista: novaOrdem });
});

// ── EDITAR ESCALA (painel do gestor) ──
app.post('/salvar-escala', (req, res) => {
  const { novaEscala } = req.body;
  if (!novaEscala) return res.json({ success: false });

  for (const chave in novaEscala) {
    filaAtual[chave] = novaEscala[chave].filter(v => !vendedoresAusentes.includes(v));
  }

  const { chaveEscala, vendedor } = getEstadoAtual();
  const novaPosicao = filaAtual[chaveEscala]?.indexOf(vendedor) ?? 0;
  indiceFila = novaPosicao !== -1 ? novaPosicao : 0;

  salvarEstado();
  res.json({ success: true });
});

// ── RESETS ──
app.get('/reset-ausentes', (req, res) => {
  vendedoresAusentes = [];
  filaAtual = {};
  indiceFila = 0;
  ultimoBloco = "";
  vezPausada = null;
  salvarEstado();
  res.json({ success: true });
});

app.get('/reset-geral', (req, res) => {
  indiceFila         = 0;
  ultimoBloco        = "";
  historicoVendas    = [];
  vendedoresAusentes = [];
  filaAtual          = {};
  vezPausada         = null;
  salvarEstado();
  res.json({ success: true });
});

app.get('/limpar-historico', (req, res) => {
  const antes = historicoVendas.length;
  historicoVendas = historicoVendas.filter(v => v.nome && v.nome !== 'undefined');
  salvarEstado();
  res.json({ success: true, removidos: antes - historicoVendas.length });
});

// ── RESET DIÁRIO À MEIA-NOITE ──
// Zera histórico, placar e ausentes — MAS preserva a ordem da fila
function agendarResetDiario() {
  const agora  = new Date();
  const amanha = new Date();
  amanha.setFullYear(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
  amanha.setHours(0, 0, 0, 0);
  const ms = amanha - agora;

  setTimeout(() => {
    historicoVendas    = [];
    vendedoresAusentes = [];
    vezPausada         = null;
    // ⚠ filaAtual e indiceFila NÃO resetam — mantém ordem do dia anterior
    salvarEstado();
    console.log('🌅 Reset diário executado:', new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }));
    agendarResetDiario();
  }, ms);

  console.log(`⏰ Reset diário agendado em ${Math.round(ms / 60000)} minutos.`);
}

agendarResetDiario();

if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 AmoFila rodando em http://localhost:${PORT}`));
}
module.exports = app;