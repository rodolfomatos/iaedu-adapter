// Ficheiro: test_api_dynamic_thread.mjs
// Teste: thread_id dinâmico a partir do chat_id do OpenWebUI
//
// Uso: IAEDU_API_KEY=... node test_api_dynamic_thread.mjs

const ENDPOINT = process.env.IAEDU_ENDPOINT || 'https://api.iaedu.pt/agent-chat/api/v1/agent/cmamvd3n40000c801qeacoad2/stream';
const API_KEY = process.env.IAEDU_API_KEY;
const CHANNEL_ID = 'cmh0rfgmn0i64j801uuoletwy';

if (!API_KEY) {
    console.error('ERRO: Define IAEDU_API_KEY na variável de ambiente.');
    process.exit(1);
}

async function testDynamicThread() {
    const threadId = 'thread-openwebui-teste-' + Date.now();

    const formData = new FormData();
    formData.append('channel_id', CHANNEL_ID);
    formData.append('thread_id', threadId);
    formData.append('user_info', '{}');
    formData.append('message', 'Qual e o valor de X?');

    console.log(`Thread ID: ${threadId}`);
    console.log('--- INICIO DO STREAM ---');

    try {
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'x-api-key': API_KEY },
            body: formData,
            duplex: 'half'
        });

        if (!response.ok) {
            console.error(`Erro API: ${response.status} ${response.statusText}`);
            const errorBody = await response.text();
            console.error('Corpo do erro:', errorBody);
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            process.stdout.write(decoder.decode(value, { stream: true }));
        }

    } catch (error) {
        console.error('Erro de rede:', error);
    } finally {
        console.log('\n--- FIM DO STREAM ---');
    }
}

testDynamicThread();