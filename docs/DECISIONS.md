# Decisões Arquiteturais (ADRs)

> Registro das decisões estruturais identificadas na auditoria do código e
> das migrations. Datas são aproximadas (baseadas na data de modificação dos
> arquivos de migration, já que o projeto não é um repositório Git com
> histórico de commits). Todas as decisões abaixo estão **Aceitas** (refletem
> o estado atual do código).

---

## ADR-001 — Frontend estático + API serverless + banco de borda, sem framework

**Status:** Aceita
**Contexto:** o projeto é uma ferramenta de uso pessoal/doméstico para um
único usuário prever despesas mensais. Não há necessidade de múltiplos
usuários, autenticação complexa, alta disponibilidade corporativa ou escala.

**Problema:** como hospedar um sistema com frontend + backend + banco com
custo zero e manutenção mínima, sem montar infraestrutura de servidor?

**Decisão:** frontend 100% estático (HTML/CSS/JS ES6 sem bundler) hospedado
no GitHub Pages; API em Cloudflare Workers (JavaScript puro, sem framework
HTTP); banco em Cloudflare D1 (SQLite gerenciado). `worker/package.json` tem
uma única dependência (`wrangler`, só como devDependency/CLI).

**Alternativas consideradas (implícitas pelo design, não documentadas no
código, mas razoáveis para o contexto):** backend tradicional (Node/Express)
com banco Postgres/MySQL em um VPS — descartado pelo custo/operação para uso
pessoal; framework HTTP no Worker (Hono, itty-router) — descartado para
manter zero dependências de runtime.

**Consequências:**
- Custo de hospedagem zero (GitHub Pages + free tier do Cloudflare
  Workers/D1).
- Sem servidor para manter, atualizar ou proteger contra intrusão além da
  própria Cloudflare.
- Limitações da plataforma D1 (SQLite) e do modelo serverless (sem estado
  entre requisições, sem cron/jobs em background) são aceitas.
- Deploy é manual em duas frentes (`git push` para o frontend,
  `wrangler deploy` para a API) — ver [DEPLOY.md](DEPLOY.md).

---

## ADR-002 — API Key única embutida no frontend, sem autenticação por usuário

**Status:** Aceita
**Contexto:** o frontend é um site estático público (GitHub Pages); qualquer
segredo colocado no código-fonte do frontend é, por definição, visível a
quem inspecionar a página.

**Problema:** como restringir o acesso à API sem montar um sistema de login
completo (usuários, senhas, sessões, recuperação de senha), para um sistema
de uso pessoal com um único usuário?

**Decisão:** uma única API Key fixa, definida como secret no Worker
(`wrangler secret put API_KEY`) e embutida diretamente no código-fonte do
frontend (`js/api.js`, constante `API_KEY`). Toda rota exige
`Authorization: Bearer <API_KEY>`; CORS restrito a `ALLOWED_ORIGIN`.

**Alternativas consideradas:** OAuth/login de usuário — descartado por
complexidade desproporcional ao caso de uso (um único usuário, dados
domésticos); proxy server-side para esconder a chave — descartado porque
reintroduziria a necessidade de um servidor com estado.

**Consequências:**
- A API Key **é publicamente visível** no código-fonte do frontend (README
  já documenta isso explicitamente como uma limitação aceita).
- Proteção razoável contra acesso casual, **não** contra alguém que
  inspecione deliberadamente o código-fonte da página.
- **Não deve ser usado** como padrão se o sistema um dia guardar dados
  sensíveis de terceiros ou ganhar múltiplos usuários — nesse caso, a
  autenticação precisa ser revista antes de expandir o escopo.

---

## ADR-003 — Módulo de Folha de Pagamento: implementado e depois removido

**Status:** Aceita (removido)
**Data:** criado 2026-07-17 (migrations 0003–0005), removido 2026-07-17
(migration 0006) — mesmo dia, decisão revertida rapidamente após avaliação.

**Contexto:** havia uma necessidade real de processar a folha de pagamento
de uma empregada doméstica, com conformidade ao eSocial Doméstico (Lei
Complementar 150/2015, tabelas de INSS/IRRF/FGTS, RAT, Vale-Transporte).

