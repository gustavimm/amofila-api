const fs = require('fs'); 
const express = require('express'); 
const app = express(); 
const PORT = process.env.PORT || 3000;
let historicoVendas = []; // Esta variável vai guardar as últimas 5 vendas na memória

app.use(express.static('public'));

// 1. ESCALA
const escala = {
    // Manhã
    "08": ["Amanda", "Ana Carolina"],
    "09": ["Gustavo", "Lavinia"],
    "10": ["Tifani"],
    
    // Todos juntos (11:00 às 16:59)
    "11": ["Amanda", "Ana Carolina", "Lavinia", "Gustavo", "Tifani"],
    
    // Tarde - Saídas graduais
    "17": ["Lavinia", "Tifani", "Gustavo"], // Gustavo e Ana saíram
    "18": ["Amanda"] // Lavinia e Tifani saíram, Amanda solo
};
// 2. FUNÇÕES DE PERSISTÊNCIA (Deixe-as aqui no topo)
function carregarIndice() {
    try {
        const dado = fs.readFileSync('progresso.txt', 'utf-8');
        return parseInt(dado) || 0;
    } catch (err) {
        return 0; 
    }
}

function salvarIndice(novoValor){
    fs.writeFileSync('progresso.txt', novoValor.toString(), 'utf-8');
}

// 3. VARIÁVEL GLOBAL (Apenas UMA vez)
let indiceFila = carregarIndice(); 

// 4. ROTAS
app.get('/vez', (req, res) => {
    // Captura a hora exata de Brasília, não importa onde o servidor esteja
    const agora = new Date();
    const horaBrasilia = agora.toLocaleString("pt-BR", { 
        timeZone: "America/Sao_Paulo", 
        hour: "2-digit", 
        hour12: false 
    });

    const horaReal = parseInt(horaBrasilia);
    let chaveEscala = "";

    // Lógica de faixas de horário da AMO INTERNET
    if (horaReal === 8) {
        chaveEscala = "08";
    } else if (horaReal === 9) {
        chaveEscala = "09";
    } else if (horaReal === 10) {
        chaveEscala = "10";
    } else if (horaReal >= 11 && horaReal < 17) {
        chaveEscala = "11";
    } else if (horaReal === 17) {
        chaveEscala = "17";
    } else if (horaReal === 18) {
        chaveEscala = "18";
    } else {
        chaveEscala = "11"; 
    }

    const vendedoresAgora = escala[chaveEscala] || escala["11"];
    const quemEstaNaVez = vendedoresAgora[indiceFila % vendedoresAgora.length];

    res.json({
        vendedor: quemEstaNaVez,
        horario: `${horaBrasilia}:00`,
        isSolo: vendedoresAgora.length === 1
    });
});

// Rota de avanço (APENAS UMA VEZ e salvando no arquivo)
app.post('/proximo', (req, res) => {
    const agora = new Date();
    // Pega a hora certinha de Brasília para o Log
    const horaLog = agora.toLocaleString("pt-BR", { 
        timeZone: "America/Sao_Paulo", 
        hour: "2-digit", 
        minute: "2-digit" 
    });

    // 1. Identifica quem está pegando a venda AGORA (antes de aumentar o índice)
    const horaReal = parseInt(agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit" }));
    let chave = (horaReal >= 11 && horaReal < 17) ? "11" : horaReal.toString().padStart(2, '0');
    let listaVendedores = escala[chave] || escala["11"];
    let vendedorQuePegou = listaVendedores[indiceFila % listaVendedores.length];

    // 2. Adiciona ao início da lista (unshift) e mantém apenas as últimas 5
    historicoVendas.unshift({ nome: vendedorQuePegou, hora: horaLog });
    if (historicoVendas.length > 5) historicoVendas.pop();

    // 3. Avança a fila normalmente
    indiceFila++;
    salvarIndice(indiceFila);
    res.json({ success: true });
});

// Rota para mover o vendedor atual para o final da fila
app.post('/reordenar', (req, res) => {
    const agora = new Date();
    const horaBrasilia = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false });
    const horaReal = parseInt(horaBrasilia);
    
    let chaveEscala = (horaReal >= 11 && horaReal < 17) ? "11" : horaBrasilia;
    if (!escala[chaveEscala]) chaveEscala = "11";

    const vendedores = escala[chaveEscala];

    if (vendedores.length > 1) {
        // Pega o primeiro da lista e joga para o final
        const primeiro = vendedores.shift();
        vendedores.push(primeiro);
        res.json({ success: true, novaLista: vendedores });
    } else {
        res.json({ success: false, message: "Apenas um vendedor na lista." });
    }
});

// Rota para o site buscar a lista de vendas recentes
app.get('/historico', (req, res) => {
    res.json(historicoVendas);
});

// Rota para excluir uma venda específica do histórico
app.post('/excluir-venda', express.json(), (req, res) => {
    const { index } = req.body;
    
    if (index !== undefined && index >= 0 && index < historicoVendas.length) {
        // Remove 1 item na posição do índice
        historicoVendas.splice(index, 1);
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Erro ao excluir item." });
    }
});

// Rota para resetar tudo para o estado inicial
app.get('/reset-geral', (req, res) => {
    // 1. Volta o índice para o começo
    indiceFila = 0;
    salvarIndice(0);

    // 2. Restaura a ordem original da escala (ajuste os nomes conforme sua regra atual)
    escala["08"] = ["Amanda", "Ana Carolina"];
    escala["09"] = ["Gustavo", "Lavinia"];
    escala["10"] = ["Tifani"];
    escala["11"] = ["Amanda", "Ana Carolina", "Lavinia", "Gustavo", "Tifani"];
    escala["17"] = ["Lavinia", "Tifani", "Gustavo"];
    escala["18"] = ["Amanda"];

    res.send("<h1>🔄 Sistema resetado com sucesso!</h1><p>Pode fechar esta aba e dar F5 no painel.</p>");
});

app.listen(PORT, () => {
    console.log(`🚀 AmoFila rodando em http://localhost:${PORT}`);
});

