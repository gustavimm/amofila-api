const express = require ('express'); //1. Importando o Express
const app = express(); //2. Criando a aplicação Express
const PORT=3000;// 3. Definindo a porta do servidor
// CONFIGURAÇÕES (MIDDLEWARES)
// Abrindo o  http://localhost:3000 automaticamente
app.use(express.static('public'));

//Configuração da Escala Mensal de Trabalho

const escala = {
    "08": ["Gustavo", "Ana Carolina"], // Alternado Dupla
    "09": ["Lavinia"], // Solo (Tifani De Férias)
    "10": ["Amanda"], //Solo (Horário das 10h sozinha(o))
    "11": ["Gustavo", "Ana Carolina", "Lavinia", "Amanda"] // Alternado Dupla

};

let indiceFila = 0;

app.get('/vez', (req, res) => {
    const horaAtual = "08"; // Teste fixo
    let vendedoresAgora = escala[horaAtual] || escala["11"];
    let quemEstaNaVez = vendedoresAgora[indiceFila % vendedoresAgora.length];

    // Agora vamos enviar como JSON para o site conseguir ler fácil
    res.json({
        vendedor: quemEstaNaVez,
        horario: horaAtual
    });
});

// Rota para avançar o índice da fila
app.post('/proximo', (req, res) => {
    indiceFila++; // Aumenta 1 na contagem
    res.json({ success: true, novoIndice: indiceFila });
});

app.listen(PORT, () => {
    console.log(`🚀 AmoFila rodando em http://localhost:${PORT}`);
});