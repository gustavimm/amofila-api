const express = require ('express'); //1. Importando o Express
const app = express(); //2. Criando a aplicação Express
const PORT=3000;// 3. Definindo a porta do servidor

//Configuração da Escala Mensal de Trabalho

const escala = {
    "08": ["joao", "Ana Carolina"], // Alternado Dupla
    "09": ["Lavinia"], // Solo (Tifani De Férias)
    "10": ["Amanda"], //Solo (Horário das 10h sozinha(o))
    "11": ["Gustavo", "Ana Carolina", "Lavinia", "Amanda"] // Alternado Dupla

};

let indiceFila = 0;

app.get('/vez', (req, res) => {
    const agora = new Date();
    //Forçando uma hora para teste (depois voltamos para o automático)
    const horaAtual = "08"; 

    //Buscando a lista baseada na hora
    let vendedoresAgora = escala[horaAtual] || escala["11"];

    //Teste
    console.log("Vendedores encontrados:", vendedoresAgora);
    console.log("Tamanho da lista:", vendedoresAgora.length);
    console.log("Índice da fila atual:", indiceFila % vendedoresAgora.length);

    //Verificando se a lista realmente existe para não dar erro
    if (vendedoresAgora) {
        let quemEstaNaVez = vendedoresAgora [indiceFila % vendedoresAgora.length];
        res.send(`<h1>Vez de: ${quemEstaNaVez}</h1><p>Horário: ${horaAtual}h</p>`);
    }else{
        res.send("<h1>Ninguém escalado agora!</h1>");
    }
});

app.listen(PORT, () => {
    console.log(`🚀 AmoFila rodando em http://localhost:${PORT}`);
});