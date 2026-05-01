# ROADMAP.md — iaedu-adapter

> Status: `TODO` = por fazer | `IN_PROGRESS` = em curso | `DONE` = completo

---

## Issues de Produçao (Prioridade Alta)

### [HIGH] IA-001 — Falta validaçao de esquema no corpo do pedido
**Problema:** O adapter aceita qualquer JSON. Um corpo malformado causa crash ou comportamento indefinido.
**Impacto:** Crash do adapter com pedidos inválidos de clientes mal comportados.
**Esforço:** Baixo
**Prioridade:** 1
**Status:** TODO
**Soluçao:** Adicionar Fastify JSON Schema validation para `POST /v1/chat/completions`.

---

### [HIGH] IA-002 — Sem health check endpoint
**Problema:** Nao existe `GET /health` ou similar. Monitorizaçao/load balancer nao consegue verificar saúde do servico.
**Impacto:** Nao dá para fazer health checks de fora.
**Esforço:** Baixo
**Prioridade:** 2
**Status:** TODO
**Soluçao:** Adicionar `GET /health` que retorna `{ status: "ok", uptime: N }`.

---

### [HIGH] IA-003 — Sem graceful shutdown
**Problema:** Ao receber SIGTERM, o processo morre imediatamente. Streams em curso dao erro ao cliente.
**Impacto:** Clientes receives partial response + erro.
**Esforço:** Baixo
**Prioridade:** 3
**Status:** TODO
**Soluçao:** Trap SIGTERM/SIGINT, fechar server com `close()` do Fastify (aguarda streams).

---

### [HIGH] IA-004 — Sem timeout por pedido
**Problema:** Se a API iaedu.pt ficar sem responder, o stream fica pendente para sempre.
**Impacto:** Recursos presos, clientes ficamawaiting.
**Esforço:** Baixo
**Prioridade:** 4
**Status:** TODO
**Soluçao:** Adicionar `AbortController` com timeout de 60s por pedido.

---

## Issues de Seguranca (Prioridade Alta)

### [CRITICAL] SEC-001 — API key exposta em ficheiros públicos
**Problema:** A API key real (`sk-usr-REDACTED`) está hardcoded em:
- `README.md` (linha 262 — excerto systemd)
- `test_api_dynamic_thread.mjs` (linha 6)
- `test_boundary_fix.mjs` (linha 8)
- `test_latency.mjs` (linhas 7, 8)
- `test_speed.mjs` (linha 8)
**Impacto:** Exposiçao da chave em repositório público (mesmo privado, é um risco).
**Esforço:** Baixo (remover keys + criar .env.example)
**Prioridade:** CRITICAL
**Status:** TODO (AFTER DOCS DONE)
**Soluçao:** Remover todas as keys hardcoded. Usar `process.env.IAEDU_API_KEY` em todos os ficheiros. Criar `.env.example` com valor placeholder.

---

### [MEDIUM] SEC-002 — API key em plaintext no serviço systemd
**Problema:** O README instrui a colocar a API key diretamente na linha `Environment=` do ficheiro `.service`.
**Impacto:** Qualquer pessoa com acesso ao servidor ve a key em `/etc/systemd/system/iaedu-adapter.service`.
**Nota:** README.md ja usa `EnvironmentFile=` — CORRIGIDO. O .env.example existe e as permissoes `chmod 600` estao documentadas no README.
**Esforço:** Baixo
**Prioridade:** 5
**Status:** TODO
**Soluçao:** Usar `EnvironmentFile=/opt/iaedu-adapter/.env` no systemd service, com `chmod 600` no `.env`.

---

## Issues de Operaçao (Prioridade Média)

### [MEDIUM] OPS-001 — Sem retry em falhas upstream
**Problema:** Se a API iaedu.pt retornar erro 5xx, o cliente recebe erro imediatamente.
**Impacto:** Falhas transitórias dao erro em vez de retry.
**Esforço:** Médio
**Prioridade:** 6
**Status:** TODO
**Soluçao:** Retry com backoff exponencial (max 2 tentativas) em erros 5xx.

---

### [MEDIUM] OPS-002 — Sem rate limiting
**Problema:** Nao há limite de pedidos por cliente. Um cliente mal comportado pode sobrecarregar a API upstream.
**Impacto:** Possível rate limit ou ban da API upstream.
**Esforço:** Médio
**Prioridade:** 7
**Status:** TODO
**Soluçao:** Adicionar rate limiting por IP (ex: 60 req/min via @fastify/rate-limit).

