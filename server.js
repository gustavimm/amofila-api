const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

let historicoVendas = [];
let indiceFila = 0;
let ultimoBloco = "";

app.use(express.static('public'));

// --- 1. ESCALA E PERSISTÊNCIA (Memória) ---

let escala = {
    "08": ["Isabella", "Gustavo", "Lavinia"],
    "09": ["Tifani", "Luis", "Amanda"],
    "10": ["Lucas", "Ana Carolina"],
    "11": ["Isabella", "Gustavo", "Lavinia", "Tifani", "Luis", "Amanda", "Lucas", "Ana Carolina"],
    "17": ["Luis", "Tifani", "Ana Carolina", "Lucas", "Amanda"],
    "18": ["Ana Carolina", "Lucas"]
};

// --- 2. ROTAS ---

app.get('/vez', (req, res) => {
    const agora = new Date();
    const horaBrasilia = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false });
    const horaReal = parseInt(horaBrasilia);
    
    let chaveEscala = "";
    if (horaReal === 8) chaveEscala = "08";
    else if (horaReal === 9) chaveEscala = "09";
    else if (horaReal === 10) chaveEscala = "10";
    else if (horaReal >= 11 && horaReal < 17) chaveEscala = "11";
    else if (horaReal === 17) chaveEscala = "17";
    else if (horaReal === 18) chaveEscala = "18";
    else chaveEscala = "11";

    if (ultimoBloco !== "" && ultimoBloco !== chaveEscala) {
        indiceFila = 0;
    }
    ultimoBloco = chaveEscala;

    const vendedoresAgora = escala[chaveEscala] || escala["11"];
    const quemEstaNaVez = vendedoresAgora[indiceFila % vendedoresAgora.length];

    res.json({
        vendedor: quemEstaNaVez,
        horario: `${horaBrasilia}:00`,
        isSolo: vendedoresAgora.length === 1,
        filaAtual: vendedoresAgora
    });
});

