// test/smoke.mjs — Smoke tests para o iaedu-adapter
// Requer que o adapter esteja a correr (node adapter-server.mjs)
// Requer IAEDU_API_KEY definida.
//
// Uso: IAEDU_API_KEY=... node --test test/smoke.mjs
//
// Estes testes NAO dependem da API iaedu.pt — testam apenas o adapter.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

const BASE = process.env.ADAPTER_URL || 'http://localhost:4000';

let abortController;

async function POST(path, body) {
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return res;
}

describe('GET /health', () => {
    it('retorna 200 e status ok', async () => {
        const res = await fetch(`${BASE}/health`);
        const json = await res.json();
        assert.strictEqual(res.status, 200);
        assert.strictEqual(json.status, 'ok');
        assert.ok(typeof json.uptime === 'number');
        assert.ok(typeof json.ts === 'string');
    });
});

describe('GET /ready', () => {
    it('retorna 200 quando IAEDU_API_KEY esta definida', async () => {
        const res = await fetch(`${BASE}/ready`);
        const json = await res.json();
        assert.strictEqual(res.status, 200);
        assert.strictEqual(json.status, 'ready');
    });
});

describe('GET /v1/models', () => {
    it('retorna lista de modelos', async () => {
        const res = await fetch(`${BASE}/v1/models`);
        const json = await res.json();
        assert.strictEqual(res.status, 200);
        assert.strictEqual(json.object, 'list');
        assert.ok(Array.isArray(json.data));
        assert.ok(json.data.length > 0);
        assert.strictEqual(json.data[0].id, 'iaedu-custom');
    });
});

describe('POST /v1/chat/completions — validacao de esquema', () => {
    it('retorna 400 quando messages falta', async () => {
        const res = await POST('/v1/chat/completions', {});
        assert.strictEqual(res.status, 400);
    });

    it('retorna 400 quando messages e vazio', async () => {
        const res = await POST('/v1/chat/completions', { messages: [] });
        assert.strictEqual(res.status, 400);
    });

    it('retorna 400 quando message falta role ou content', async () => {
        const res = await POST('/v1/chat/completions', {
            messages: [{ role: 'user' }]
        });
        assert.strictEqual(res.status, 400);
    });

    it('responde com body valido (stream ou erro JSON, nao crasha)', async () => {
        const res = await POST('/v1/chat/completions', {
            messages: [{ role: 'user', content: 'Ola' }]
        });
        const ct = res.headers.get('content-type');
        assert.ok(
            ct.includes('text/event-stream') || ct.includes('application/json'),
            `Esperado SSE ou JSON, obtive: ${ct}`
        );
    });
});