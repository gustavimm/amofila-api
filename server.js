const fs = require('fs');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

let historicoVendas = [];

app.use(express.static('public'));

// --- 1. FUNÇÕES DE PERSISTÊNCIA (Arquivos) ---

// Carrega o índice (quem é a vez)
function carregarIndice() {
    try {
        const dado = fs.readFileSync('progresso.txt', 'utf-8');
        return parseInt(dado) || 0;
    } catch (err) { return 0; }
}

function salvarIndice(novoValor) {
    fs.writeFileSync('progresso.txt', novoValor.toString(), 'utf-8');
}

// Carrega a escala (Padrão ou a Customizada que você salvou)
function carregarEscala() {
    const escalaPadrao = {
        "08": ["Amanda", "Ana Carolina"],
        "09": ["Gustavo", "Lavinia"],
        "10": ["Tifani"],
        "11": ["Amanda", "Ana Carolina", "Gustavo", "Lavinia", "Tifani"],
        "17": ["Gustavo", "Tifani", "Lavinia"],
        "18": ["Amanda"]
    };
    try {
        if (fs.existsSync('escala_custom.json')) {
            const dados = fs.readFileSync('escala_custom.json', 'utf-8');
            return JSON.parse(dados);
        }
    } catch (err) { console.error("Erro ao carregar escala:", err); }
    return escalaPadrao;
}

function salvarEscala(novaEscala) {
    fs.writeFileSync('escala_custom.json', JSON.stringify(novaEscala, null, 2), 'utf-8');
}

// Inicialização Global
let escala = carregarEscala();
let indiceFila = carregarIndice();

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

    const vendedoresAgora = escala[chaveEscala] || escala["11"];
    const quemEstaNaVez = vendedoresAgora[indiceFila % vendedoresAgora.length];

    res.json({
        vendedor: quemEstaNaVez,
        horario: `${horaBrasilia}:00`,
        isSolo: vendedoresAgora.length === 1
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
    salvarIndice(indiceFila);
    res.json({ success: true });
});

// AQUI ESTÁ A MUDANÇA: Agora ele salva a troca!
app.post('/reordenar', (req, res) => {
    const agora = new Date();
    const horaReal = parseInt(agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit" }));
    let chaveEscala = (horaReal >= 11 && horaReal < 17) ? "11" : horaReal.toString().padStart(2, '0');
    
    if (!escala[chaveEscala]) chaveEscala = "11";
    const vendedores = escala[chaveEscala];

    if (vendedores.length > 1) {
        const primeiro = vendedores.shift();
        vendedores.push(primeiro);
        
        // SALVAMENTO PERMANENTE
        salvarEscala(escala);
        
        res.json({ success: true, novaLista: vendedores });
    } else {
        res.json({ success: false, message: "Apenas um vendedor na lista." });
    }
});

app.get('/historico', (req, res) => { res.json(historicoVendas); });

app.post('/excluir-venda', express.json(), (req, res) => {
    const { index } = req.body;
    if (index !== undefined && index >= 0 && index < historicoVendas.length) {
        historicoVendas.splice(index, 1);
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.get('/reset-geral', (req, res) => {
    indiceFila = 0;
    salvarIndice(0);
    
    // Deleta o arquivo customizado para voltar ao original
    if (fs.existsSync('escala_custom.json')) {
        fs.unlinkSync('escala_custom.json');
    }
    
    // Recarrega a escala limpa
    escala = carregarEscala();

    res.send("<h1>🔄 Sistema resetado com sucesso!</h1><p>A escala voltou ao padrão e o índice foi para zero.</p>");
});

app.listen(PORT, () => {
    console.log(`🚀 AmoFila rodando em http://localhost:${PORT}`);
});
