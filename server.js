const express = require('express');
const fs      = require('fs');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 3000;

// ── ESCALA PADRÃO ──
const ESCALA_PADRAO = {
  "08":   ["Isabella", "Gustavo", "Lavinia"],
  "09":   ["Tifani", "Luis", "Amanda"],
  "10":   ["Lucas", "Ana Carolina"],
  "11":   ["Isabella", "Gustavo", "Lavinia", "Tifani", "Luis", "Amanda", "Lucas", "Ana Carolina"],
  "17":   ["Luis", "Tifani", "Ana Carolina", "Lucas", "Amanda"],
  "18":   ["Ana Carolina", "Lucas"],
  "fora": ["Isabella", "Gustavo", "Lavinia", "Tifani", "Luis", "Amanda", "Lucas", "Ana Carolina"]
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
    console.warn('⚠️  Não foi possível ler estado.json, iniciando do zero.', err.message);
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
      escala
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
let escala             = estadoSalvo?.escala             ?? JSON.parse(JSON.stringify(ESCALA_PADRAO));

// Garante chave "fora" em estados antigos
if (!escala["fora"]) escala["fora"] = [...ESCALA_PADRAO["fora"]];

// IMPORTANTE: ao restaurar do disco, reaplica os ausentes salvos
// Isso garante que um restart não devolve quem estava ausente
if (estadoSalvo && vendedoresAusentes.length > 0) {
  for (const chave in escala) {
    escala[chave] = escala[chave].filter(v => !vendedoresAusentes.includes(v));
  }
  console.log(`🔒 Ausentes reaplicados: ${vendedoresAusentes.join(', ')}`);
}

app.use(express.static('public'));
app.use(express.json());

// ── FUNÇÃO CENTRAL ──
function getChaveEscala(horaReal) {
  if (horaReal === 8)                  return "08";
  if (horaReal === 9)                  return "09";
  if (horaReal === 10)                 return "10";
  if (horaReal >= 11 && horaReal < 17) return "11";
  if (horaReal === 17)                 return "17";
  if (horaReal === 18)                 return "18";
  return "fora";
}

function getEstadoAtual() {
  const agora        = new Date();
  const horaBrasilia = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false });
  const horaReal     = parseInt(horaBrasilia);
  const horaLog      = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const chaveEscala  = getChaveEscala(horaReal);
  const vendedoresAgora = escala[chaveEscala] || escala["11"];
  const quemEstaNaVez   = vendedoresAgora[indiceFila % vendedoresAgora.length];
  return { chaveEscala, vendedoresAgora, quemEstaNaVez, horaBrasilia, horaLog };
}

// ── ROTAS ──

app.get('/vez', (req, res) => {
  const { chaveEscala, vendedoresAgora, quemEstaNaVez, horaBrasilia } = getEstadoAtual();

  // Virada de turno: reseta índice mas NÃO mexe na escala
  // (ausentes continuam removidos)
  if (ultimoBloco !== "" && ultimoBloco !== chaveEscala) {
    indiceFila = 0;
    salvarEstado();
  }
  ultimoBloco = chaveEscala;

  res.json({
    vendedor:     quemEstaNaVez,
    horario:      `${horaBrasilia}:00`,
    isSolo:       vendedoresAgora.length === 1,
    filaAtual:    vendedoresAgora,
    foraDaEscala: chaveEscala === "fora"
  });
});

app.get('/historico', (req, res) => {
  res.json(historicoVendas);
});

app.get('/ausentes', (req, res) => {
  res.json({ ausentes: vendedoresAusentes });
});

app.post('/proximo', (req, res) => {
  const { quemEstaNaVez, horaLog } = getEstadoAtual();
  historicoVendas.unshift({ nome: quemEstaNaVez, hora: horaLog });
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

  // Adiciona à lista de ausentes (sem duplicar)
  if (!vendedoresAusentes.includes(vendedor)) {
    vendedoresAusentes.push(vendedor);
  }

  // Remove de TODAS as chaves da escala
  for (const chave in escala) {
    escala[chave] = escala[chave].filter(v => v !== vendedor);
  }

  // Não reseta o indiceFila — apenas ajusta se necessário
  const { vendedoresAgora } = getEstadoAtual();
  if (vendedoresAgora.length > 0) {
    indiceFila = indiceFila % vendedoresAgora.length;
  } else {
    indiceFila = 0;
  }

  salvarEstado();
  res.json({ success: true, ausentes: vendedoresAusentes });
});

app.post('/retornar', (req, res) => {
  const { vendedor } = req.body;
  if (!vendedor) return res.json({ success: false, message: "Vendedor não informado." });

  // Remove da lista de ausentes
  vendedoresAusentes = vendedoresAusentes.filter(v => v !== vendedor);

  // Reinsere na escala padrão somente nas chaves onde deveria estar
  // e somente se ainda não estiver lá
  for (const chave in ESCALA_PADRAO) {
    if (ESCALA_PADRAO[chave].includes(vendedor) && !escala[chave].includes(vendedor)) {
      // Reinsere na posição original da escala padrão
      const posOriginal = ESCALA_PADRAO[chave].indexOf(vendedor);
      const novaLista   = [...escala[chave]];
      novaLista.splice(posOriginal, 0, vendedor);
      escala[chave] = novaLista;
    }
  }

  indiceFila = 0;
  salvarEstado();
  res.json({ success: true, ausentes: vendedoresAusentes });
});

app.post('/definir-vez', (req, res) => {
  const { vendedorEscolhido } = req.body;
  const { chaveEscala, vendedoresAgora } = getEstadoAtual();
  const idx = vendedoresAgora.indexOf(vendedorEscolhido);
  if (idx === -1) return res.json({ success: false, message: "Vendedor não encontrado." });
  escala[chaveEscala] = [...vendedoresAgora.slice(idx), ...vendedoresAgora.slice(0, idx)];
  indiceFila = 0;
  salvarEstado();
  res.json({ success: true, novaLista: escala[chaveEscala] });
});

app.post('/salvar-ordem-exata', (req, res) => {
  const { novaOrdem } = req.body;
  const { chaveEscala } = getEstadoAtual();
  escala[chaveEscala] = novaOrdem;
  indiceFila = 0;
  salvarEstado();
  res.json({ success: true, novaLista: novaOrdem });
});

app.post('/reordenar', (req, res) => {
  const { chaveEscala, vendedoresAgora } = getEstadoAtual();
  if (vendedoresAgora.length <= 1) {
    return res.json({ success: false, message: "Apenas um vendedor na lista." });
  }
  let vendedores = [...vendedoresAgora];
  const idxAtual = indiceFila % vendedores.length;
  vendedores = [...vendedores.slice(idxAtual), ...vendedores.slice(0, idxAtual)];
  vendedores.push(vendedores.shift());
  escala[chaveEscala] = vendedores;
  indiceFila = 0;
  salvarEstado();
  res.json({ success: true, novaLista: vendedores });
});

app.get('/reset-geral', (req, res) => {
  indiceFila         = 0;
  ultimoBloco        = "";
  historicoVendas    = [];
  vendedoresAusentes = [];
  escala             = JSON.parse(JSON.stringify(ESCALA_PADRAO));
  salvarEstado();
  res.send("<h1>🔄 Sistema resetado!</h1><p>Escala voltou ao padrão e índice zerado.</p>");
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 AmoFila rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;
