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
       const escalaPadrao = {
        "08": ["Amanda", "Ana Carolina", "Lucas"],
        "09": ["Gustavo", "Lavinia", "Anna Clara"],
        "10": ["Tifani"],
        "11": ["Amanda", "Ana Carolina", "Gustavo", "Lavinia", "Tifani", "Lucas", "Anna Clara"],
        "17": ["Gustavo", "Tifani", "Lavinia"], 
        "18": ["Amanda"]
    };
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
        isSolo: vendedoresAgora.length === 1,
        filaAtual: vendedoresAgora // ENVIANDO A LISTA PARA O SITE
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

// NOVA ROTA: Botão de Pânico (Desfazer última venda)
app.post('/voltar-vez', (req, res) => {
    if (indiceFila > 0) {
        // 1. Volta o ponteiro uma casa para trás
        indiceFila--;
        salvarIndice(indiceFila);

        // 2. Remove o último registro do histórico (que é sempre o índice 0 por causa do unshift)
        if (historicoVendas.length > 0) {
            historicoVendas.shift();
        }

        res.json({ success: true });
    } else {
        // Trava de segurança para não deixar o índice ficar negativo
        res.json({ success: false, message: "Já estamos no início da fila." });
    }
});


app.post('/reordenar', (req, res) => {
    const agora = new Date();
    const horaReal = parseInt(agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit" }));
    let chaveEscala = (horaReal >= 11 && horaReal < 17) ? "11" : horaReal.toString().padStart(2, '0');
    
    if (!escala[chaveEscala]) chaveEscala = "11";
    let vendedores = escala[chaveEscala]; // Trocado de const para let para podermos reorganizar

    if (vendedores.length > 1) {
        // 1. Descobre a posição de quem está na tela agora
        const indexAtual = indiceFila % vendedores.length;
        
        // 2. REORGANIZAÇÃO MÁGICA: Corta a fila e coloca quem está na tela como o 1º da lista
        vendedores = [...vendedores.slice(indexAtual), ...vendedores.slice(0, indexAtual)];
        
        // 3. Agora tira esse 1º (que é quem estava na tela) e joga para o final
        const pulado = vendedores.shift();
        vendedores.push(pulado);
        
        // 4. Atualiza a escala oficial e salva permanentemente
        escala[chaveEscala] = vendedores;
        salvarEscala(escala);
        
        // 5. ZERA O ÍNDICE! Agora a fila começa limpa a partir do novo primeiro
        indiceFila = 0;
        salvarIndice(0);
        
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

// NOVA ROTA: Define exatamente de quem é a vez, sem precisar pular um por um
app.post('/definir-vez', express.json(), (req, res) => {
    const { vendedorEscolhido } = req.body;
    
    const agora = new Date();
    const horaReal = parseInt(agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit" }));
    let chaveEscala = (horaReal >= 11 && horaReal < 17) ? "11" : horaReal.toString().padStart(2, '0');
    
    if (!escala[chaveEscala]) chaveEscala = "11";
    let vendedores = escala[chaveEscala];

    // Verifica se o vendedor existe na escala atual
    const indexAlvo = vendedores.indexOf(vendedorEscolhido);

    if (indexAlvo !== -1) {
        // Reorganiza a fila colocando o vendedor escolhido como o primeiro (index 0)
        vendedores = [...vendedores.slice(indexAlvo), ...vendedores.slice(0, indexAlvo)];
        
        escala[chaveEscala] = vendedores;
        salvarEscala(escala);
        
        indiceFila = 0;
        salvarIndice(0);
        
        res.json({ success: true, novaLista: vendedores });
    } else {
        res.json({ success: false, message: "Vendedor não encontrado na escala atual." });
    }
});

// NOVA ROTA: Salva a ordem exata da fila definida pelo usuário
app.post('/salvar-ordem-exata', express.json(), (req, res) => {
    const { novaOrdem } = req.body;
    
    const agora = new Date();
    const horaReal = parseInt(agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit" }));
    let chaveEscala = (horaReal >= 11 && horaReal < 17) ? "11" : horaReal.toString().padStart(2, '0');
    
    if (!escala[chaveEscala]) chaveEscala = "11";
    
    // Substitui a escala atual pela nova ordem definida no painel
    escala[chaveEscala] = novaOrdem;
    salvarEscala(escala);
    
    // Zera o índice para começar rigorosamente pelo 1º da nova lista
    indiceFila = 0;
    salvarIndice(0);
    
    res.json({ success: true, novaLista: novaOrdem });
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
