const fs = require('fs'); 
const express = require('express'); 
const app = express(); 
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// 1. ESCALA
const escala = {
    // Manhã
    "08": ["Amanda", "Ana Carolina"],
    "09": ["Lavinia", "Gustavo"],
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
    const agora = new Date();
    const horaReal = agora.getHours();
    let chaveEscala = "";

    // Lógica de Faixas de Horário
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
        // Fora do horário comercial, mantém a escala cheia como padrão ou aviso de fechado
        chaveEscala = "11"; 
    }

    const vendedoresAgora = escala[chaveEscala] || escala["11"];
    const quemEstaNaVez = vendedoresAgora[indiceFila % vendedoresAgora.length];

    res.json({
        vendedor: quemEstaNaVez,
        horario: `${horaReal.toString().padStart(2, '0')}:00`,
        isSolo: vendedoresAgora.length === 1 // Amanda saberá quando estiver sozinha
    });
});

// Rota de avanço (APENAS UMA VEZ e salvando no arquivo)
app.post('/proximo', (req, res) => {
    indiceFila++;
    salvarIndice(indiceFila); // Aqui salvamos o progresso!
    res.json({ success: true, novoIndice: indiceFila });
});

app.listen(PORT, () => {
    console.log(`🚀 AmoFila rodando em http://localhost:${PORT}`);
});

