# Convenções

> Padrões observados no código existente. Ao adicionar código novo, siga
> estas convenções para manter o projeto consistente — não introduza um
> padrão diferente sem necessidade real.

## Nomenclatura

- **Idioma:** interface, comentários e nomes de domínio de negócio em
  **português (pt-BR)**. Nomes genéricos/estruturais em inglês (`year`,
  `month`, `value`, `id`, `created_at`). Campos específicos de domínio
  introduzidos mais recentemente são em português mesmo nas tabelas SQL
  (`funcionaria_pagamentos.dias_uteis`, `.valor_passagem_dia`,
  `.valor_pagar`). Ambos os estilos coexistem intencionalmente — não
  "corrigir" um para o outro numa refatoração isolada.
- **Arquivos JS:** `camelCase.js` (`creditCards.js`, `fixedExpenses.js`,
  `financeiroService.js`).
- **Rotas da API:** `kebab-case` no plural (`/api/credit-cards`,
  `/api/fixed-expenses`, `/api/avista-expense-types`).
- **Tabelas e colunas SQL:** `snake_case` (`credit_cards`, `expense_type_id`).
- **Funções exportadas nas rotas do worker:** verbo + recurso em PascalCase
  de recurso (`listCreditCards`, `createFixedExpenses`, `getFuncionariaPayment`,
  `updateAvistaPayment`, `deleteExpenseType`) — sempre esse padrão
  `list/create/get/update/delete` + nome do recurso.

## Organização de pastas

- `js/` — orquestração de UI + comunicação com API + utilitários genéricos.
  Não deve conter regra de negócio (isso vai em `services/`).
- `components/` — widgets de UI reutilizáveis (modal, toast). Não devem
  importar `js/api.js` nem `services/` diretamente — recebem dados e
  callbacks via parâmetros, mantendo-se agnósticos de domínio.
- `services/` — regra de negócio pura (validação, cálculo). Sem `document`/
  `window`, sem `fetch`/import de `api.js` — deve ser testável isoladamente
  (mesmo sem testes automatizados existirem hoje).
- `worker/src/routes/` — um arquivo por recurso REST. Um recurso = uma
  tabela principal (+ eventualmente um JOIN com sua tabela de tipo).

## Padrão de rota da API (worker/src/routes/*.js)

Toda rota segue a mesma estrutura:

```js
import { jsonResponse, errorResponse, parseJsonBody, requireFields, /* ... */ } from '../utils.js';

export async function listRecurso(request, env, url) { /* SELECT, filtro opcional por year */ }
export async function createRecurso(request, env) { /* valida, checa duplicidade, INSERT */ }
export async function getRecurso(request, env, id) { /* SELECT por id, 404 se não achar */ }
export async function updateRecurso(request, env, id) { /* valida, UPDATE, seta updated_at manualmente */ }
export async function deleteRecurso(request, env, id) { /* 404 se não achar, DELETE */ }
```

- Toda função recebe `(request, env, ...)` — nunca acessa estado global.
- Erros de validação lançam `HttpError` (`throw new HttpError(msg, status)`)
  **ou** retornam diretamente `errorResponse`/`jsonResponse` com o status de
  erro — ambos os estilos coexistem no código (`HttpError` para casos
  "deveria nunca acontecer"/validação de entrada; retorno direto para
  conflitos de negócio como duplicidade, que precisam devolver dados extras
  como `record`/`conflicts`).
- SQL sempre via `env.DB.prepare(...).bind(...)` (prepared statements) —
  **nunca** concatenar valores de usuário diretamente na string SQL.

## Tratamento de erros

- `HttpError` (classe em `worker/src/utils.js`) carrega `.status`; capturada
  centralmente em `worker/src/index.js` (`export default { fetch }`).
- Códigos usados: `400` (JSON malformado), `401` (auth), `404` (não
  encontrado), `409` (conflito/dependência), `422` (validação de campo),
  `500` (erro interno, logado com `console.error`).
- No frontend, `ApiError` (em `js/api.js`) carrega `.message` já pronto para
  toast (`err.message || 'Erro na requisição (status).'`).
- Toda chamada de API no frontend é envolvida em `try/catch` que chama
  `showToast(err.message, 'error')` — não deixar uma promise rejeitada sem
  tratamento.

## Validações

- **Sempre em 3 camadas** para campos numéricos: `CHECK` no banco → validação
  na API (`assertNonNegativeNumber`/`assertMonth`/`assertYear` em
  `worker/src/utils.js`) → validação no frontend
  (`services/financeiroService.js`). Não pular nenhuma camada.
- Campos obrigatórios: `requireFields(body, [...])` no início do handler,
  antes de qualquer lógica.
- Strings: sempre `String(x).trim()` antes de validar vazio/gravar.

## Estilo de código

- Sem ponto-e-vírgula omitido — código usa `;` consistentemente.
- Sem TypeScript, sem JSDoc obrigatório — `components/modal.js` usa JSDoc
  em funções públicas complexas (parâmetros com formato não-óbvio); seguir
  esse exemplo quando a assinatura de uma função não for autoexplicativa.
- Comentários explicam o **porquê**, não o **o quê** — exemplos a seguir
  como modelo (não como exceção a "limpar"):
  - O workaround de race condition do Bootstrap Modal em
    `components/modal.js` (`hideModal`/`markModalAsShown`).
  - A decisão de não usar trigger auto-touch para `updated_at`, documentada
    diretamente em `worker/migrations/0001_init.sql`.
- Sem bundler/transpilação: `<script type="module">` nativo no HTML,
  `import`/`export` ES6 direto — qualquer arquivo novo em `js/`,
  `components/` ou `services/` deve continuar sendo um módulo ES6 puro,
  importável sem passo de build.
- Dinheiro como `REAL` (float) — sem estratégia de ponto fixo/inteiro em
  centavos. Ao formatar para exibição, sempre via `formatCurrencyBRL`
  (frontend); ao arredondar cálculos, `Math.round(x * 100) / 100`
  (ver `calcularValeTransporte`).

## Padrão de lançamento em lote ("batch")

As três seções de lançamento por mês (Despesas Fixas, Pagamentos à
Vista/PIX, Funcionária) repetem a mesma receita — ao criar uma nova seção
parecida, siga o mesmo molde:

1. Tabela de taxonomia própria: `id, name UNIQUE, icon, created_at`.
2. Tabela de lançamento: `expense_type_id FK`, `year`, `month`,
   campos de valor, `batch_id`, `created_at`/`updated_at`,
   `UNIQUE (expense_type_id, year, month)`.
3. Rota `create*`: recebe `months: number[]`, deduplica, checa conflito mês a
   mês **antes** de inserir qualquer linha, gera um `batch_id`
   (`crypto.randomUUID()`) compartilhado.
4. Triggers de auditoria `AFTER INSERT/UPDATE/DELETE` idênticos aos das
   demais tabelas de lançamento (não nas tabelas de taxonomia).
5. No frontend: `renderMonthCheckboxes` + `loadExpenseTypesIntoSelect` +
   handler de submit no mesmo formato de `handleFixedExpenseSubmit`.

## Convenções de commit / versionamento

Não aplicável hoje — o projeto **não é um repositório Git** (`git status`
confirma: "not a git repository"). Se/quando o projeto for inicializado como
repositório (ver `README.md`, seção "Como publicar no GitHub Pages"), seguir
mensagens de commit descritivas em português, no imperativo (ex.: "Adiciona
seção de Pagamentos à Vista/PIX").
