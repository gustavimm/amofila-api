const request = require('supertest');
const app = require('./server'); // Importa a sua API

describe('🤖 Testes Automatizados da AmoFila (QA)', () => {
    
    it('Deve retornar 200 e mostrar quem está na vez', async () => {
        // Simula o frontend acessando a rota /vez
        const resposta = await request(app).get('/vez');
        
        expect(resposta.statusCode).toBe(200); // Verifica se não deu erro de servidor
        expect(resposta.body).toHaveProperty('vendedor'); // Verifica se a API mandou o nome do vendedor
        expect(resposta.body).toHaveProperty('filaAtual'); // Verifica se mandou o array da fila
    });

    it('Deve impedir rollback negativo ao tentar desfazer venda no início da fila', async () => {
        // Primeiro resetamos tudo para garantir que a fila está no zero
        await request(app).get('/reset-geral');
        
        // Agora tentamos forçar o erro voltando a vez
        const resposta = await request(app).post('/voltar-vez');
        
        // Validação de QA: A API tem que bloquear isso!
        expect(resposta.body.success).toBe(false);
        expect(resposta.body.message).toBe("Já estamos no início da fila.");
    });
});
