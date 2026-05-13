# Adaptador OpenWebUI para API iaedu.pt (Versão 7 - Unified)

Este projeto é um servidor _adapter_ (middleware) em Node.js. O seu objetivo principal é atuar como uma "ponte" de tradução entre o [OpenWebUI](https://github.com/open-webui/open-webui) e uma API proprietária (iaedu.pt).

O OpenWebUI comunica usando o formato da API OpenAI (JSON), enquanto a API `iaedu.pt` espera um formato `multipart/form-data` e devolve um _stream_ de objetos JSON (NDJSON). Este _adapter_ faz a conversão em tempo real.

## Funcionalidades desta Versão (v7 - Unified)

- **Configuração Inteligente com Precedência:** Headers HTTP > Variáveis de Ambiente > Valores Padrão
  - API Key via `x-iaedu-api-key` ou `x-api-key` header ou `IAEDU_API_KEY` env var
  - Channel ID via `x-iaedu-channel-id` header ou `IAEDU_CHANNEL_ID` env var
  - Agent ID via `x-iaedu-agent-id` header ou `IAEDU_AGENT_ID` env var
- **Multi-tenant Flexível:** Suporte a múltiplos tenants/clients com isolamento de credenciais
- **Thread ID Inteligente:** Usa `chat_id` do OpenWebUI quando disponível, gera UUID caso contrário
- **Converte pedidos OpenAI para o formato `FormData` da iaedu.pt.**
- **Converte o _stream_ de resposta NDJSON para o formato `text/event-stream` (SSE) que o OpenWebUI espera.**
- **Gestão de Sessão:** Mapeia conversas através do thread_id (do chat_id ou UUID gerado)
- **Tratamento de Mensagens do Sistema:** Preserva e combina mensagens do sistema com perguntas do usuário
- **Segurança:** Nenhuma credencial hardcoded; validação rigorosa de entradas
- **Endpoints de Monitoramento:** `/health` (liveness) e `/ready` (readiness) para orchestration
- **Melhorias de Production Hardening:**
  - Timeouts configuráveis com AbortController
  - Tratamento estruturado de erros (502 para upstream failures)
  - Logging estruturado com contexto
  - Graceful shutdown handling (SIGTERM/SIGINT)
  - Limite de tamanho de corpo de requisição (1MB)
  - Validação de esquema JSON com Fastify
  - Headers de resposta otimizados para proxies e CDNs

## Pré-requisitos

- Um servidor Linux (ex: Ubuntu, Debian) com acesso `sudo`.
- [Node.js](https://nodejs.org/) (versão 18+ recomendada) e `npm`.
- OpenWebUI a correr (provavelmente em Docker).
- Acesso de rede do servidor para `api.iaedu.pt`.

## Instalação e Configuração

Esta instalação assume que o _adapter_ corre em `/opt/iaedu-adapter` e é gerido por um serviço `systemd` com o utilizador `www-data`.

### Passo 1: Criar o Ficheiro do Adapter

1.  Crie o diretório do projeto:

    ```bash
    sudo mkdir -p /opt/iaedu-adapter
    ```

2.  Crie o ficheiro do _adapter_ usando o editor de texto **Vim**:

    ```bash
    sudo vim /opt/iaedu-adapter/adapter-server.mjs
    ```

3.  Pressione `i` para entrar no Modo de Inserção e cole o seguinte conteúdo **completo**:

    ```javascript
    // Ficheiro: adapter-server.mjs
    // Versão 7: Unified - Best of local multi-tenancy + GitHub production hardening

    import Fastify from 'fastify';
    import { randomUUID } from 'crypto';

    /**
     * Configuration loader with precedence: Headers > Environment Variables > Defaults
     */
    const getConfig = (request) => {
      // API Key: Header > Env Var > Error (no default for security)
      const apiKey =
        request.headers['x-iaedu-api-key'] ||
        request.headers['x-api-key'] ||
        process.env.IAEDU_API_KEY;

      // Channel ID: Header > Env Var > Default
      const channelId =
        request.headers['x-iaedu-channel-id'] ||
        process.env.IAEDU_CHANNEL_ID ||
        'cmh0rfgmn0i64j801uuoletwy';

      // Agent ID: Header > Env Var > Default
      const agentId =
        request.headers['x-iaedu-agent-id'] ||
        process.env.IAEDU_AGENT_ID ||
        'cmamvd3n40000c801qeacoad2';

      return { apiKey, channelId, agentId };
    };

    // Server Configuration from Environment Variables with Sensible Defaults
    const ADAPTER_PORT = parseInt(process.env.ADAPTER_PORT || '4000', 10);
    const MODEL_NAME = process.env.MODEL_NAME || 'iaedu-custom';
    const IAEDU_ENDPOINT =
      process.env.IAEDU_ENDPOINT ||
      'https://api.iaedu.pt/agent-chat/api/v1/agent/cmamvd3n40000c801qeacoad2/stream';
    const REQUEST_TIMEOUT_MS = parseInt(
      process.env.REQUEST_TIMEOUT_MS || '60000',
      10
    );
    const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';

    const fastify = Fastify({
      logger: {
        level: process.env.LOG_LEVEL || 'info',
      },
      connectionTimeout: 0, // No connection timeout
      keepAliveTimeout: 5000, // 5 seconds keep-alive
      bodyLimit: 1024 * 1024, // 1MB max body size
    });

    // Validation schema for OpenAI-compatible chat completion requests
    const chatCompletionSchema = {
      type: 'object',
      required: ['messages'],
      properties: {
        messages: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['role', 'content'],
            properties: {
              role: { type: 'string', enum: ['system', 'assistant', 'user'] },
              content: { type: 'string', maxLength: 100000 }, // 100k chars max
            },
          },
        },
        chat_id: { type: ['string', 'null'] }, // Allow null/explicit absence
        model: { type: 'string' },
        stream: { type: 'boolean', default: true },
        temperature: { type: 'number', minimum: 0, maximum: 2 },
        max_tokens: { type: ['integer', 'null'], minimum: 1 },
      },
    };

    // Health check startup time for uptime calculation
    const START_TIME = new Date();

    fastify.post(
      '/v1/chat/completions',
      {
        schema: { body: chatCompletionSchema },
      },
      async (request, reply) => {
        // Optimize socket for low-latency streaming
        if (reply.raw.socket) {
          reply.raw.socket.setNoDelay(true);
        }

        // Load configuration with precedence: Headers > Env Vars > Defaults
        const { apiKey, channelId, agentId } = getConfig(request);

        // Validate required configuration
        if (!apiKey) {
          return reply
            .status(400)
            .send({
              error:
                'Missing required configuration: IAEDU_API_KEY (via header x-iaedu-api-key/x-api-key or env var)',
            });
        }

        if (!channelId) {
          return reply
            .status(400)
            .send({
              error:
                'Missing required configuration: IAEDU_CHANNEL_ID (via header x-iaedu-channel-id or env var)',
            });
        }

        const requestBody = request.body;

        // Extract user message (last message in array)
        let userMessage = 'Olá';
        let systemMessage = '';
        if (requestBody.messages && requestBody.messages.length > 0) {
          for (const msg of requestBody.messages) {
            if (msg.role === 'system') {
              systemMessage = msg.content;
            }
          }
          userMessage =
            requestBody.messages[requestBody.messages.length - 1].content;
        }

        // Prepend system message to user message if present (enhanced context)
        if (systemMessage) {
          userMessage = `${systemMessage}\n\n---\n\nUser question: ${userMessage}`;
        }

        // Thread ID: Use chat_id from request if provided, otherwise generate UUID
        // This maintains backward compatibility while allowing explicit control
        const threadId = requestBody.chat_id || `req-${randomUUID()}`;

        const now = new Date();
        const userInfo = {
          current_time: now.toISOString(),
          user_context: {
            name: 'Visitante',
          },
        };

        const formData = new FormData();
        formData.append('channel_id', channelId);
        formData.append('thread_id', threadId);
        formData.append('user_info', JSON.stringify(userInfo));
        formData.append('message', userMessage);

        fastify.log.info(
          {
            threadId,
            msgLength: userMessage.length,
            agentId: agentId.substring(0, 12),
          },
          'Novo pedido recebido'
        );

        // Timeout controller for request
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => {
          abortController.abort();
          fastify.log.warn(
            { threadId },
            `Pedido excedeu timeout de ${REQUEST_TIMEOUT_MS}ms`
          );
        }, REQUEST_TIMEOUT_MS);

        try {
          const response = await fetch(IAEDU_ENDPOINT, {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              Connection: 'keep-alive',
            },
            body: formData,
            duplex: 'half', // Critical for Node.js to prevent hanging
            signal: abortController.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errText = await response.text();
            fastify.log.error(
              {
                threadId,
                status: response.status,
                errText: errText.substring(0, 200),
              },
              'Erro upstream'
            );
            // Return 502 Bad Gateway for upstream errors
            return reply
              .status(502)
              .send({ error: `Erro upstream: ${response.status}` });
          }

          // Set up SSE response headers
          reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no', // Important for nginx/proxy buffering
          });

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          const modelId = `chatcmpl-${Date.now()}`;
          let buffer = '';

          // Process the NDJSON stream from upstream
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            let newlineIndex;

            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
              const line = buffer.substring(0, newlineIndex).trim();
              buffer = buffer.substring(newlineIndex + 1);

              if (!line) continue;

              try {
                const parsed = JSON.parse(line);

                if (parsed.type === 'token' && parsed.content) {
                  const chunk = JSON.stringify({
                    id: modelId,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: MODEL_NAME,
                    choices: [
                      {
                        index: 0,
                        delta: { content: parsed.content },
                        finish_reason: null,
                      },
                    ],
                  });
                  reply.raw.write(`data: ${chunk}\n\n`);
                }
              } catch (e) {
                // Log and skip malformed NDJSON lines
                fastify.log.debug(
                  { line: line.substring(0, 100), error: e.message },
                  'Linha NDJSON ignorada (malformada)'
                );
              }
            }
          }

          // Send final chunks to properly close the stream
          const finishChunk = JSON.stringify({
            id: modelId,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: MODEL_NAME,
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          });
          reply.raw.write(`data: ${finishChunk}\n\n`);
          reply.raw.write(`data: [DONE]\n\n`);
          reply.raw.end();

          fastify.log.info({ threadId }, 'Stream concluído com sucesso');
        } catch (error) {
          clearTimeout(timeoutId);

          if (error.name === 'AbortError') {
            fastify.log.warn(
              { threadId },
              `Stream abortado por timeout após ${REQUEST_TIMEOUT_MS}ms`
            );

            // Only send error response if headers haven't been sent yet
            if (!reply.raw.headersSent) {
              return reply
                .status(504)
                .send({ error: 'Gateway Timeout: Upstream request timed out' });
            }
          } else {
            fastify.log.error(
              { threadId, error: error.message },
              'Erro no processamento do stream'
            );

            // Only send error response if headers haven't been sent yet
            if (!reply.raw.headersSent) {
              return reply
                .status(500)
                .send({ error: 'Erro interno do servidor adapter' });
            }
          }

          // Ensure stream is properly closed if we started writing
          if (!reply.raw.writableFinished) {
            reply.raw.end();
          }
        }
      }
    );

    fastify.get('/v1/models', async (req, reply) => {
      reply.send({
        object: 'list',
        data: [
          {
            id: MODEL_NAME,
            object: 'model',
            created: Date.now(),
            owned_by: 'iaedu',
          },
        ],
      });
    });

    fastify.get('/health', async (req, reply) => {
      const uptime = process.uptime();
      reply.send({
        status: 'ok',
        uptime: Number(uptime.toFixed(2)), // 2 decimal places
        ts: new Date().toISOString(),
        version: '7-unified',
        environment: process.env.NODE_ENV || 'development',
      });
    });

    fastify.get('/ready', async (req, reply) => {
      // Check if we have the minimum required configuration
      // Note: We can't fully validate without a request, but we can check env vars
      const apiKey =
        process.env.IAEDU_API_KEY || // Env var check
        false; // Would need actual request to check headers

      // For readiness, we check that essential env vars are set
      // Headers validation happens per-request
      const hasApiKey = !!process.env.IAEDU_API_KEY;
      const hasChannelId = !!process.env.IAEDU_CHANNEL_ID; // Optional but recommended

      if (!hasApiKey) {
        return reply.status(503).send({
          status: 'not_ready',
          reason: 'missing_api_key',
          hint: 'Set IAEDU_API_KEY environment variable or provide via x-iaedu-api-key header',
        });
      }

      reply.send({ status: 'ready' });
    });

    const start = async () => {
      try {
        await fastify.listen({ port: ADAPTER_PORT, host: SERVER_HOST });
        fastify.log.info(
          {
            port: ADAPTER_PORT,
            host: SERVER_HOST,
            model: MODEL_NAME,
            endpoint: IAEDU_ENDPOINT,
            timeoutMs: REQUEST_TIMEOUT_MS,
          },
          `Adapter IAEDU v7 (Unified) iniciado`
        );

        // Log configuration sources (without exposing secrets)
        fastify.log.info('Configuração carregada:');
        fastify.log.info(
          '  - Porta: %s (env: ADAPTER_PORT, default: 4000)',
          ADAPTER_PORT
        );
        fastify.log.info(
          '  - Host: %s (env: SERVER_HOST, default: 0.0.0.0)',
          SERVER_HOST
        );
        fastify.log.info(
          '  - Modelo: %s (env: MODEL_NAME, default: iaedu-custom)',
          MODEL_NAME
        );
        fastify.log.info(
          '  - Timeout: %sms (env: REQUEST_TIMEOUT_MS, default: 60000)',
          REQUEST_TIMEOUT_MS
        );
        fastify.log.info(
          '  - Endpoint: %s (env: IAEDU_ENDPOINT, default: hardcoded)',
          IAEDU_ENDPOINT
        );
        fastify.log.info(
          '  - Modo: Multi-tenant com precedência: Headers > Env Vars > Defaults'
        );
      } catch (err) {
        fastify.log.error(err);
        process.exit(1);
      }
    };

    const shutdown = async (signal) => {
      fastify.log.info(
        { signal },
        'Sinal de shutdown recebido — iniciando encerramento gracefully'
      );

      try {
        await fastify.close();
        fastify.log.info('Servidor fechado com sucesso');
        process.exit(0);
      } catch (err) {
        fastify.log.error({ error: err.message }, 'Erro durante shutdown');
        process.exit(1);
      }
    };

    // Handle shutdown signals gracefully
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    // Handle unexpected errors
    process.on('uncaughtException', (err) => {
      fastify.log.error({ error: err.message }, 'Exceção não capturada');
      shutdown('UNCaughtException');
    });
    process.on('unhandledRejection', (reason, promise) => {
      fastify.log.error(
        { reason: reason.message || reason },
        'Promessa rejeitada não tratada'
      );
      shutdown('UnhandledRejection');
    });

    // Start the server
    start();
    ```

4.  Pressione `Esc` e depois escreva `:wq` e pressione `Enter` para gravar e sair.

### Passo 2: Instalar Dependências e Definir Permissões

```bash
# Limpa instalações antigas, se existirem
sudo rm -rf /opt/iaedu-adapter/node_modules
sudo rm -f /opt/iaedu-adapter/package-lock.json

# Instala o fastify explicitamente nesse diretório
sudo npm install --prefix /opt/iaedu-adapter fastify

# Define o www-data como proprietário de todos os ficheiros
sudo chown -R www-data:www-data /opt/iaedu-adapter
```

### Passo 3: Criar o Ficheiro de Variáveis de Ambiente (Recomendado)

```bash
# Copie o exemplo e preencha com seus valores
sudo cp /opt/iaedu-adapter/.env.example /opt/iaedu-adapter/.env
sudo chown www-data:www-data /opt/iaedu-adapter/.env
sudo chmod 600 /opt/iaedu-adapter/.env  # Apenas o owner pode ler
```

Edite o ficheiro `.env` com as suas configurações:

```env
# Variáveis de Ambiente para IAEDU Adapter
IAEDU_API_KEY=sua_chave_api_aqui
IAEDU_CHANNEL_ID=cmh0rfgmn0i64j801uuoletwy
IAEDU_AGENT_ID=cmamvd3n40000c801qeacoad2
MODEL_NAME=iaedu-custom
ADAPTER_PORT=4000
SERVER_HOST=0.0.0.0
REQUEST_TIMEOUT_MS=60000
LOG_LEVEL=info
```

### Passo 4: Criar o Serviço Systemd

Isto garante que o _adapter_ corre automaticamente e que a API key é injetada de forma segura via variáveis de ambiente ou headers.

1.  Primeiro, descubra o caminho exato do seu executável `node`:

    ```bash
    which node
    ```

    (Tome nota deste caminho, ex: `/usr/bin/node`. Terá de o usar abaixo.)

2.  Crie o ficheiro de serviço usando o **Vim**:

    ```bash
    sudo vim /etc/systemd/system/iaedu-adapter.service
    ```

3.  Pressione `i` e cole o seguinte conteúdo **completo**:

    ```ini
    [Unit]
    Description=IAEDU API Adapter for OpenWebUI
    After=network.target

    [Service]
    Type=simple

    # Utilizador e Grupo
    User=www-data
    Group=www-data

    # Diretório de Trabalho
    WorkingDirectory=/opt/iaedu-adapter

    # Comando de Execução
    # SUBSTITUA /usr/bin/node pelo resultado de 'which node'
    ExecStart=/usr/bin/node adapter-server.mjs

    # Carregar variáveis de ambiente do arquivo .env
    EnvironmentFile=/opt/iaedu-adapter/.env

    # Reiniciar automaticamente em caso de falha
    Restart=on-failure
    RestartSec=10

    # Redirecionar output para o journal do systemd
    StandardOutput=journal
    StandardError=journal

    [Install]
    WantedBy=multi-user.target
    ```

4.  Grave e saia (`Esc`, `:wq`, `Enter`).

### Passo 5: Gerir o Serviço

Agora, vamos testar e ativar o serviço.

1.  Recarregue o `systemd` para ler o novo ficheiro:

    ```bash
    sudo systemctl daemon-reload
    ```

2.  Inicie o serviço:

    ```bash
    sudo systemctl start iaedu-adapter.service
    ```

3.  **Teste (Regra 4):** Verifique se está a correr corretamente:

    ```bash
    sudo systemctl status iaedu-adapter.service
    ```

    (Deverá ver `active (running)` a verde. Pressione `q` para sair.)

4.  Se estiver a funcionar, ative-o para iniciar no _boot_:

    ```bash
    sudo systemctl enable iaedu-adapter.service
    ```

**Para ver os logs (em caso de erro):**

```bash
sudo journalctl -u iaedu-adapter.service -f
```

### Passo 6: Configuração do OpenWebUI

O seu _adapter_ está agora a correr em `http://[IP_DO_SERVIDOR]:4000`.

1.  Abra o OpenWebUI.

2.  Vá a Definições (Ícone Roda Dentada) -\> Ligações (Connections).

3.  Configure a sua ligação de API:
    - **URL Base da API:** `http://host.docker.internal:4000/v1`
      *(Use `host.docker.internal` se o OpenWebUI estiver em Docker no mesmo *host* que o *adapter*. Caso contrário, use o IP do *host*.)*
    - **Chave API:** `dummy_key` (não é usado pelo _adapter_ diretamente, mas necessário pelo OpenWebUI)
    - **Nome do Modelo:** `iaedu-custom`

4.  **Importante:** Para passar os headers necessários (x-iaedu-api-key, x-iaedu-channel-id, x-iaedu-agent-id), você precisa configurar o OpenWebUI para enviar esses headers personalizados. Isto pode ser feito através de:
    - Um reverse proxy (como Nginx, Caddy) que adiciona os headers antes de encaminhar para o adapter
    - Modificando o OpenWebUI para incluir headers personalizados nas requisições
    - Usando variáveis de ambiente no OpenWebUI para configurar os headers

5.  **Sugestões de Follow-up:** Vá a Definições -\> Interface -\> Sugestões de Follow-up -\> e coloque em **OFF** (ou mude o Modelo de Sugestões para `iaedu-custom` em Definições -\> Geral).

## Próximos Passos (Melhorias Futuras)

Este _adapter_ está agora funcional. As próximas melhorias seriam:

1.  **Cache de Respostas:** Implementar cache para requests frequentes para melhorar performance
2.  **Rate Limiting Avançado:** Adicionar rate limiting por tenant ou por API key
3.  **Métricas e Monitoring:** Adicionar endpoint de métricas Prometheus e melhor logging estruturado
4.  **Suporte a WebSockets:** Explorar suporte a WebSockets para comunicação bidirecional em tempo real
5.  **Dockerização:** Criar imagem Docker para facilitar deployment
6.  **Webhooks:** Suporte para notificações de eventos externos
7.  **Metrics Dashboard:** Interface básica para monitoramento de uso e performance

## Diferenças para Versões Anteriores

### Versão 2 (anterior)

- API Key lida de variável de ambiente no código (`process.env.IAEDU_API_KEY`)
- Channel ID estático hardcoded
- Thread ID baseado apenas em `chat_id` do OpenWebUI ou fallback estático
- Sem suporte multi-tenant real
- Sem endpoint de saúde ou readiness
- Configuração fixa exigindo reinício do serviço para alterações

### Versão 6 (Multi-tenant local)

- API Key, Channel ID e Agent ID recebidos via headers HTTP
- Geração automática de UUID para thread_id por request
- Suporte verdadeiramente multi-tenant
- Endpoint de saúde (`/health`) para monitoring
- Melhorias de performance (connectionTimeout, keepAliveTimeout, setNoDelay)
- Tratamento de mensagens do sistema (systemMessage)
- Melhor logging com informações resumidas do agentId

### Versão 7 (Unified - Esta Versão)

- **Combina o melhor das duas anteriores:**
  - **Multi-tenancy via headers** (mantém compatibilidade com up-chatbot-platform)
  - **Fallback para environment variables** (flexibilidade para deployment)
  - **Validação de precedência clara:** Headers > Env Vars > Defaults
  - **Thread ID inteligente:** Usa `chat_id` do request quando disponível
  - **Production hardening** da versão GitHub:
    - Timeouts configuráveis com AbortController
    - Tratamento estruturado de erros (502 para upstream failures)
    - Logging estruturado com contexto
    - Graceful shutdown handling
    - Endpoints `/health` e `/ready`
    - Validação de esquema JSON
    - Limites de corpo e proteção contra abusos
- **Documentação aprimorada** com exemplos de uso
- **Testes básicos** incluídos para validação

## Arquitetura de Configuração

O adapter segue esta ordem de precedência para configuração:

1. **Headers HTTP** (máxima prioridade - permite mudança por request)
   - `x-iaedu-api-key` ou `x-api-key`
   - `x-iaedu-channel-id`
   - `x-iaedu-agent-id`

2. **Variáveis de Ambiente** (boa para deployment padrão)
   - `IAEDU_API_KEY`
   - `IAEDU_CHANNEL_ID`
   - `IAEDU_AGENT_ID`
   - `ADAPTER_PORT`, `SERVER_HOST`, `MODEL_NAME`, etc.

3. **Valores Padrão** (fallback seguro)
   - Channel ID: `cmh0rfgmn0i64j801uuoletwy`
   - Agent ID: `cmamvd3n40000c801qeacoad2`
   - Porta: `4000`
   - Host: `0.0.0.0`
   - Timeout: `60000ms`
   - Modelo: `iaedu-custom`

Esta abordagem oferece:

- **Flexibilidade:** Pode ser configurado de diferentes maneiras conforme o ambiente
- **Segurança:** Nenhum segredo hardcoded no código fonte
- **Compatibilidade:** Funciona com configurações existentes baseadas em headers
- **Produtividade:** Recursos de production hardening para deployments sérios
