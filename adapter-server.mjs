// Ficheiro: adapter-server.mjs
// Versao 6 (Production Hardened)

import Fastify from 'fastify';
import { randomUUID } from 'crypto';

const ADAPTER_PORT = parseInt(process.env.ADAPTER_PORT || '4000', 10);
const MODEL_NAME = process.env.MODEL_NAME || 'iaedu-custom';
const IAEDU_API_KEY = process.env.IAEDU_API_KEY;
const IAEDU_ENDPOINT = process.env.IAEDU_ENDPOINT || 'https://api.iaedu.pt/agent-chat/api/v1/agent/cmamvd3n40000c801qeacoad2/stream';
const FIXED_CHANNEL_ID = process.env.IAEDU_CHANNEL_ID || 'cmh0rfgmn0i64j801uuoletwy';
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '60000', 10);
const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';

const fastify = Fastify({
    logger: { level: 'info' },
    connectionTimeout: 0,
    keepAliveTimeout: 5000,
    bodyLimit: 1024 * 1024
});

if (!IAEDU_API_KEY) {
    fastify.log.fatal('ERRO FATAL: IAEDU_API_KEY em falta nas variáveis de ambiente.');
    process.exit(1);
}

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
                    role: { type: 'string' },
                    content: { type: 'string', maxLength: 100000 }
                }
            }
        },
        chat_id: { type: 'string' },
        model: { type: 'string' }
    }
};

fastify.post('/v1/chat/completions', {
    schema: { body: chatCompletionSchema }
}, async (request, reply) => {
    if (reply.raw.socket) {
        reply.raw.socket.setNoDelay(true);
    }

    const requestBody = request.body;
    const userMessage = requestBody.messages[requestBody.messages.length - 1].content;
    const threadId = requestBody.chat_id || `req-${randomUUID()}`;

    fastify.log.info({ threadId, msgLength: userMessage.length }, 'Novo pedido recebido');

    const formData = new FormData();
    formData.append('channel_id', FIXED_CHANNEL_ID);
    formData.append('thread_id', threadId);
    formData.append('user_info', '{}');
    formData.append('message', userMessage);

    const abortController = new AbortController();
    const timeout = setTimeout(() => {
        abortController.abort();
        fastify.log.warn({ threadId }, 'Pedido excedeu timeout');
    }, REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(IAEDU_ENDPOINT, {
            method: 'POST',
            headers: {
                'x-api-key': IAEDU_API_KEY,
                'Connection': 'keep-alive'
            },
            body: formData,
            duplex: 'half',
            signal: abortController.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const errText = await response.text();
            fastify.log.error({ threadId, status: response.status, errText }, 'Erro upstream');
            reply.status(502).send({ error: `Erro upstream: ${response.status}` });
            return;
        }

        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const modelId = `chatcmpl-${Date.now()}`;
        let buffer = '';

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
                            choices: [{
                                index: 0,
                                delta: { content: parsed.content },
                                finish_reason: null
                            }]
                        });
                        reply.raw.write(`data: ${chunk}\n\n`);
                    }
                } catch (e) {
                    fastify.log.debug({ line }, 'Linha NDJSON ignorada');
                }
            }
        }

        const finishChunk = JSON.stringify({
            id: modelId,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: MODEL_NAME,
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
        });
        reply.raw.write(`data: ${finishChunk}\n\n`);
        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();

        fastify.log.info({ threadId }, 'Stream concluído');

    } catch (error) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
            fastify.log.warn({ threadId }, 'Stream abortado por timeout');
        } else {
            fastify.log.error({ threadId, error: error.message }, 'Erro no stream');
        }
        if (!reply.raw.headersSent) {
            reply.status(500).send({ error: 'Internal Adapter Error' });
        } else {
            reply.raw.end();
        }
    }
});

fastify.get('/v1/models', async (req, reply) => {
    reply.send({
        object: 'list',
        data: [{
            id: MODEL_NAME,
            object: 'model',
            created: Date.now(),
            owned_by: 'iaedu'
        }]
    });
});

fastify.get('/health', async (req, reply) => {
    reply.send({
        status: 'ok',
        uptime: process.uptime(),
        ts: new Date().toISOString()
    });
});

fastify.get('/ready', async (req, reply) => {
    if (!IAEDU_API_KEY) {
        reply.status(503).send({ status: 'not_ready', reason: 'missing_api_key' });
        return;
    }
    reply.send({ status: 'ready' });
});

const start = async () => {
    try {
        await fastify.listen({ port: ADAPTER_PORT, host: SERVER_HOST });
        fastify.log.info(`Adapter iaedu a correr no porto ${ADAPTER_PORT}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

const shutdown = async (signal) => {
    fastify.log.info({ signal }, 'Sinal de shutdown recebido — a fechar gracefully');
    try {
        await fastify.close();
        fastify.log.info('Server fechado com sucesso');
        process.exit(0);
    } catch (err) {
        fastify.log.error({ error: err.message }, 'Erro durante shutdown');
        process.exit(1);
    }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();