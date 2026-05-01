// Ficheiro: test_latency.mjs
// Teste: medir TTFB (time to first byte) da API iaedu.pt
//
// Uso: IAEDU_API_KEY=... node test_latency.mjs

import { performance } from 'perf_hooks';

const ENDPOINT = process.env.IAEDU_ENDPOINT || 'https://api.iaedu.pt/agent-chat/api/v1/agent/cmamvd3n40000c801qeacoad2/stream';
const API_KEY = process.env.IAEDU_API_KEY;
const CHANNEL_ID = 'cmh0rfgmn0i64j801uuoletwy';

if (!API_KEY) {
    console.error('ERRO: Define IAEDU_API_KEY na variavel de ambiente.');
    process.exit(1);
}

async function sendRequest(testName, message, threadId) {
    console.log(`\n--- ${testName} ---`);

    const formData = new FormData();
    formData.append('channel_id', CHANNEL_ID);
    formData.append('thread_id', threadId);
    formData.append('user_info', '{}');
    formData.append('message', message);

    const start = performance.now();

    try {
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'x-api-key': API_KEY },
            body: formData,
            duplex: 'half'
        });

        const ttfb = performance.now() - start;
        console.log(`Status: ${response.status}`);

        if (!response.ok) {
            const text = await response.text();
            console.error(`ERRO: ${text}`);
            return;
        }

        console.log(`TTFB: ${(ttfb / 1000).toFixed(2)}s`);

        const reader = response.body.getReader();
        const { value } = await reader.read();
        const decoder = new TextDecoder();
        console.log('Primeiro chunk:', decoder.decode(value).substring(0, 50) + '...');
        reader.cancel();

    } catch (error) {
        console.error('Erro:', error);
    }
}

async function runTests() {
    const randomId = `latency-test-${Date.now()}`;
    await sendRequest('Ping Simples', 'Ola, isto e um teste.', randomId);
    await sendRequest('Carga Media', 'Explica a teoria da relatividade geral e compara com a mecanica quantica.', randomId);
}

runTests();