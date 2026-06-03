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

// Lista mestre de todos os vendedores
const TODOS_VENDEDORES = ["Isabella", "Gustavo", "Lavinia", "Tifani", "Luis", "Amanda", "Lucas", "Ana Carolina"];

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

const estadoSalvo = carregarEstado();

let indiceFila         = estadoSalvo?.indiceFila         ?? 0;
let ultimoBloco        = estadoSalvo?.ultimoBloco        ?? "";
let historicoVendas    = estadoSalvo?.historicoVendas    ?? [];
let vendedoresAusentes = estadoSalvo?.vendedoresAusentes ?? [];
let escala             = estadoSalvo?.escala             ?? JSON.parse(JSON.stringify(ESCALA_PADRAO));

if (!escala["fora"]) escala["fora"] = [...ESCALA_PADRAO["fora"]];

if (estadoSalvo && vendedoresAusentes.length > 0) {
  for (const chave in escala) {
    escala[chave] = escala[chave].filter(v => !vendedoresAusentes.includes(v));
  }
  console.log(`🔒 Ausentes reaplicados: ${vendedoresAusentes.join(', ')}`);
}

app.use(express.static('public'));
app.use(express.json());

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

app.get('/historico', (req, res) => res.json(historicoVendas));
app.get('/ausentes',  (req, res) => res.json({ ausentes: vendedoresAusentes }));

// Retorna escala completa + lista de todos os vendedores
app.get('/escala', (req, res) => {
  res.json({ escala, todos: TODOS_VENDEDORES });
});

// Salva escala editada pelo painel
app.post('/salvar-escala', (req, res) => {
  const { novaEscala } = req.body;
  if (!novaEscala || typeof novaEscala !== 'object') {
    return res.json({ success: false, message: 'Escala inválida.' });
  }

  // Valida cada chave
  const chavesValidas = Object.keys(ESCALA_PADRAO);
  for (const chave of Object.keys(novaEscala)) {
    if (!chavesValidas.includes(chave)) continue;
    if (!Array.isArray(novaEscala[chave])) {
      return res.json({ success: false, message: `Chave ${chave} inválida.` });
    }
  }

  // Aplica a nova escala mantendo ausentes removidos
  for (const chave in novaEscala) {
    escala[chave] = novaEscala[chave].filter(v => !vendedoresAusentes.includes(v));
  }

  indiceFila = 0;
  salvarEstado();
  res.json({ success: true });
});

app.post('/proximo', (req, res) => {
  const { vendedoresAgora, quemEstaNaVez, horaLog } = getEstadoAtual();
  if (!quemEstaNaVez || vendedoresAgora.length === 0) {
    return res.json({ success: false, message: "Nenhum vendedor na fila." });
  }
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
  if (!vendedoresAusentes.includes(vendedor)) vendedoresAusentes.push(vendedor);
  for (const chave in escala) {
    escala[chave] = escala[chave].filter(v => v !== vendedor);
  }
  const { vendedoresAgora } = getEstadoAtual();
  indiceFila = vendedoresAgora.length > 0 ? indiceFila % vendedoresAgora.length : 0;
  salvarEstado();
  res.json({ success: true, ausentes: vendedoresAusentes });
});

app.post('/retornar', (req, res) => {
  const { vendedor } = req.body;
  if (!vendedor) return res.json({ success: false, message: "Vendedor não informado." });
  vendedoresAusentes = vendedoresAusentes.filter(v => v !== vendedor);
  for (const chave in ESCALA_PADRAO) {
    if (ESCALA_PADRAO[chave].includes(vendedor) && !escala[chave].includes(vendedor)) {
      const pos = ESCALA_PADRAO[chave].indexOf(vendedor);
      const nova = [...escala[chave]];
      nova.splice(pos, 0, vendedor);
      escala[chave] = nova;
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
  if (vendedoresAgora.length <= 1) return res.json({ success: false, message: "Apenas um vendedor na lista." });
  let v = [...vendedoresAgora];
  const idx = indiceFila % v.length;
  v = [...v.slice(idx), ...v.slice(0, idx)];
  v.push(v.shift());
  escala[chaveEscala] = v;
  indiceFila = 0;
  salvarEstado();
  res.json({ success: true, novaLista: v });
});

app.get('/limpar-historico', (req, res) => {
  const antes = historicoVendas.length;
  historicoVendas = historicoVendas.filter(v => v.nome && v.nome !== 'undefined');
  salvarEstado();
  res.send(`<h1>✅ Histórico limpo!</h1><p>Removidos ${antes - historicoVendas.length} registros inválidos.</p>`);
});

app.get('/reset-ausentes', (req, res) => {
  vendedoresAusentes = [];
  escala = JSON.parse(JSON.stringify(ESCALA_PADRAO));
  salvarEstado();
  res.send("<h1>✅ Ausentes limpos!</h1><p>Todos os vendedores estão de volta. Histórico preservado.</p>");
});

app.get('/reset-geral', (req, res) => {
  indiceFila = 0; ultimoBloco = ""; historicoVendas = [];
  vendedoresAusentes = [];
  escala = JSON.parse(JSON.stringify(ESCALA_PADRAO));
  salvarEstado();
  res.send("<h1>🔄 Sistema resetado!</h1>");
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 AmoFila rodando em http://localhost:${PORT}`));
}
module.exports = app;