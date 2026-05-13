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