---

### [MEDIUM] OPS-003 — Sem structured logging
**Problema:** Os logs do Fastify estao em formato textual (bom para humanos). Para produçao, JSON logs sao melhores para agregaçao (Datadog, Grafana, etc.).
**Impacto:** Dificuldade em agregar/pesquisar logs em produçao.
**Esforço:** Baixo
**Prioridade:** 8
**Status:** TODO
**Soluçao:** Configurar Fastify com `logger: { level: "info", transport: ... }` ou usar `pino-pretty` para dev + JSON para prod.

---

### [LOW] OPS-004 — Sem CI/CD
**Problema:** Nao ha pipeline de testes/ deploy automatizado.
**Impacto:** Qualquer mudança precisa de testes manuais.
**Esforço:** Médio
**Prioridade:** 12
**Status:** DONE — `.github/workflows/test.yml` com syntax check + smoke test em Node --test

---

## Limitaçoes Arquiteturais (Documentadas)

### [MEDIUM] ARCH-001 — Manter contexto de conversa via thread_id
**Solução implementada:** O adapter usa `chat_id` do OpenWebUI como `thread_id`. Se `chat_id` não estiver presente, usa UUID efémero como fallback.
**Verificação:** Confirmado com utilizador — o comportamento pretendido é manter o mesmo `thread_id` para mensagens da mesma conversa.

---

## Divida Técnica (Prioridade Baixa)

### [LOW] ENG-001 — package.json minimalista
**Problema:** Nao tem `name`, `version`, `description`, `scripts`, nem `engines`.
**Impacto:** Dificuldade em identificar o projeto, npm install nao funciona de forma padrao.
**Esforço:** Baixo
**Prioridade:** 10
**Status:** TODO

---

### [LOW] ENG-002 — Testes sao scripts ad-hoc
**Problema:** 4 ficheiros `test_*.mjs` com lógica de teste copy-paste, keys hardcoded, URLs duplicadas.
**Impacto:** Nao ha framewrok de testes, diffícil de manter.
**Esforço:** Médio
**Prioridade:** 11
**Status:** TODO
**Soluçao:** Criar pasta `test/` com scripts modulares que leem `.env`.

---

### [LOW] ENG-003 — URLs com barra dupla em test files
**Problema:** `test_api_dynamic_thread.mjs`, `test_latency.mjs`, `test_speed.mjs` usam URL com `//`:
`https://api.iaedu.pt/agent-chat//api/v1/agent/...`
**Impacto:** Possível falha de resoluçao do URL pelo servidor (redirecionamentos inesperados).
**Nota:** O `adapter-server.mjs` JA esta corrigido (linha 14: URL sem `//`).
**Esforço:** Baixo
**Prioridade:** 13
**Status:** TODO

---

### [LOW] ENG-004 — Sem .gitignore
**Problema:** `node_modules/` pode ser commitado acidentalmente.
**Esforço:** Trivial
**Prioridade:** 14
**Status:** TODO

---

### [LOW] ENG-005 — Sem .env.example
**Problema:** Nao ha template para as variáveis de ambiente necessárias.
**Esforço:** Trivial
**Prioridade:** 15
**Status:** TODO

---

## Tarefas Completas (Arquivo)

### [DONE] DOCS-000 — Pasta docs/ com documentação base
Documentaçao base criada com VISION.md, PERSONAS.md, REQUIREMENTS.md, ROADMAP.md.

---

## Order de Execuçao Sugerida

1. **Primeiro:** Remover API keys dos ficheiros (SEC-001) + criar .env.example (ENG-005)
2. **Segundo:** Corrigir URLs nos test files (ENG-003)
3. **Terceiro:** Adicionar health endpoint (IA-002)
4. **Quarto:** Graceful shutdown (IA-003)
5. **Quinto:** Timeout por pedido (IA-004)
6. **Sexto:** Validaçao de schema (IA-001)
7. **Sétimo:** ~~Verificar thread_id (ARCH-001)~~ → JÁ FEITO
8. **Oitavo:** package.json + .gitignore (ENG-001, ENG-004)
9. **Nono:** Structured logging (OPS-003)
10. **Décimo**: Test suite modular (ENG-002)
11. **Depois**: Rate limiting (OPS-002), retry (OPS-001), CI/CD (OPS-004)