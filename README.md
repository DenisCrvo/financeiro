# Financeiro — Sistema de Previsão de Despesas Pessoais

Sistema web para cadastro de despesas e **previsão** de gastos futuros (não apenas
controle do que já foi gasto). Composto por uma tela de cadastro e um dashboard
financeiro, hospedados no GitHub Pages, com API própria em Cloudflare Workers e
persistência em Cloudflare D1.

- **Frontend:** HTML5 + CSS3 + JavaScript ES6+ (módulos nativos) + Bootstrap 5 + Chart.js
- **Backend:** Cloudflare Workers (API REST, sem framework)
- **Banco:** Cloudflare D1 (SQLite)
- **Hospedagem do frontend:** GitHub Pages

## Estrutura do projeto

```
financeiro/
├─ index.html              # Cadastro de despesas
├─ dashboard.html           # Dashboard financeiro
├─ css/style.css
├─ js/
│  ├─ app.js                # Orquestração da tela de cadastro
│  ├─ dashboard.js          # Orquestração do dashboard
│  ├─ api.js                # Comunicação com a API (fetch + API key)
│  └─ utils.js              # Formatação, máscaras, datas
├─ components/
│  ├─ modal.js               # Modal de confirmação e de nova despesa
│  └─ toast.js
├─ services/
│  └─ financeiroService.js   # Regras de negócio (cálculo de VT, validações)
├─ assets/icons/
├─ worker/                   # API — NÃO é publicado no GitHub Pages
│  ├─ src/index.js            # Router + autenticação + CORS
│  ├─ src/utils.js
│  ├─ src/routes/*.js         # Um arquivo por recurso da API
│  ├─ migrations/0001_init.sql
│  ├─ migrations/0002_drop_employee_features.sql
│  ├─ wrangler.toml
│  ├─ package.json
│  └─ API.md                  # Documentação dos endpoints
├─ .gitignore
└─ README.md
```

> O diretório `worker/` roda em Cloudflare Workers e **não deve** ser incluído
> na publicação do GitHub Pages — ele contém a lógica de backend e, em
> desenvolvimento local, a chave de API de teste (`.dev.vars`, já no `.gitignore`).

## Como instalar