app.post('/proximo', (req, res) => {
    const agora = new Date();
    const horaLog = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    const horaReal = parseInt(agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit" }));
    
    let chave = (horaReal >= 11 && horaReal < 17) ? "11" : horaReal.toString().padStart(2, '0');
    let listaVendedores = escala[chave] || escala["11"];
    let vendedorQuePegou = listaVendedores[indiceFila % listaVendedores.length];

    historicoVendas.unshift({ nome: vendedorQuePegou, hora: horaLog });
    if (historicoVendas.length > 5) historicoVendas.pop();

    indiceFila++;
    res.json({ success: true });
});

app.post('/voltar-vez', (req, res) => {
    if (indiceFila > 0) {
        indiceFila--;
        if (historicoVendas.length > 0) historicoVendas.shift();
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Já estamos no início da fila." });
    }
});

app.post('/reordenar', (req, res) => {
    const agora = new Date();
    const horaReal = parseInt(agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit" }));
    let chaveEscala = (horaReal >= 11 && horaReal < 17) ? "11" : horaReal.toString().padStart(2, '0');
    if (!escala[chaveEscala]) chaveEscala = "11";

    let vendedores = escala[chaveEscala];
    if (vendedores.length > 1) {
        const indexAtual = indiceFila % vendedores.length;
        vendedores = [...vendedores.slice(indexAtual), ...vendedores.slice(0, indexAtual)];
        const pulado = vendedores.shift();
        vendedores.push(pulado);
        escala[chaveEscala] = vendedores;
        indiceFila = 0;
        res.json({ success: true, novaLista: vendedores });
    } else {
        res.json({ success: false, message: "Apenas um vendedor na lista." });
    }
});

let vendedoresAusentes = [];

app.post('/ausente', express.json(), (req, res) => {
    const { vendedor } = req.body;
    if (!vendedor) return res.json({ success: false, message: "Vendedor não informado." });

    if (!vendedoresAusentes.includes(vendedor)) {
        vendedoresAusentes.push(vendedor);
    }

    // Remove o vendedor de todos os blocos da escala
    for (const chave in escala) {
        escala[chave] = escala[chave].filter(v => v !== vendedor);
    }

    indiceFila = 0;
    res.json({ success: true, message: `${vendedor} marcado como ausente.`, ausentes: vendedoresAusentes });
});

app.post('/retornar', express.json(), (req, res) => {
    const { vendedor } = req.body;
    if (!vendedor) return res.json({ success: false, message: "Vendedor não informado." });

    vendedoresAusentes = vendedoresAusentes.filter(v => v !== vendedor);

    // Recoloca na escala padrão
    const escalaPadrao = {
        "08": ["Isabella", "Gustavo", "Lavinia"],
        "09": ["Tifani", "Luis", "Amanda"],
        "10": ["Lucas", "Ana Carolina"],
        "11": ["Isabella", "Gustavo", "Lavinia", "Tifani", "Luis", "Amanda", "Lucas", "Ana Carolina"],
        "17": ["Luis", "Tifani", "Ana Carolina", "Lucas", "Amanda"],
        "18": ["Ana Carolina", "Lucas"]
    };

    for (const chave in escalaPadrao) {
        if (escalaPadrao[chave].includes(vendedor) && !escala[chave].includes(vendedor)) {
            escala[chave].push(vendedor);
        }
    }

    indiceFila = 0;
    res.json({ success: true, message: `${vendedor} retornou à fila.`, ausentes: vendedoresAusentes });
});

app.get('/ausentes', (req, res) => {
    res.json({ ausentes: vendedoresAusentes });
});

app.post('/excluir-venda', express.json(), (req, res) => {
    const { index } = req.body;
    if (index !== undefined && index >= 0 && index < historicoVendas.length) {
        historicoVendas.splice(index, 1);
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.post('/definir-vez', express.json(), (req, res) => {
    const { vendedorEscolhido } = req.body;
    const agora = new Date();
    const horaReal = parseInt(agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit" }));
    let chaveEscala = (horaReal >= 11 && horaReal < 17) ? "11" : horaReal.toString().padStart(2, '0');
    if (!escala[chaveEscala]) chaveEscala = "11";

    let vendedores = escala[chaveEscala];
    const indexAlvo = vendedores.indexOf(vendedorEscolhido);
    if (indexAlvo !== -1) {
        vendedores = [...vendedores.slice(indexAlvo), ...vendedores.slice(0, indexAlvo)];
        escala[chaveEscala] = vendedores;
        indiceFila = 0;
        res.json({ success: true, novaLista: vendedores });
    } else {
        res.json({ success: false, message: "Vendedor não encontrado." });
    }
});

app.post('/salvar-ordem-exata', express.json(), (req, res) => {
    const { novaOrdem } = req.body;
    const agora = new Date();
    const horaReal = parseInt(agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit" }));
    let chaveEscala = (horaReal >= 11 && horaReal < 17) ? "11" : horaReal.toString().padStart(2, '0');
    if (!escala[chaveEscala]) chaveEscala = "11";

    escala[chaveEscala] = novaOrdem;
    indiceFila = 0;
    res.json({ success: true, novaLista: novaOrdem });
});

app.get('/reset-geral', (req, res) => {
    indiceFila = 0;
    ultimoBloco = "";
    escala = {
        "08": ["Isabella", "Gustavo", "Lavinia"],
        "09": ["Tifani", "Luis", "Amanda"],
        "10": ["Lucas", "Ana Carolina"],
        "11": ["Isabella", "Gustavo", "Lavinia", "Tifani", "Luis", "Amanda", "Lucas", "Ana Carolina"],
        "17": ["Luis", "Tifani", "Ana Carolina", "Lucas", "Amanda"],
        "18": ["Ana Carolina", "Lucas"]
    };
    res.send("<h1>🔄 Sistema resetado com sucesso!</h1><p>A escala voltou ao padrão e o índice foi para zero.</p>");
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 AmoFila rodando em http://localhost:${PORT}`);
    });
}
module.exports = app;
