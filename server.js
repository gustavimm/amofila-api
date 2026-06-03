const express = require('express');
const fs      = require('fs');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 3000;

// ── VENDEDORES ──
const VENDEDORES = {
  manha1:  ["Gustavo", "Isabella", "Lavinia"],   // 08h
  manha2:  ["Luis", "Tifani", "Amanda"],          // 09h
  manha3:  ["Lucas", "Ana Carolina"],             // 10h
  tarde:   ["Luis", "Tifani", "Amanda", "Lucas", "Ana Carolina"], // 17h
  noite:   ["Lucas", "Ana Carolina"],             // 18h
  todos:   ["Gustavo", "Isabella", "Lavinia", "Luis", "Tifani", "Amanda", "Lucas", "Ana Carolina"]
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
    console.warn('⚠️ Não foi possível ler estado.json:', err.message);
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
      diaRodizio,
    }, null, 2));
  } catch (err) {
    console.error('❌ Erro ao salvar estado:', err.message);
  }
}

// ── RODÍZIO DIÁRIO ──
// Retorna o offset do dia (0 = segunda, 1 = terça...)
function getOffsetDia() {
  const agora = new Date();
  const diaSemana = new Date(agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })).getDay();
  // 0=dom, 1=seg, 2=ter, 3=qua, 4=qui, 5=sex, 6=sab
  return diaSemana === 0 ? 6 : diaSemana - 1; // normaliza: seg=0
}

function getDiaAtual() {
  const agora = new Date();
  return agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// Gera a fila base do bloco aplicando o rodízio do dia
function gerarFilaComRodizio(lista) {
  const offset = getOffsetDia() % lista.length;
  return [...lista.slice(offset), ...lista.slice(0, offset)];
}

// ── ESTADO INICIAL ──
const estadoSalvo = carregarEstado();

let indiceFila         = estadoSalvo?.indiceFila         ?? 0;
let ultimoBloco        = estadoSalvo?.ultimoBloco        ?? "";
let historicoVendas    = estadoSalvo?.historicoVendas    ?? [];
let vendedoresAusentes = estadoSalvo?.vendedoresAusentes ?? [];
let diaRodizio         = estadoSalvo?.diaRodizio         ?? getDiaAtual();
let filaAtual          = estadoSalvo?.filaAtual          ?? {};

// Se mudou o dia, regenera as filas com novo rodízio
if (diaRodizio !== getDiaAtual()) {
  console.log('📅 Novo dia detectado — regenerando filas com rodízio.');
  filaAtual  = {};
  indiceFila = 0;
  ultimoBloco = "";
  historicoVendas = [];
  vendedoresAusentes = [];
  diaRodizio = getDiaAtual();
  salvarEstado();
}

// Reaplica ausentes nas filas carregadas
if (vendedoresAusentes.length > 0) {
  for (const chave in filaAtual) {
    filaAtual[chave] = filaAtual[chave].filter(v => !vendedoresAusentes.includes(v));
  }
}

app.use(express.static('public'));
app.use(express.json());

// ── FUNÇÃO CENTRAL ──
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

function getFilaDoBloco(chave) {
  // Se a fila deste bloco ainda não foi gerada, gera com rodízio
  if (!filaAtual[chave]) {
    const base = getListaBase(chave);
    filaAtual[chave] = gerarFilaComRodizio(base)
      .filter(v => !vendedoresAusentes.includes(v));
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

app.post('/proximo', (req, res) => {
  const { lista, vendedor, horaLog, chaveEscala } = getEstadoAtual();

  if (!vendedor || lista.length === 0) {
    return res.json({ success: false, message: "Nenhum vendedor na fila." });
  }

  historicoVendas.unshift({ nome: vendedor, hora: horaLog, bloco: chaveEscala });
  if (historicoVendas.length > 50) historicoVendas.pop();

  indiceFila++;
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

app.post('/ausente', (req, res) => {
  const { vendedor } = req.body;
  if (!vendedor) return res.json({ success: false, message: "Vendedor não informado." });

  if (!vendedoresAusentes.includes(vendedor)) {
    vendedoresAusentes.push(vendedor);
  }

  // Remove de todas as filas
  for (const chave in filaAtual) {
    filaAtual[chave] = filaAtual[chave].filter(v => v !== vendedor);
  }

  // Ajusta índice proporcionalmente
  const { lista } = getEstadoAtual();
  indiceFila = lista.length > 0 ? indiceFila % lista.length : 0;

  salvarEstado();
  res.json({ success: true, ausentes: vendedoresAusentes });
});

app.post('/retornar', (req, res) => {
  const { vendedor } = req.body;
  if (!vendedor) return res.json({ success: false, message: "Vendedor não informado." });

  vendedoresAusentes = vendedoresAusentes.filter(v => v !== vendedor);

  const { chaveEscala, lista } = getEstadoAtual();

  // Insere em todas as filas onde o vendedor deveria estar
  for (const chave in filaAtual) {
    const listaBase = getListaBase(chave);
    if (!listaBase.includes(vendedor)) continue;
    if (filaAtual[chave].includes(vendedor)) continue;

    const fila = [...filaAtual[chave]];

    if (chave === chaveEscala) {
      // No bloco atual: insere logo após quem está na vez (entra na frente)
      const posAtual = lista.length > 0 ? indiceFila % lista.length : 0;
      fila.splice(posAtual + 1, 0, vendedor);
    } else {
      // Outros blocos: insere no início
      fila.unshift(vendedor);
    }

    filaAtual[chave] = fila;
  }

  // Não muda indiceFila — quem está na vez continua
  salvarEstado();
  res.json({ success: true, ausentes: vendedoresAusentes });
});

app.post('/salvar-ordem-exata', (req, res) => {
  const { novaOrdem } = req.body;
  const { chaveEscala, vendedor } = getEstadoAtual();

  // Preserva a vez de quem está jogando
  const novaPosicao = novaOrdem.indexOf(vendedor);
  filaAtual[chaveEscala] = novaOrdem;
  indiceFila = novaPosicao !== -1 ? novaPosicao : 0;

  salvarEstado();
  res.json({ success: true, novaLista: novaOrdem });
});

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
  salvarEstado();
  res.json({ success: true, message: "Ausentes resetados." });
});

app.get('/reset-geral', (req, res) => {
  indiceFila         = 0;
  ultimoBloco        = "";
  historicoVendas    = [];
  vendedoresAusentes = [];
  filaAtual          = {};
  diaRodizio         = getDiaAtual();
  salvarEstado();
  res.json({ success: true, message: "Sistema resetado." });
});

app.get('/limpar-historico', (req, res) => {
  const antes = historicoVendas.length;
  historicoVendas = historicoVendas.filter(v => v.nome && v.nome !== 'undefined');
  salvarEstado();
  res.json({ success: true, removidos: antes - historicoVendas.length });
});

// ── RESET DIÁRIO À MEIA-NOITE ──
function agendarResetDiario() {
  const agora  = new Date();
  const amanha = new Date();
  amanha.setFullYear(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
  amanha.setHours(0, 0, 0, 0);
  const ms = amanha - agora;

  setTimeout(() => {
    historicoVendas    = [];
    indiceFila         = 0;
    ultimoBloco        = "";
    vendedoresAusentes = [];
    filaAtual          = {};
    diaRodizio         = getDiaAtual();
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