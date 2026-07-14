# Dashboard Financeiro

Dashboard financeiro 100% front-end (HTML5 + CSS3 + JavaScript ES6+), sem backend,
sem frameworks e sem bibliotecas de terceiros além do Google Charts. A única fonte
de dados é uma planilha Google publicada na web (aba **Geral**), consumida via
Fetch API no formato CSV.

## Arquitetura

```
/
├── index.html              Estrutura da página (header, cards, gráfico, rodapé)
├── css/
│   ├── style.css           Design system, layout e componentes visuais
│   └── responsive.css      Breakpoints para tablet e smartphone
├── js/
│   ├── config.js           Configuração central (URL do CSV, colunas, locale)
│   ├── api.js               Busca o CSV publicado via Fetch API
│   ├── data.js              Parser CSV puro + processamento (agrupamento, totais, próximo mês)
│   ├── charts.js            Renderização do gráfico principal (Google Charts)
│   ├── cards.js              Cálculo e renderização dos cards de indicadores
│   ├── ui.js                 Estados da aplicação (loading/erro/vazio) e eventos de DOM
│   ├── utils.js              Funções puras (parse de moeda, formatação, datas)
│   └── app.js                 Ponto de entrada: orquestra os módulos acima
└── assets/                  Ícones, imagens e fontes locais (se necessário)
```

Cada módulo tem uma única responsabilidade e não conhece detalhes internos dos
demais — a comunicação acontece por meio de funções exportadas e parâmetros
explícitos, nunca por variáveis globais.

## Fluxo de funcionamento

1. `app.js` aguarda o DOM e inicializa o Google Charts (`charts.js`).
2. `data.js` busca o CSV (`api.js`), faz o parser (RFC4180 simplificado) e
   transforma as linhas em objetos `{ ano, mes, mesIndex, valores, total }`,
   guardando o resultado em cache de memória.
3. `app.js` popula o filtro de anos (`ui.js`), desenha o gráfico do ano mais
   recente (`charts.js`) e atualiza os cards com o próximo mês disponível
   (`cards.js`).
4. Ao trocar o ano no filtro, apenas o gráfico e os cards são atualizados —
   sem nova busca à planilha.
5. Ao clicar em "Atualizar Dados", o cache é invalidado, o CSV é buscado
   novamente e toda a interface é atualizada, incluindo o horário de última
   sincronização no rodapé.

## Estrutura da planilha (aba "Geral")

| Coluna | Campo                                    |
|--------|-------------------------------------------|
| A      | Ano                                        |
| B      | Mês                                        |
| C…N    | Categorias financeiras (somadas no total)  |

O parser lê o cabeçalho dinamicamente — novas colunas financeiras (D em diante)
são automaticamente incluídas no total do mês, sem alterar código. Os nomes de
colunas usados pelos cards ("NUBANK", "BRADESCO") ficam centralizados em
`CONFIG.CARD_COLUMNS` (`js/config.js`).

## Como configurar a URL da planilha

1. Publique a planilha em **Arquivo → Compartilhar → Publicar na web**,
   selecionando a aba "Geral" e o formato CSV.
2. Copie a URL gerada (formato `.../pub?output=csv&gid=...`).
3. Atualize `CSV_URL` em `js/config.js`.

## Como testar localmente

Módulos ES6 exigem um servidor HTTP (não funcionam com `file://`). Qualquer
servidor estático resolve, por exemplo:

```bash
# Python 3
python3 -m http.server 8080

# ou Node (sem instalar nada globalmente)
npx serve .
```

Acesse `http://localhost:8080`.

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub e envie todos os arquivos deste projeto.
2. Em **Settings → Pages**, selecione a branch principal e a pasta raiz (`/`).
3. Aguarde a publicação; a URL será algo como
   `https://<usuario>.github.io/<repositorio>/`.

## Como atualizar a aplicação futuramente

- Novas colunas financeiras na planilha entram automaticamente no total do
  mês — nenhuma alteração de código é necessária.
- Novos cards: adicione a lógica de cálculo em `cards.js` e o HTML/CSS
  correspondente em `index.html`/`style.css`.
- Novos gráficos: crie uma função dedicada em `charts.js` e chame-a a partir
  de `app.js`.
- Mudança de fonte de dados: apenas `CSV_URL` em `config.js` precisa mudar.

## Melhorias recomendadas (evoluções futuras)

- Comparativo entre anos (múltiplas séries no mesmo gráfico).
- Indicadores de variação percentual mês a mês.
- Filtro por categoria/centro de custo.
- Exportação para PDF/Excel.
- Modo escuro (os tokens de cor em `style.css` já estão centralizados em
  `:root`, facilitando a criação de um tema alternativo).
- Transformar em PWA (manifest + service worker) para uso offline.

## Checklist final de validação

- [x] Leitura do CSV publicado via Fetch API, sem bibliotecas externas.
- [x] Parser CSV em JavaScript puro, com suporte a campos entre aspas.
- [x] Gráfico de barras horizontais com Google Charts, moeda em pt-BR.
- [x] Card "Total Cartões (Próximo mês)" com detecção automática do mês.
- [x] Card "Nubank + Bradesco" com colunas centralizadas em config.js.
- [x] Filtro por ano sem recarregar a página.
- [x] Botão "Atualizar Dados" com nova busca e atualização do rodapé.
- [x] Estados de loading, erro e vazio implementados.
- [x] Layout responsivo (desktop, tablet, smartphone).
- [x] Nenhuma variável global; código modularizado em ES6 modules.
