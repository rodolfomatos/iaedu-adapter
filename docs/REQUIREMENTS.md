# REQUIREMENTS.md — iaedu-adapter

## Requisitos Funcionais

### RF1 — Endpoint de Chat
O adapter DEVE aceitar pedidos `POST /v1/chat/completions` no formato OpenAI e fazer o forward para `api.iaedu.pt`.

**Critérios de aceitaçao:**
- [x] Aceita JSON com campo `messages` (array de objetos com `role` e `content`)
- [x] Extrai o último mensagem do array como `message` para a API iaedu.pt
- [x] Extrai `chat_id` do corpo do pedido para `thread_id`
- [x] Responde com stream SSE (`text/event-stream`)
- [x] Cada chunk NDJSON `type: "token"` gera um chunk SSE `chat.completion.chunk`
- [x] Stream termina com `finish_reason: "stop"` e `[DONE]`

### RF2 — Endpoint de Modelos
O adapter DEVE fornecer `GET /v1/models` para o OpenWebUI descobrir o modelo.

**Critérios de aceitaçao:**
- [x] Responde com `object: "list"` e um objeto `model` com `id: "iaedu-custom"`

### RF3 — Seguranca de Secrets
A API key DEVE ser lida exclusivamente de variáveis de ambiente.

**Critérios de aceitaçao:**
- [x] O adapter faz `process.exit(1)` se `IAEDU_API_KEY` nao estiver definida
- [x] Nao ha API key hardcoded no código-fonte (exceto em test files temporários — ver ROADMAP)

### RF4 — Conversao de Formato
O adapter DEVE converter entre os dois formatos de API.

**Critérios de aceitaçao:**
- [x] Peticao: JSON → FormData (`channel_id`, `thread_id`, `user_info`, `message`)
- [x] Resposta: NDJSON (newline-delimited JSON) → SSE

---

## Requisitos Não-Funcionais

### RNF1 — Confiabilidade
O adapter DEVE ter _graceful shutdown_ — aguardar em-flight requests antes de fechar.

**Critérios de aceitaçao:**
- [x] Responde 200/503 num endpoint `/health`
- [x] Graceful shutdown: fecha novas ligaçoes, espera streams terminarem

### RNF2 — Observabilidade
O adapter DEVE logar pedidos e erros de forma estruturada.

**Critérios de aceitaçaal:**
- [x] Logs com estrutura JSON para parsing automatizado (pino default)
- [x] Logging de: pedido recebido, thread_id, inicio/fim do stream, erros

### RNF3 — Proteçao de Recursos
O adapter DEVE proteger contra erros do cliente.

**Critérios de aceitaçao:**
- [x] Validaçao de esquema do corpo do pedido (Fastify JSON Schema validation)
- [x] Timeout por pedido (60s via AbortController)
- [x] Limite de tamanho do body (1MB via Fastify bodyLimit)

### RNF4 — Operacional
O adapter DEVE ser fácil de operar.

**Critérios de aceitaçao:**
- [x] Configuraçao por variáveis de ambiente (API key, endpoint, porta)
- [x] Service file systemd fornecido
- [x] Documentaçao de instalaçao clara

---

## Notas de Design

### Modelo de Sessao — Thread por conversa
O adapter usa o `chat_id` enviado pelo OpenWebUI como `thread_id`.
Se o OpenWebUI enviar `chat_id` na mesma conversa, o agente iaedu.pt recebe o mesmo
`thread_id` e mantém o contexto entre mensagens.
**Fallback:** se `chat_id` não estiver presente, gera-se um UUID efémero.

### Erro 500 Genérico
Quando a API iaedu.pt retorna erro, o adapter responde com `500` e mensagem genérica.
**Razão:** Nao expor detalhes internos da API upstream ao cliente.
**Melhoria possível:** log detalhado + resposta estruturada (ver ROADMAP).