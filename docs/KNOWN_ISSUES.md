# Problemas Conhecidos e Dívida Técnica

> Levantado na auditoria do código. Nenhum destes itens bloqueia o uso atual
> do sistema — são registrados para não serem redescobertos do zero em
> sessões futuras.

## Segurança / configuração

- **API Key e URL da API embutidas no código-fonte do frontend**
  (`js/api.js`) — publicamente visíveis a quem inspecionar a página no
  GitHub Pages. **Aceito deliberadamente** para uso pessoal/doméstico (ver
  [DECISIONS.md](DECISIONS.md) ADR-002); não reusar esse padrão se o projeto
  um dia guardar dados de terceiros ou ganhar múltiplos usuários.
- Nenhuma rotação de API Key documentada — trocar a chave hoje exige
  `wrangler secret put API_KEY` + editar manualmente `js/api.js` e reimplantar
  os dois lados.

## Backend / API

- **Sem transação SQL explícita nos lançamentos em lote.** Em
  `createFixedExpenses`/`createAvistaPayments`/`createFuncionariaPayments`,
  os `INSERT`s de cada mês do lote são feitos em um loop `for` sequencial
  (não em uma única transação D1). A checagem de conflito é feita
  previamente para todos os meses, então a chance de falha no meio do loop é
  baixa, mas não é impossível (ex.: erro de rede entre um INSERT e outro
  deixaria o lote parcialmente gravado, sem rollback automático).
- **Sem paginação** nas listagens (`GET /api/fixed-expenses`,
  `/api/credit-cards`, etc.) — todos os registros são retornados de uma vez.
  Aceitável no volume de dados de uso pessoal atual; reavaliar se o
  histórico crescer para múltiplos anos com muitos lançamentos.
- **`ACTION_ROUTES` vazio** em `worker/src/index.js` — scaffolding para
  futuras rotas `POST /recurso/:id/acao`, sem uso hoje. Não é um bug, apenas
  código morto/preparatório.
- **Sem endpoint para consultar `audit_log`** — só acessível via
  `wrangler d1 execute` (ver [DEPLOY.md](DEPLOY.md)). Mencionado
  explicitamente em `worker/API.md`/`docs/API_REFERENCE.md` como limitação
  conhecida, não como bug.

## Banco de dados

- **Tabelas de taxonomia não são auditadas.** Renomear ou excluir um tipo de
  despesa (`expense_types`, `avista_expense_types`,
  `funcionaria_expense_types`) não gera entrada em `audit_log` — só as
  tabelas de lançamento têm triggers de auditoria.
- **Valores monetários como `REAL` (float)**, não inteiro em centavos —
  risco teórico de erro de arredondamento em somas muito grandes; mitigado
  no cálculo de VT com `Math.round(x*100)/100`, mas não há uma estratégia
  formal de ponto fixo em todo o sistema.
- **Referência morta em comentário de migration:** `worker/migrations/
  0005_update_legal_parameters.sql` menciona um arquivo `worker/PAYROLL.md`
  ("Ver worker/PAYROLL.md, seção 'Atualização anual'") que **não existe** no
  repositório — provavelmente nunca foi commitado, ou foi removido junto com
  o módulo de Folha de Pagamento (migration 0006). Inofensivo (o módulo que
  o documento serviria já foi removido), mas pode confundir quem ler a
  migration isoladamente.

## Frontend

- **Inconsistência de confirmação de exclusão:** a maior parte das ações usa
  o modal Bootstrap (`confirmModal`), mas
  `handleDeleteQueryRecord`/`manageExpenseTypesModal` (exclusão de
  lançamento e de tipo de despesa, respectivamente, na tela de consulta)
  usam `window.confirm()` nativo do navegador — visualmente diferente do
  resto da interface.
- **`assets/icons/` está vazio** — a estrutura de pastas do README já previa
  esse diretório, mas todos os ícones usados hoje vêm do Bootstrap Icons via
  CDN (`bi-*` classes). Não é usado por nenhum código atual.
- **Sem testes automatizados** — toda validação registrada no README
  original foi manual/E2E ("testado de ponta a ponta... Chrome headless").
  Não há framework de teste configurado em nenhum `package.json`.

## Infraestrutura / processo

- **Sem CI/CD** — nenhum `.github/workflows` ou equivalente; deploy do
  frontend é `git push` (GitHub Pages republica automaticamente), deploy do
  backend é `wrangler deploy` manual.
- **`wrangler` pinado em `^3.90.0`** (devDependency) — a Cloudflare já
  lançou uma major seguinte (v4); upgrade não avaliado ainda (checar
  breaking changes antes de migrar).
- **Projeto não é um repositório Git** no momento desta auditoria (`git
  status` retorna "not a git repository") — não há histórico de commits;
  toda a "história" do projeto até aqui foi reconstruída a partir dos
  comentários das migrations e de `README.md`/`worker/API.md`.
