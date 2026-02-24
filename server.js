const fs = require('fs'); 
const express = require('express'); 
const app = express(); 
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// 1. ESCALA
const escala = {
    "08": ["Gustavo", "Ana Carolina"],
    "09": ["Lavinia"],
    "10": ["Amanda"],
    "11": ["Gustavo", "Ana Carolina", "Lavinia", "Amanda"]
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
    let horaReal = agora.getHours().toString().padStart(2, '0');
    let horaDaEscala = escala[horaReal] ? horaReal : "11";
    let vendedoresAgora = escala[horaDaEscala];
    let quemEstaNaVez = vendedoresAgora[indiceFila % vendedoresAgora.length];
    
    res.json({
        vendedor: quemEstaNaVez,
        horario: `${horaReal}:00`
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

