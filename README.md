
# 🚀 AmoFila - Sistema de Gerenciamento de Fila de Vendas

<div align="center">
  <img width="1336" height="621" alt="image" src="[https://github.com/user-attachments/assets/2a862b98-0d2e-4234-9d02-6fd351f47bea](https://github.com/user-attachments/assets/2a862b98-0d2e-4234-9d02-6fd351f47bea)" />
</div>

## 📌 Sobre o Projeto
O **AmoFila** é uma API e um painel web desenvolvidos para resolver um problema real de operação comercial: a gestão justa e assíncrona da fila de vendedores. 

Substituindo métodos manuais sujeitos a falhas humanas e desorganização, o sistema automatiza o rodízio de atendimento, adaptando-se dinamicamente à escala de horários de cada colaborador, pausas para almoço e cancelamentos de vendas.

## 🎯 O Problema (Business Context)
Em um ambiente de vendas rápido, controlar de quem é a "vez" gera gargalos. Problemas identificados antes da automação:
- Dificuldade em manter a ordem quando um vendedor saía para almoçar.
- Erros na transição de turnos e mudança de horários.
- Cliques acidentais gerando "vendas fantasmas" e punindo o vendedor que perdeu a vez.

## 🛠️ Tecnologias Utilizadas
- **Backend:** Node.js, Express.js (REST API)
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Persistência de Dados:** File System (`fs`) manipulando arquivos `.json` e `.txt` para tolerância a reinicializações do servidor.
- **Hospedagem:** Render

## 📋 Funcionalidades Core
- **Acompanhamento em Tempo Real:** Sincronização automática a cada 5 segundos no frontend.
- **Automação de Escala:** O sistema ajusta os vendedores disponíveis automaticamente baseando-se no horário do servidor (ex: 08h, 09h, 11h).
- **Gerenciamento de Estado de Fila:** Componente de UI ("Engrenagem") para reordenar a matriz da fila via Drag-and-Drop lógico (setas direcionais), ideal para reorganização pós-almoço.

---

## 🐞 Destaques de Quality Assurance (QA) & Prevenção de Erros

Como o foco deste projeto também engloba garantir a integridade da operação, várias camadas de validação e tolerância a falhas (Rollback) foram implementadas:

### 1. Sistema de Rollback (Desfazer Ação)
**Cenário de Teste:** O usuário clica em "Peguei Venda" por acidente ou o cliente desiste (era apenas suporte).
**Solução:** Implementação do botão "Cliquei errado". A API executa um rollback seguro (`app.post('/voltar-vez')`), decrementando o `indiceFila`, impedindo valores negativos e removendo o registro falso do histórico sem afetar a ordem subsequente.

### 2. Tratamento do Bug de Virada de Turno (Edge Case)
**Cenário de Teste:** O cálculo da fila era feito via módulo (`indiceFila % tamanho_da_escala`). Ao virar a hora (ex: 09:59 para 10:00), o array de vendedores mudava de tamanho, fazendo a ordem matemática quebrar e pular pessoas injustamente.
**Solução:** Implementação de um "Observador de Estado" (`ultimoBloco`). O servidor detecta a mudança de turno e força o `indiceFila = 0`, garantindo que o novo horário comece rigorosamente pelo primeiro vendedor da lista.

### 3. Persistência de Dados contra Falhas de Infraestrutura
**Cenário de Teste:** Servidores cloud gratuitos (como o Render) entram em estado de "sleep" ou reiniciam aleatoriamente, zerando arrays em memória.
**Solução:** Toda alteração de ordem customizada grava um backup físico em `escala_custom.json` e `progresso.txt`. Se o servidor reiniciar, o backend possui um bloco `try/catch` que recupera o estado exato de onde parou antes da queda.

---

## 💻 Como rodar o projeto localmente (Setup)

1. Clone o repositório:
```bash
git clone https://github.com/gustavimm/amofila-api.git
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor:
```bash
node server.js
```

4. Acesse no navegador:
```text
http://localhost:3000
```

## 🔄 Rotas da API (Endpoints)
- `GET /vez`: Retorna o vendedor atual e a matriz da fila do horário.
- `POST /proximo`: Registra venda e avança a fila.
- `POST /voltar-vez`: Aciona o rollback da última ação.
- `POST /salvar-ordem-exata`: Sobrescreve a ordem da matriz via UI de administração.
- `GET /reset-geral`: Hard reset do sistema (exclusão de backups e retorno à escala padrão).

---
*Desenvolvido com ☕ e foco em Qualidade de Software por Gustavo.*
```
