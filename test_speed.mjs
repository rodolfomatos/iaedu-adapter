// Ficheiro: test_speed.mjs
// Teste: medir velocidade de geracao de tokens (TPS) da API iaedu.pt
//
// Uso: IAEDU_API_KEY=... node test_speed.mjs

import { performance } from 'perf_hooks';

const ENDPOINT = process.env.IAEDU_ENDPOINT || 'https://api.iaedu.pt/agent-chat/api/v1/agent/cmamvd3n40000c801qeacoad2/stream';
const API_KEY = process.env.IAEDU_API_KEY;
const CHANNEL_ID = 'cmh0rfgmn0i64j801uuoletwy';

if (!API_KEY) {
    console.error('ERRO: Define IAEDU_API_KEY na variavel de ambiente.');
    process.exit(1);
}

async function testSpeed() {
    const threadId = `speed-test-${Date.now()}`;
    const message = 'Escreve um poema longo sobre a importancia da velocidade na computacao.';

    const formData = new FormData();
    formData.append('channel_id', CHANNEL_ID);
    formData.append('thread_id', threadId);
    formData.append('user_info', '{}');
    formData.append('message', message);

    console.log('--- TESTE DE VELOCIDADE ---');

    const startTotal = performance.now();
    let firstTokenTime = 0;
    let tokenCount = 0;

    try {
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'x-api-key': API_KEY },
            body: formData,
            duplex: 'half'
        });

        if (!response.ok) throw new Error(`Erro API: ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (firstTokenTime === 0) {
                firstTokenTime = performance.now();
                console.log(`Latencia (TTFT): ${((firstTokenTime - startTotal) / 1000).toFixed(2)}s`);
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line) continue;
                try {
                    const json = JSON.parse(line);
                    if (json.type === 'token' && json.content) {
                        tokenCount++;
                        process.stdout.write('.');
                    }
                } catch (e) {}
            }
        }

        const endTotal = performance.now();
        const generationTime = (endTotal - firstTokenTime) / 1000;
        const tps = tokenCount / generationTime;

        console.log('\n\n--- RESULTADOS ---');
        console.log(`Total Tokens: ${tokenCount}`);
        console.log(`Tempo de Geracao: ${generationTime.toFixed(2)}s`);
        console.log(`VELOCIDADE: ${tps.toFixed(2)} tokens/segundo`);

        if (tps < 5) console.warn('AVISO: Velocidade muito baixa.');
        else console.log('Velocidade aceitavel.');

    } catch (error) {
        console.error(error);
    }
}

testSpeed();