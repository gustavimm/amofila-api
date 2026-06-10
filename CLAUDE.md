# AMO FILA API — Contexto do Projeto

## Sobre o projeto

Sistema web de gestão de fila de atendimento de vendedores para a **Amo Internet** (provedor de internet residencial em Cachoeiras de Macacu, RJ). Cada vendedor acessa o painel e clica em "Peguei Venda" para registrar que atendeu um cliente, mantendo a organização justa da vez.

O projeto está em produção no Render.com e é usado pela equipe de vendas no dia a dia.

## Stack

- **Backend:** Node.js + Express.js (REST API)
- **Frontend:** HTML5 + CSS3 + JavaScript Vanilla (modularizado)
- **Persistência:** arquivo `estado.json` no disco (sem banco de dados)
- **Hospedagem:** Render.com (plano free)

## Estrutura de arquivos

```
amofila-api/
├── server.js              # Backend Express
├── package.json
├── estado.json            # Estado persistido (no .gitignore)
├── .gitignore
└── public/
    ├── index.html         # Estrutura HTML
    ├── style.css          # Todo o CSS
    ├── logo-amo.png
    └── js/
        ├── app.js         # Lógica principal e renderização
        ├── dragdrop.js    # Drag and drop da fila
        └── escala.js      # Painel do gestor (senha + edição)
```

## Regras de negócio

### Turnos de trabalho
- **08h—17h:** Gustavo, Isabella, Lavinia
- **09h—18h:** Luis, Tifani, Amanda
- **10h—19h:** Lucas, Ana Carolina

### Blocos de fila por horário
- **08h—08:59h:** apenas Gustavo, Isabella, Lavinia operam entre si
- **09h—09:59h:** apenas Luis, Tifani, Amanda
- **10h—10:59h:** apenas Lucas, Ana Carolina
- **11h—16:59h:** todos os 8 vendedores na mesma fila
- **17h—17:59h:** Luis, Tifani, Amanda, Lucas, Ana Carolina
- **18h—18:59h:** Lucas, Ana Carolina
- **Fora do expediente:** badge âmbar avisa a equipe

### Rodízio diário
Cada dia da semana começa em um vendedor diferente da lista. Calculado automaticamente pelo `getDay()` do JavaScript.

### Regra do almoço (importante!)
Quando o vendedor sai pra almoçar é marcado como ausente. **Ao retornar, ele entra na frente da fila (logo após quem está na vez atual)**, não na posição original da escala. Isso é a recompensa por ter esperado o almoço.

Exemplo: fila está `Amanda → Gustavo → Lavinia`. Amanda está na vez. Lavinia retorna do almoço. A fila vira: `Amanda → Lavinia → Gustavo`.

### Reset diário
Todo dia à meia-noite o servidor zera automaticamente: histórico, placar, ausentes e índice da fila. O cronômetro do frontend também reseta via localStorage.

## Funcionalidades

- Fila em tempo real com polling de 5s
- Botão "Peguei Venda" registra no histórico e avança a fila
- Botão "Desfazer última venda" reverte a última ação
- Drag and drop para reorganizar a fila manualmente (desktop e mobile)
- Marcar ausente / Retornar (com a regra do almoço acima)
- Placar do dia por vendedor com barra de progresso
- Histórico das últimas vendas
- Modo TV (fullscreen para projetar no escritório)
- Painel do Gestor (senha: `amo2025`)
  - Editar escala de cada horário
  - Reset de ausentes (devolve todos pra fila)
  - Reset geral (zera tudo)
- Cronômetro de espera (verde → âmbar aos 5min → vermelho piscando aos 10min)
- Persistência em arquivo JSON (sobrevive a restarts)

## Design

- **Tipografia:** JetBrains Mono (dados) + Barlow Condensed (UI)
- **Paleta:** preto profundo (#080808) + verde terminal (#00ff41)
- **Inspiração:** Bloomberg Terminal + Raycast (ferramenta operacional)
- **Background:** grid sutil verde + vignette radial
- **Animações:** scanline na troca de nome, idle ring no botão principal

## Convenções de código

- JavaScript Vanilla, sem build step
- CSS em variáveis (`--green`, `--surface`, etc) no `:root`
- Funções de evento prefixadas com `_` (privadas)
- IDs em kebab-case (`#btn-venda`, `#lista-fila`)
- Classes BEM-ish (`.fila-chip.atual`, `.drag-item.dragging`)
- Comentários em português

## Próximos passos planejados

1. **Curto prazo:** PWA (instalar no celular), favicon, ajustes de UX
2. **Médio prazo:** Migrar persistência para Firebase Firestore (tempo real sem polling)
3. **Longo prazo:** Integrar como módulo dentro do **Dashboard AMO** (React + Firebase que já existe)

Quando integrar no dashboard, cada seção atual vira um componente React separado e o `estado.json` é substituído por listeners do Firestore.

## Bugs conhecidos / cuidados

- `localStorage` é por navegador — se um vendedor abre em outra aba pode aparecer cronômetro diferente
- O Render free tier dorme após 15min sem uso (primeira request demora ~30s)
- `estado.json` está no `.gitignore` — nunca comitar

## Comandos úteis

```bash
# Rodar local
node server.js

# Instalar dependências
npm install

# Rotas de emergência (apenas gestor)
GET /reset-ausentes    # devolve todos pra fila
GET /reset-geral       # zera tudo
GET /limpar-historico  # remove registros inválidos
```

## Sobre o desenvolvedor

Gustavo é vendedor da Amo Internet que desenvolve ferramentas internas para a equipe. Trabalha em paralelo no **Dashboard AMO** (React + Firebase + Firestore) onde este AMO FILA será futuramente integrado. Prefere desenvolvimento passo a passo com confirmação a cada mudança.
