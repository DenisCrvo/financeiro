# Índice da Documentação

> Este projeto é **orientado à documentação**: a maior parte do contexto
> necessário para trabalhar nele vive nestes arquivos Markdown, não no
> histórico de conversas. Uma nova sessão deve conseguir entender o projeto
> por completo lendo apenas os arquivos abaixo, na ordem sugerida.

## Ordem de leitura recomendada

| # | Documento | Quando ler |
|---|---|---|
| 1 | [`../CLAUDE.md`](../CLAUDE.md) | Sempre, primeiro — contexto rápido, regras inquebráveis, checklist |
| 2 | [`SESSION_SUMMARY.md`](SESSION_SUMMARY.md) | Sempre, em seguida — estado atual, leitura **obrigatória** |
| 3 | [`ROADMAP.md`](ROADMAP.md) | Sempre — o que está pronto, em andamento, e sugestões de futuro |
| 4 | [`DECISIONS.md`](DECISIONS.md) | Sempre — decisões arquiteturais, especialmente o que **não** reintroduzir |
| 5+ | Os demais, conforme a tarefa | Ver tabela completa abaixo |

## Todos os documentos

| Documento | Finalidade |
|---|---|
| [`../CLAUDE.md`](../CLAUDE.md) | Contexto rápido do projeto: visão geral, stack, arquitetura resumida, regras inquebráveis, checklist obrigatório antes de qualquer alteração |
| [`SESSION_SUMMARY.md`](SESSION_SUMMARY.md) | Resumo objetivo (≤ 2 páginas) do estado atual, funcionalidades prontas, últimas implementações e próximos passos — leitura obrigatória em toda nova sessão |
| [`ROADMAP.md`](ROADMAP.md) | O que foi concluído, o que está em desenvolvimento, e sugestões de melhorias futuras (não compromissos) |
| [`DECISIONS.md`](DECISIONS.md) | Decisões arquiteturais em formato ADR — contexto, problema, decisão, justificativa, consequências |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Arquitetura completa: frontend, backend, banco, fluxo de dados, estrutura de pastas, diagramas Mermaid |
| [`BUSINESS_RULES.md`](BUSINESS_RULES.md) | Todas as regras de negócio implementadas, uma a uma: descrição, objetivo, comportamento esperado, exceções, impacto |
| [`API_REFERENCE.md`](API_REFERENCE.md) | Referência completa da API REST: método, rota, parâmetros, payload, resposta, códigos HTTP, exemplos |
| [`DATABASE.md`](DATABASE.md) | Modelo do banco: tabelas, relacionamentos, índices, triggers, histórico de migrations, diagrama ER, justificativas de design |
| [`CONVENTIONS.md`](CONVENTIONS.md) | Padrões de código: nomenclatura, organização de pastas, tratamento de erros, validações, estilo |
| [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) | Bugs conhecidos, limitações, dívida técnica, pontos que precisam de atenção |
| [`DEPLOY.md`](DEPLOY.md) | Instruções completas de publicação: ambiente local, GitHub Pages, Cloudflare Workers/D1, migrations, atualização de produção |
| [`CHANGELOG.md`](CHANGELOG.md) | Histórico consolidado do desenvolvimento, agrupado por funcionalidade entregue |
| `INDEX.md` (este arquivo) | Mapa de toda a documentação |

Documentos legados/redirecionados (mantidos por compatibilidade, sem
conteúdo duplicado):
- [`../worker/API.md`](../worker/API.md) — aponta para `API_REFERENCE.md`
- [`../README.md`](../README.md) — voltado a humanos (instalação/execução/deploy), não duplica os documentos técnicos acima

## Como iniciar uma nova sessão

Cole este prompt no início de uma nova conversa com o Claude Code sobre este
projeto:

```
Leia primeiro:
- CLAUDE.md
- docs/SESSION_SUMMARY.md
- docs/ROADMAP.md
- docs/DECISIONS.md

Depois analise o código relevante antes de implementar qualquer alteração.
Se a tarefa envolver banco de dados, API, regras de negócio ou deploy,
consulte também docs/DATABASE.md, docs/API_REFERENCE.md,
docs/BUSINESS_RULES.md ou docs/DEPLOY.md, respectivamente.
```

Isso é suficiente para que a sessão entenda o objetivo do sistema, a
arquitetura, o que já foi tentado e revertido (para não repetir), e o estado
atual — sem depender do histórico de conversas anteriores.

## Manutenção desta documentação

Ao implementar qualquer mudança relevante:

1. Atualize o(s) documento(s) técnico(s) afetado(s) (schema →
   `DATABASE.md`; rota → `API_REFERENCE.md`; regra de negócio →
   `BUSINESS_RULES.md`; decisão estrutural nova → `DECISIONS.md` como um
   novo ADR).
2. Atualize `CHANGELOG.md` com a entrega.
3. Atualize `SESSION_SUMMARY.md` (estado atual + próximos passos).
4. Se uma regra de `CLAUDE.md` (seção "Regras que nunca devem ser
   quebradas") for afetada, atualize-a também.

Nunca deixe uma regra de negócio, decisão de schema ou decisão arquitetural
existir **apenas** no código — se não está em `docs/`, para efeitos de uma
nova sessão, não está documentado.
