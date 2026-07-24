# Deploy

> Instruções operacionais completas. `README.md` tem só a versão resumida
> para quem está configurando o projeto pela primeira vez — este documento é
> a referência completa.

## Pré-requisitos

- [Node.js](https://nodejs.org) 18+
- Conta [Cloudflare](https://dash.cloudflare.com/sign-up) (gratuita)
- `cd worker && npm install` (instala o Wrangler, única dependência)

## Ambiente local

### Backend (API + banco D1 local)

```bash
cd worker
npx wrangler d1 migrations apply financeiro-db --local   # aplica o schema no SQLite local (Miniflare)
npx wrangler dev                                          # sobe a API em http://localhost:8787
```

Crie `worker/.dev.vars` (já no `.gitignore`, nunca commitar) com:
```
API_KEY=uma-chave-qualquer-para-testes
```

### Frontend

Em outro terminal, a partir da raiz do projeto:
```bash
python3 -m http.server 8080
# ou: npx serve .
```
Acesse `http://localhost:8080/index.html`.

Aponte **temporariamente** `API_BASE_URL`/`API_KEY` em `js/api.js` para
`http://localhost:8787` e a chave de `worker/.dev.vars` —
**lembre-se de reverter para os valores de produção antes de publicar.**

## Cloudflare D1 (banco)

1. Autentique a CLI (abre o navegador):
   ```bash
   cd worker
   npx wrangler login
   ```
2. Crie o banco (só na primeira vez):
   ```bash
   npx wrangler d1 create financeiro-db
   ```
   Copie o `database_id` retornado para `worker/wrangler.toml`
   (`[[d1_databases]] database_id = "..."`).
3. Aplique as migrations em produção:
   ```bash
   npx wrangler d1 migrations apply financeiro-db --remote
   ```

### Migrations — regras

- **Nunca edite uma migration já aplicada em produção.** Toda mudança de
  schema é um novo arquivo `worker/migrations/00XX_descricao.sql`
  (numeração sequencial, ver a lista completa em [DATABASE.md](DATABASE.md)).
- Teste sempre primeiro com `--local` antes de `--remote`.
- Depois de criar a nova migration: atualizar [DATABASE.md](DATABASE.md)
  (schema + diagrama ER) e, se mudar regra de negócio,
  [BUSINESS_RULES.md](BUSINESS_RULES.md).

### Consultar o banco diretamente (ex.: `audit_log`)

```bash
cd worker
npx wrangler d1 execute financeiro-db --remote --command "SELECT * FROM audit_log ORDER BY changed_at DESC LIMIT 20;"
```
Use `--local` para consultar o banco de desenvolvimento em vez do de
produção.

## Cloudflare Workers (API)

1. Defina a API Key de produção (escolha um valor aleatório forte):
   ```bash
   cd worker
   npx wrangler secret put API_KEY
   ```
2. Revise `worker/wrangler.toml` — `ALLOWED_ORIGIN` deve ser exatamente a
   URL do GitHub Pages (ex.: `https://SEU_USUARIO.github.io`, **sem** o
   caminho do repositório).
3. Publique:
   ```bash
   npx wrangler deploy
   ```
   Retorna a URL pública (`https://<nome>.<subdominio>.workers.dev`).

## Apontar o frontend para a API

Edite as duas constantes no topo de [`js/api.js`](../js/api.js):
```js
export const API_BASE_URL = 'https://SEU-WORKER.SEU_SUBDOMINIO.workers.dev';
const API_KEY = 'MESMO_VALOR_DO_WRANGLER_SECRET_PUT';
```

> A API Key fica visível no código-fonte do frontend — inevitável em um site
> estático no GitHub Pages. Aceitável para uso doméstico/pessoal (ver
> [DECISIONS.md](DECISIONS.md) ADR-002); **não reutilizar esse padrão** para
> dados sensíveis de terceiros.

## GitHub Pages (frontend)

1. Crie um repositório no GitHub e envie o projeto (o projeto atualmente
   **não é um repositório Git** — inicialize com `git init` na raiz se ainda
   não existir):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```
2. No GitHub: **Settings → Pages → Source → Deploy from a branch**,
   branch `main`, pasta `/ (root)`.
3. O site fica disponível em `https://SEU_USUARIO.github.io/SEU_REPOSITORIO/`.
4. Confirme que `worker/wrangler.toml` → `ALLOWED_ORIGIN` bate com essa
   origem exata (sem o caminho do repositório) e rode `npx wrangler deploy`
   de novo se precisar ajustar.

`worker/` **não deve** ser incluído na publicação do GitHub Pages — contém a
lógica de backend e, em desenvolvimento local, a API Key de teste
(`.dev.vars`, já no `.gitignore`).

## Atualização de produção

| Mudança | Comando |
|---|---|
| Frontend (HTML/CSS/JS) | `git push` para `main` — GitHub Pages republica automaticamente |
| Backend (rotas, lógica) | `cd worker && npx wrangler deploy` |
| Banco (schema) | Nova migration em `worker/migrations/`, depois `npx wrangler d1 migrations apply financeiro-db --remote` |
| API Key | `npx wrangler secret put API_KEY` **+** atualizar `js/api.js` **+** `git push` **+** `wrangler deploy` |
| `ALLOWED_ORIGIN` | Editar `worker/wrangler.toml` + `npx wrangler deploy` |

## Checklist antes de publicar uma atualização

- [ ] `js/api.js` aponta para a URL de produção (não `localhost`).
- [ ] Testado localmente de ponta a ponta (`wrangler dev` + D1 `--local` +
      frontend via `http.server`).
- [ ] Se mudou o schema: migration nova (nunca editada uma existente),
      aplicada com `--local` antes de `--remote`.
- [ ] `docs/DATABASE.md`, `docs/API_REFERENCE.md`, `docs/BUSINESS_RULES.md`
      atualizados conforme o que mudou.
- [ ] `docs/CHANGELOG.md` e `docs/SESSION_SUMMARY.md` atualizados.
