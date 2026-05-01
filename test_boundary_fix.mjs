// Ficheiro: test_boundary_fix.mjs
// Teste: validacao da correcao de boundary no FormData e URL
//
// Uso: IAEDU_API_KEY=... node test_boundary_fix.mjs

import { performance } from 'perf_hooks';

const ENDPOINT = process.env.IAEDU_ENDPOINT || 'https://api.iaedu.pt/agent-chat/api/v1/agent/cmamvd3n40000c801qeacoad2/stream';
const API_KEY = process.env.IAEDU_API_KEY;
const CHANNEL_ID = 'cmh0rfgmn0i64j801uuoletwy';

if (!API_KEY) {
    console.error('ERRO: Define IAEDU_API_KEY na variavel de ambiente.');
    process.exit(1);
}

async function testRobustRequest() {
    console.log('--- Teste ROBUSTO ---');

    const formData = new FormData();
    formData.append('channel_id', CHANNEL_ID);
    formData.append('thread_id', `test-debug-${Date.now()}`);
    formData.append('user_info', '{}');
    formData.append('message', 'Isto e um teste de conectividade.');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const start = performance.now();

    try {
        console.log(`URL: ${ENDPOINT}`);

        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'x-api-key': API_KEY,
                'Connection': 'close'
            },
            body: formData,
            duplex: 'half',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const duration = (performance.now() - start) / 1000;
        console.log(`Resposta em ${duration.toFixed(2)}s — Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const text = await response.text();
            console.error('ERRO CORPO:', text);
            return;
        }

        console.log('--- A ler Stream ---');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let chunkCount = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            chunkCount++;
            if (chunkCount === 1) {
                console.log('Primeiros dados:', decoder.decode(value).substring(0, 100) + '...');
            }
        }
        console.log('Stream concluido.');

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('ERRO: Timeout de 10s.');
        } else {
            console.error('ERRO:', error);
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

testRobustRequest();