**Problema:** implementar um motor de cálculo de folha completo (tabelas
progressivas de INSS/IRRF versionadas por competência, rubricas ao estilo
S-1010 do eSocial, imutabilidade de folha fechada, integração automática com
o financeiro) é uma quantidade de complexidade e superfície de manutenção
muito maior do que o restante do sistema — 6 tabelas novas
(`funcionarios`, `rubricas`, `parametros_legais`, `folha_pagamento`,
`folha_rubricas`, `folha_lancamentos_financeiros`), triggers de
imutabilidade, e a necessidade de manter tabelas legais atualizadas
anualmente (documentado nos comentários da migration 0005 como um risco:
"estes valores DEVEM ser conferidos e atualizados antes de processar folha
real").

**Decisão:** implementar o módulo completo (migrations 0003–0005) e, a
pedido do usuário, **removê-lo por completo logo em seguida** (migration
0006), voltando o foco do sistema exclusivamente ao cadastro financeiro
(cartões, despesas fixas) e ao Dashboard. Uma versão **muito mais simples**
foi recriada depois (migrations 0007–0010): a seção "Funcionária —
Pagamento Mensal", que é só um lançamento de valor livre com cálculo de
Vale-Transporte como autofill — sem cadastro de RH, sem tabelas legais, sem
motor de cálculo de tributos.

**Alternativas consideradas:** manter o módulo completo mas simplificado
(ex.: só INSS, sem IRRF/FGTS) — não adotada; manter o módulo completo e
aceitar o custo de manutenção — rejeitada pelo usuário.

**Consequências:**
- 6 tabelas, seus triggers e os dados de `parametros_legais` deixaram de
  existir — **não recriar sem pedido explícito e novo do usuário** (regra
  registrada em [CLAUDE.md](../CLAUDE.md)).
- A necessidade original (saber quanto será gasto com a funcionária) é
  atendida de forma mais simples pela seção atual, ao custo de não ter
  conformidade com o eSocial nem cálculo de encargos do empregador.
  Se essa necessidade voltar a ser real, a decisão precisa ser
  reavaliada — não basta reverter a migration 0006.
- Um comentário da migration 0005 referencia um arquivo `worker/PAYROLL.md`
  para o processo de "atualização anual" dos parâmetros legais — esse
  arquivo nunca chegou a existir no repositório (ou foi removido junto com o
  módulo); é uma referência morta, inofensiva, documentada em
  [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

---

## ADR-004 — Cada seção de lançamento em lote tem sua própria taxonomia de tipos

**Status:** Aceita
**Data:** consolidada em 2026-07-17 (migration 0009) e 2026-07-21 (migration 0011)

**Contexto:** três seções do sistema (Despesas Fixas, Funcionária, Pagamentos
à Vista/PIX) usam o mesmo conceito de "lançamento em lote categorizado por um
tipo de despesa cadastrável". A seção Funcionária inicialmente **compartilhava**
a tabela `expense_types` (a mesma de Despesas Fixas) — migration 0008.

**Problema:** compartilhar uma única tabela de tipos entre seções sem relação
de negócio entre si faz a lista de opções de um formulário "vazar" categorias
de outro contexto, confundindo o usuário (ex.: uma categoria criada para
Despesas Fixas aparecendo no dropdown da Funcionária).

**Decisão:** cada seção passou a ter sua própria tabela de taxonomia:
`expense_types` (Despesas Fixas), `funcionaria_expense_types` (migration
0009), `avista_expense_types` (migration 0011, já nasceu independente, desde o início). Cada uma com
seu próprio conjunto de rotas CRUD (`/api/expense-types`,
`/api/funcionaria-expense-types`, `/api/avista-expense-types`).

**Alternativas consideradas:** uma única tabela de tipos com uma coluna
`domain`/`context` para diferenciar — não adotada (documentado implicitamente
pela escolha efetiva de tabelas separadas); manter compartilhamento entre
Despesas Fixas e Funcionária — testado na migration 0008 e revertido na 0009.

**Consequências:**
- Código duplicado entre os três arquivos de rota
  (`expenseTypes.js`/`funcionariaExpenseTypes.js`/`avistaExpenseTypes.js`)
  — aceito conscientemente em troca do isolamento (ver
  [CONVENTIONS.md](CONVENTIONS.md)).
- Qualquer nova seção de lançamento em lote **deve seguir o mesmo padrão**:
  sua própria tabela de tipo, nunca reaproveitar uma existente.

---

## ADR-005 — `updated_at` setado explicitamente pela aplicação, nunca por trigger auto-touch

**Status:** Aceita
**Data:** decidida na migration 0001 (2026-07-15), reforçada na 0003 (2026-07-17)

**Contexto:** toda tabela de lançamento tem `created_at`/`updated_at`, e
`updated_at` precisa refletir a hora do último UPDATE.

**Problema:** a forma "natural" de manter `updated_at` atualizado seria um
trigger `BEFORE UPDATE` que sobrescreve a coluna a cada alteração — mas isso
foi testado e descartado.

**Decisão:** cada rota de `UPDATE` no worker seta `updated_at` explicitamente
no próprio SQL (`SET ... updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = ?`), em vez de depender de um trigger.

**Alternativas consideradas:** trigger de "auto-touch" via `UPDATE` aninhado
dentro de um trigger `AFTER UPDATE` — testado e descartado: no runtime do D1,
esse padrão fazia o **trigger de auditoria disparar duas vezes** para a mesma
alteração, duplicando entradas em `audit_log` (comentário original em
`worker/migrations/0001_init.sql`).

**Consequências:**
- Toda nova rota de `UPDATE` precisa lembrar de setar `updated_at`
  manualmente — não é automático. Esquecer isso é um bug silencioso (o campo
  fica desatualizado, mas nada quebra visivelmente).
- Regra listada como inquebrável em [CLAUDE.md](../CLAUDE.md): nunca
  reintroduzir um trigger auto-touch.

---

## ADR-006 — Cálculo de Vale-Transporte vive só no frontend; API é "burra" por design

**Status:** Aceita
**Data:** 2026-07-20 (migration 0010, consolidação do campo `valor_pagar`)

**Contexto:** a seção Funcionária precisa calcular o Vale-Transporte (Lei
7.418/1985: dias úteis × valor da passagem) como conveniência, mas o valor
final pago pode divergir do cálculo puro (ajustes, acordos).

**Problema:** onde deve morar a lógica de cálculo — no servidor (que
recalcularia e poderia sobrescrever o valor enviado) ou no cliente (que só
sugere um valor, deixando a decisão final com o usuário)?

**Decisão:** `calcularValeTransporte()` vive exclusivamente em
`services/financeiroService.js` (frontend). A API
(`worker/src/routes/funcionariaPayments.js`) recebe `valor_pagar` já pronto e
**grava exatamente o que foi enviado**, sem recalcular ou validar contra
`dias_uteis × valor_passagem_dia`.

**Alternativas consideradas:** mover o cálculo para o servidor e usá-lo como
fonte da verdade — rejeitada, pois removeria a flexibilidade de ajuste manual
que é uma regra de negócio explícita (RN-10 em
[BUSINESS_RULES.md](BUSINESS_RULES.md)).

**Consequências:**
- Consistente com o padrão já usado no campo "Valor" de Despesas Fixas (valor
  livre, sem derivação automática no servidor).
- Se a fórmula de VT mudar no futuro, a mudança é só no frontend — não afeta
  a API nem exige migration.
- Contrapartida: nada impede (nem no banco, nem na API) que `valor_pagar`
  seja inconsistente com `dias_uteis × valor_passagem_dia` — isso é
  intencional, não um bug.

---

## ADR-007 — Roteador HTTP manual no Worker, sem framework

**Status:** Aceita

**Contexto:** Cloudflare Workers aceita qualquer framework JS compatível com
a Fetch API (Hono, itty-router, etc.), mas também funciona com um roteador
escrito à mão.

**Problema:** escolher entre trazer uma dependência de roteamento ou
implementar o mínimo necessário para o volume de rotas do projeto (~30 rotas
em 8 recursos).

**Decisão:** `worker/src/index.js` implementa um matcher manual em três
listas (`STATIC_ROUTES`, `ID_ROUTES`, `ACTION_ROUTES`), com autenticação e
CORS tratados uma única vez em `handleRequest`, antes de despachar para o
handler.

**Alternativas consideradas:** Hono ou itty-router — não adotadas.

**Consequências:**
- Zero dependências de runtime no worker (`package.json` só tem `wrangler`
  como devDependency).
- `ACTION_ROUTES` existe como scaffolding para rotas `POST /recurso/:id/acao`
  mas está vazio — não há rota de ação implementada ainda.
- Se o número de rotas crescer muito, o custo de manutenção do matcher manual
  deve ser reavaliado (hoje é baixo, dado o volume atual).
