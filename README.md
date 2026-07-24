# Financeiro — Sistema de Previsão de Despesas Pessoais

Sistema web para cadastro de despesas e **previsão** de gastos futuros (não
apenas controle do que já foi gasto). Composto por uma tela de cadastro e um
dashboard financeiro, hospedados no GitHub Pages, com API própria em
Cloudflare Workers e persistência em Cloudflare D1.

- **Frontend:** HTML5 + CSS3 + JavaScript ES6+ (módulos nativos) + Bootstrap 5 + Chart.js
- **Backend:** Cloudflare Workers (API REST, sem framework)
- **Banco:** Cloudflare D1 (SQLite)
- **Hospedagem do frontend:** GitHub Pages

> Uso pessoal/doméstico, single-user. Documentação técnica completa
> (arquitetura, regras de negócio, API, banco de dados, decisões de projeto)
> em [`docs/`](docs/INDEX.md) — este README cobre só o essencial para
> instalar, rodar e publicar.

## Estrutura do projeto (visão rápida)

```
financeiro/
├─ index.html / dashboard.html   # As duas páginas do frontend
├─ css/, js/, components/, services/, assets/   # Frontend estático
├─ worker/                       # API (Cloudflare Workers) — NÃO publicada no GitHub Pages
│  ├─ src/                         # Router, rotas, utilitários
│  ├─ migrations/                  # Schema versionado do banco D1
│  └─ wrangler.toml / package.json
├─ CLAUDE.md                     # Contexto rápido do projeto (para sessões de IA)
└─ docs/                         # Documentação técnica completa — ver docs/INDEX.md
```

Detalhamento completo de pastas, módulos e diagramas:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

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
   Para testar localmente antes de publicar, use `--local` no lugar de
   `--remote` (roda um SQLite local via Miniflare, sem tocar no banco de
   produção).

## Como configurar o Worker (API)

1. Defina a chave de API que o frontend usará para autenticar (escolha um
   valor aleatório forte):
   ```bash
   npx wrangler secret put API_KEY
   ```
2. Revise `worker/wrangler.toml` — o campo `ALLOWED_ORIGIN` deve ser
   exatamente a URL do seu GitHub Pages (ex.: `https://SEU_USUARIO.github.io`),
   usada para restringir o CORS.
3. Publique o Worker:
   ```bash
   npx wrangler deploy
   ```
   O comando imprime a URL pública, algo como
   `https://financeiro-api.SEU_SUBDOMINIO.workers.dev`.

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
`API_BASE_URL`/`API_KEY` em `js/api.js` para `http://localhost:8787` e a
chave de `.dev.vars` — **lembre-se de reverter para os valores de produção
antes de publicar**.

## Como publicar (deploy)

Resumo rápido — passo a passo completo (GitHub Pages, Workers, D1,
migrations, checklist de atualização de produção) em
[`docs/DEPLOY.md`](docs/DEPLOY.md):

- **Frontend:** `git push` para `main` — o GitHub Pages republica automaticamente.
- **Backend:** `cd worker && npx wrangler deploy`.
- **Banco:** nova migration em `worker/migrations/` (nunca editar uma já
  aplicada em produção) + `npx wrangler d1 migrations apply financeiro-db --remote`.

## Documentação técnica

Este README cobre só instalação/execução/deploy. Para entender o sistema em
profundidade (arquitetura, regras de negócio, API, banco, decisões de
projeto, convenções, roadmap), veja **[`docs/INDEX.md`](docs/INDEX.md)** —
o índice de toda a documentação técnica do projeto.

## Licença

Uso pessoal/doméstico.