Pré-requisitos: [Node.js](https://nodejs.org) 18+ e uma conta [Cloudflare](https://dash.cloudflare.com/sign-up) (gratuita).

```bash
cd worker
npm install
```

## Como configurar o Cloudflare D1

1. Autentique a CLI (abre o navegador):
   ```bash
   cd worker
   npx wrangler login
   ```
2. Crie o banco:
   ```bash
   npx wrangler d1 create financeiro-db
   ```
   O comando retorna um `database_id`. Copie-o para `worker/wrangler.toml`,
   substituindo `COLE_AQUI_O_DATABASE_ID`.
3. Aplique o schema (tabelas, índices, triggers e os tipos de despesa padrão):
   ```bash
   npx wrangler d1 migrations apply financeiro-db --remote
   ```
   Para testar localmente antes de publicar, use `--local` no lugar de `--remote`
   (roda um SQLite local via Miniflare, sem tocar no banco de produção).

## Como configurar o Worker (API)

1. Defina a chave de API que o frontend usará para autenticar (escolha um
   valor aleatório forte):
   ```bash
   npx wrangler secret put API_KEY
   ```
2. Revise `worker/wrangler.toml` — o campo `ALLOWED_ORIGIN` deve ser exatamente
   a URL do seu GitHub Pages (ex.: `https://SEU_USUARIO.github.io`), usada para
   restringir o CORS.
3. Publique o Worker:
   ```bash
   npx wrangler deploy
   ```
   O comando imprime a URL pública, algo como
   `https://financeiro-api.SEU_SUBDOMINIO.workers.dev`.

### Documentação da API

Ver [`worker/API.md`](worker/API.md) para a lista completa de endpoints, payloads e códigos de erro.

## Como alterar a URL da API

Edite as duas constantes no topo de [`js/api.js`](js/api.js):

```js
export const API_BASE_URL = 'https://financeiro-api.SEU_SUBDOMINIO.workers.dev';
const API_KEY = 'SUA_API_KEY_AQUI'; // o mesmo valor definido com `wrangler secret put API_KEY`
```

> A API Key fica visível no código-fonte do frontend (é inevitável em um site
> estático hospedado no GitHub Pages). Para um sistema de uso doméstico e
> pessoal, uma chave fixa é uma proteção razoável contra acesso casual — não
> use este padrão para dados sensíveis de terceiros.

## Como executar localmente

**Backend** (API + banco D1 local, em um terminal):
```bash
cd worker
npx wrangler d1 migrations apply financeiro-db --local
npx wrangler dev
```
Isso sobe a API em `http://localhost:8787`. Crie `worker/.dev.vars` com:
```
API_KEY=uma-chave-qualquer-para-testes
```

**Frontend** (em outro terminal, a partir da raiz do projeto):
```bash
python3 -m http.server 8080
# ou: npx serve .
```
Acesse `http://localhost:8080/index.html`. Aponte temporariamente
`API_BASE_URL`/`API_KEY` em `js/api.js` para `http://localhost:8787` e a chave
de `.dev.vars` — **lembre-se de reverter para os valores de produção antes de
publicar**.

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub (ex.: `financeiro`) e envie o projeto:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/financeiro.git
   git push -u origin main
   ```
2. No GitHub: **Settings → Pages → Source → Deploy from a branch**, selecione
   a branch `main` e a pasta `/ (root)`.
3. O site fica disponível em `https://SEU_USUARIO.github.io/financeiro/`.
4. Confirme que `worker/wrangler.toml` → `ALLOWED_ORIGIN` está com essa mesma
   origem (`https://SEU_USUARIO.github.io`, sem o caminho `/financeiro/`) e
   rode `npx wrangler deploy` novamente se precisar ajustar.

## Como fazer deploy de uma atualização

- **Frontend:** `git push` para `main` — o GitHub Pages republica automaticamente.
- **Backend:** `cd worker && npx wrangler deploy`.
- **Mudanças no banco:** crie uma nova migration em `worker/migrations/`
  (ex.: `0002_algo.sql`) e rode
  `npx wrangler d1 migrations apply financeiro-db --remote`. Nunca edite
  `0001_init.sql` depois de já ter rodado em produção.

## Regras de negócio implementadas

- Uma fatura de cartão por (cartão, ano, mês); ao repetir o mês, a interface
  mostra o último valor registrado com as opções **Atualizar valor** /
  **Manter lançamento anterior**.
- Despesas fixas podem ser lançadas em vários meses de uma vez, com o mesmo valor.
- **Pagamentos à Vista / PIX**: mesmo conceito de Despesas Fixas (lote por
  vários meses), com Tipo de Despesa próprio (lista independente da de
  Despesas Fixas e da de Funcionária).
- **Funcionária — Pagamento Mensal**: lançamento com valor livre,
  categorizado por Tipo de Despesa própria (lista independente das
  demais), também em lote por vários meses. O cálculo de Vale-Transporte
  (Lei 7.418/1985: dias úteis × valor da passagem ida+volta) preenche
  automaticamente o campo de valor, que pode ser ajustado livremente
  antes de salvar.
- Todo lançamento passa por um modal de confirmação com o resumo antes de gravar.
- A tela de Cadastro tem uma área de **Consultar e Editar Lançamentos**, com
  filtros por tipo/ano/mês e ações de editar/excluir sobre os registros já
  existentes (Cartões, Despesas Fixas, Pagamentos à Vista/PIX e Funcionária).
- `credit_cards`, `fixed_expenses`, `avista_payments` e
  `funcionaria_pagamentos` têm `created_at`/`updated_at` e alimentam um
  `audit_log` automático via triggers SQL (consultável direto no banco).
- Valores nunca negativos (`CHECK` no banco + validação na API + validação no frontend).

## Checklist de validação

- [x] Arquitetura desacoplada (frontend estático + API + banco), documentada na Etapa 1
- [x] Banco D1 com tabelas normalizadas, PKs, FKs, `CHECK`, índices e triggers de auditoria (`worker/migrations/`)
- [x] API REST completa em Cloudflare Workers com autenticação por API Key e CORS (`worker/src/`, documentada em `worker/API.md`)
- [x] Interface de cadastro: cartões (Bradesco/Nubank), despesas fixas com tipos dinâmicos, consulta/edição de lançamentos
- [x] Fluxo de conflito (atualizar/manter) e modal de confirmação antes de todo lançamento
- [x] Dashboard com os 2 cards, 2 gráficos de barras Jan-Dez (Chart.js), filtro por ano, última atualização
- [x] Testado de ponta a ponta em todas as etapas: API real (`wrangler dev` + D1 local) e interface real em navegador (Chrome headless)
- [x] `wrangler.toml`, migrations e `.gitignore` prontos para deploy
- [x] README com instalação, configuração do D1/Workers e publicação no GitHub Pages

## Licença

Uso pessoal/doméstico.
