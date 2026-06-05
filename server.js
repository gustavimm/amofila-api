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
      inicioVezTimestamp, // Novo: Salva quando a vez começou
      historicoVendas,
      vendedoresAusentes,
      filaAtual,
      diaRodizio,
    }, null, 2));
  } catch (err) {
    console.error('❌ Erro ao salvar estado:', err.message);
  }
}

// ── AUXILIARES DE DATA E HORÁRIO (SÃO PAULO) ──
function getOffsetDia() {
  const agora = new Date();
  const diaSemana = new Date(agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })).getDay();
  return diaSemana === 0 ? 6 : diaSemana - 1; // Segunda = 0
}

function getDiaAtual() {
  const agora = new Date();
  return agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function gerarFilaComRodizio(lista) {
  const offset = getOffsetDia() % lista.length;
  return [...lista.slice(offset), ...lista.slice(0, offset)];
}

// ── SEGURANÇA: MIDDLEWARE DE AUTENTICAÇÃO DO GESTOR ──
function verificarSenhaGestor(req, res, next) {
  const senha = req.headers['x-manager-password'];
  if (senha === 'amo2025') {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Acesso negado: Senha do gestor inválida.' });
}

// ── ESTADO INICIAL ──
const estadoSalvo = carregarEstado();

let indiceFila         = estadoSalvo?.indiceFila         ?? 0;
let ultimoBloco        = estadoSalvo?.ultimoBloco        ?? "";
let inicioVezTimestamp = estadoSalvo?.inicioVezTimestamp ?? Date.now(); // Referência central do cronômetro
let vendedoresAusentes = estadoSalvo?.vendedoresAusentes ?? [];
let diaRodizio         = estadoSalvo?.diaRodizio         ?? getDiaAtual();

// Correção de compatibilidade: lê 'filaAtual' ou a antiga chave 'escala'
let filaAtual          = estadoSalvo?.filaAtual          ?? estadoSalvo?.escala ?? {};

// Sanitização: limpa registros corrompidos (sem nome) vindos do arquivo antigo
let historicoVendas    = (estadoSalvo?.historicoVendas   ?? []).filter(v => v && v.nome && v.nome !== 'undefined');

// Verificação de virada de dia automática no boot do servidor
if (diaRodizio !== getDiaAtual()) {
  console.log('📅 Novo dia detectado no boot — limpando tabelas.');
  filaAtual = {};
  indiceFila = 0;
  ultimoBloco = "";
  inicioVezTimestamp = Date.now();
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

// ── LOGICA DE FILAS E TURNOS ──
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
  if (!filaAtual[chave]) {
    const base = getListaBase(chave);
    filaAtual[chave] = gerarFilaComRodizio(base).filter(v => !vendedoresAusentes.includes(v));
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

// ── ROTAS PÚBLICAS ──

app.get('/vez', (req, res) => {
  const { chaveEscala, lista, vendedor, horaBrasilia } = getEstadoAtual();

  // Se houve virada de bloco de horário
  if (ultimoBloco !== "" && ultimoBloco !== chaveEscala) {
    const vendedorAntigo = vendedor;
    indiceFila = lista.length > 0 ? indiceFila % lista.length : 0;
    
    // Se o vendedor mudou por conta da virada de turno, atualiza o timestamp do cronômetro
    const { vendedor: novoVendedor } = getEstadoAtual();
    if (vendedorAntigo !== novoVendedor) {
      inicioVezTimestamp = Date.now();
    }
    salvarEstado();
  }
  ultimoBloco = chaveEscala;

  res.json({
    vendedor:      vendedor || "—",
    horario:       `${horaBrasilia}:00`,
    filaAtual:     lista,
    foraDaEscala:  chaveEscala === "fora",
    chaveAtual:    chaveEscala,
    inicioVezTimestamp // Envia o ponto exato do início da vez para o client-side
  });
});

app.get('/historico', (req, res) => res.json(historicoVendas));
app.get('/ausentes',  (req, res) => res.json({ ausentes: vendedoresAusentes }));

app.post('/proximo', (req, res) => {
  const { lista, vendedor, horaLog, chaveEscala } = getEstadoAtual();

  // Defesa absoluta: Não cria histórico se não houver vendedor ativo
  if (!vendedor || lista.length === 0 || chaveEscala === "fora") {
    return res.json({ success: false, message: "Ninguém na fila ou fora do horário de atendimento." });
  }

  historicoVendas.unshift({ nome: vendedor, hora: horaLog, bloco: chaveEscala });
  if (historicoVendas.length > 50) historicoVendas.pop();

  indiceFila++;
  inicioVezTimestamp = Date.now(); // Reinicia cronômetro central
  salvarEstado();
  res.json({ success: true });
});

app.post('/voltar-vez', (req, res) => {
  if (indiceFila > 0) {
    indiceFila--;
    if (historicoVendas.length > 0) historicoVendas.shift();
    inicioVezTimestamp = Date.now(); // Reseta cronômetro ao voltar a vez
    salvarEstado();
    res.json({ success: true });
  } else {
    res.json({ success: false, message: "Já estamos no início da fila." });
  }
});

app.post('/ausente', (req, res) => {
  const { vendedor } = req.body;
  if (!vendedor) return res.json({ success: false, message: "Vendedor não informado." });

  const { vendedor: vendedorAntes } = getEstadoAtual();

  if (!vendedoresAusentes.includes(vendedor)) {
    vendedoresAusentes.push(vendedor);
  }

  for (const chave in filaAtual) {
    filaAtual[chave] = filaAtual[chave].filter(v => v !== vendedor);
  }

  const { lista, vendedor: vendedorDepois } = getEstadoAtual();
  indiceFila = lista.length > 0 ? indiceFila % lista.length : 0;

  // Se o vendedor removido era quem estava na vez, reseta o cronômetro para o próximo
  if (vendedorAntes === vendedor || vendedorAntes !== vendedorDepois) {
    inicioVezTimestamp = Date.now();
  }

  salvarEstado();
  res.json({ success: true, ausentes: vendedoresAusentes });
});

app.post('/retornar', (req, res) => {
  const { vendedor } = req.body;
  if (!vendedor) return res.json({ success: false, message: "Vendedor não informado." });

  vendedoresAusentes = vendedoresAusentes.filter(v => v !== vendedor);
  const { chaveEscala, lista, vendedor: vendedorAntes } = getEstadoAtual();

  for (const chave in filaAtual) {
    const listaBase = getListaBase(chave);
    if (!listaBase.includes(vendedor)) continue;
    if (filaAtual[chave].includes(vendedor)) continue;

    const fila = [...filaAtual[chave]];

    if (chave === chaveEscala) {
      const posAtual = lista.length > 0 ? indiceFila % lista.length : 0;
      fila.splice(posAtual + 1, 0, vendedor); // Entra logo após a vez atual (Regra do Almoço)
    } else {
      fila.unshift(vendedor);
    }
    filaAtual[chave] = fila;
  }

  const { vendedor: vendedorDepois } = getEstadoAtual();
  if (vendedorAntes !== vendedorDepois) {
    inicioVezTimestamp = Date.now();
  }

  salvarEstado();
  res.json({ success: true, ausentes: vendedoresAusentes });
});

// ── ROTAS PROTEGIDAS (REQUEREM SENHA DO GESTOR NO HEADER) ──

app.post('/salvar-ordem-exata', verificarSenhaGestor, (req, res) => {
  const { novaOrdem } = req.body;
  const { chaveEscala, vendedor: vendedorAntes } = getEstadoAtual();

  const novaPosicao = novaOrdem.indexOf(vendedorAntes);
  filaAtual[chaveEscala] = novaOrdem;
  indiceFila = novaPosicao !== -1 ? novaPosicao : 0;

  salvarEstado();
  res.json({ success: true, novaLista: novaOrdem });
});

app.post('/salvar-escala', verificarSenhaGestor, (req, res) => {
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

app.post('/excluir-venda', verificarSenhaGestor, (req, res) => {
  const { index } = req.body;
  if (index !== undefined && index >= 0 && index < historicoVendas.length) {
    historicoVendas.splice(index, 1);
    salvarEstado();
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.get('/reset-ausentes', verificarSenhaGestor, (req, res) => {
  vendedoresAusentes = [];
  filaAtual = {};
  indiceFila = 0;
  ultimoBloco = "";
  inicioVezTimestamp = Date.now();
  salvarEstado();
  res.json({ success: true, message: "Ausentes resetados." });
});

app.get('/reset-geral', verificarSenhaGestor, (req, res) => {
  indiceFila         = 0;
  ultimoBloco        = "";
  inicioVezTimestamp = Date.now();
  historicoVendas    = [];
  vendedoresAusentes = [];
  filaAtual          = {};
  diaRodizio         = getDiaAtual();
  salvarEstado();
  res.json({ success: true, message: "Sistema resetado." });
});

app.get('/limpar-historico', verificarSenhaGestor, (req, res) => {
  historicoVendas = [];
  salvarEstado();
  res.json({ success: true, message: "Histórico esvaziado." });
});

// ── ROTINA AUTOMÁTICA DE MEIA-NOITE ──
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
    inicioVezTimestamp = Date.now();
    vendedoresAusentes = [];
    filaAtual          = {};
    diaRodizio         = getDiaAtual();
    salvarEstado();
    console.log('🌅 Reset diário executado automaticamente.');
    agendarResetDiario();
  }, ms);
}
agendarResetDiario();

if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 AmoFila rodando em http://localhost:${PORT}`));
}
module.exports = app;