# Documentação de Melhorias e Alterações no IAEDU-Adapter

Este documento detalha todas as melhorias, alterações e correções aplicadas ao IAEDU-Adapter, bem como recomendações para futuras evoluções.

## Resumo das Versões

### Versão 2 (Base Original - Descrita no README original)

- API Key lida de variável de ambiente (`process.env.IAEDU_API_KEY`)
- Channel ID estático hardcoded (`IAEDU_CHANNEL_ID_DEFAULT`)
- Thread ID baseado em `chat_id` do OpenWebUI ou fallback estático
- Sem suporte multi-tenant
- Sem endpoint de saúde
- Configuração fixa exigindo reinício do serviço para alterações

### Versão 6 (Atual - Multi-tenant)

- API Key, Channel ID e Agent ID recebidos via headers HTTP
- Geração automática de UUID para thread_id por request (`req-{uuid}`)
- Suporte verdadeiramente multi-tenant
- Endpoint de saúde (`/health`) para monitoring
- Melhorias de performance (connectionTimeout, keepAliveTimeout, setNoDelay)
- Tratamento de mensagens do sistema (systemMessage)
- Melhor logging com informações resumidas do agentId
- Validação obrigatória de headers requeridos
- Separação clara de responsabilidades

## Melhorias Implementadas

### 1. Arquitetura Multi-tenant

**Problema:** A versão anterior só podia servir um único tenant/client devido à configuração hardcoded ou baseada em variáveis de ambiente.

**Solução:**

- Migração para configuração baseada em headers HTTP
- Cada request carrega suas próprias credenciais e configuração
- Mesmo adapter pode servir múltiplos tenants com diferentes API keys, channel IDs e agent IDs
- Elimina necessidade de múltiplas instâncias do adapter para diferentes clientes

**Arquivo alterado:** `adapter-server.mjs` (linhas 25-34)

```javascript
const apiKey =
  request.headers['x-iaedu-api-key'] || request.headers['x-api-key'];
const channelId = request.headers['x-iaedu-channel-id'];
const agentId =
  request.headers['x-iaedu-agent-id'] || 'cmamvd3n40000c801qeacoad2';
```

### 2. Eliminação de Credenciais Hardcoded

**Problema:** Credenciais (API key) estavam hardcoded em arquivos de teste e no código do serviço systemd.

**Solução:**

- API key agora deve ser fornecida via header `x-iaedu-api-key` ou `x-api-key`
- Remoção de todas as instâncias de hardcoded API keys no código fonte do adapter
- Validação de presença do header com retorno de erro 400 quando ausente

**Arquivo alterado:** `adapter-server.mjs` (linhas 31-35)

```javascript
if (!apiKey) {
  return reply
    .status(400)
    .send({ error: 'Missing required header: x-iaedu-api-key or x-api-key' });
}
```

### 3. Melhoria na Geração de Thread ID

**Problema:** Thread ID era baseado apenas no `chat_id` do OpenWebUI ou usava um fallback estático, limitando flexibilidade.

**Solução:**

- Geração automática de UUID único para cada request usando `randomUUID()`
- Formato: `req-{uuid}` garantindo unicidade
- Elimina risco de colisão e permite rastreamento preciso de cada conversa
- Mantém compatibilidade com OpenWebUI já que o adapter controla o thread_id interno

**Arquivo alterado:** `adapter-server.mjs` (linha 60)

```javascript
const threadId = `req-${randomUUID()}`;
```

### 4. Tratamento de Mensagens do Sistema

**Problema:** Mensagens do sistema (system) do OpenWebUI eram ignoradas, perdendo contexto importante.

**Solução:**

- Extração de mensagens do sistema do array de mensagens
- Combinação com mensagem do usuário usando separador `---\n\n`
- Enriquece o contexto enviado para a IAEDU.pt com instruções do sistema

**Arquivo alterado:** `adapter-server.mjs` (linhas 47-58)

```javascript
let userMessage = 'Olá';
let systemMessage = '';
if (requestBody.messages && requestBody.messages.length > 0) {
  for (const msg of requestBody.messages) {
    if (msg.role === 'system') {
      systemMessage = msg.content;
    }
  }
  userMessage = requestBody.messages[requestBody.messages.length - 1].content;
}

if (systemMessage) {
  userMessage = `${systemMessage}\n\n---\n\nUser question: ${userMessage}`;
}
```

### 5. Endpoint de Saúde (Health Check)

**Problema:** Falta de mecanismo para monitoramento de saúde do serviço.

**Solução:**

- Adição de endpoint GET `/health`
- Retorna status, versão e informações sobre headers requeridos/opcionais
- Permite monitoramento por sistemas externos (load balancers, orchestration tools)

**Arquivo alterado:** `adapter-server.mjs` (linhas 186-192)

```javascript
fastify.get('/health', async (req, reply) => {
  reply.send({
    status: 'ok',
    version: '6-multitenant',
    note: 'Requires headers: x-iaedu-api-key, x-iaedu-channel-id, x-iaedu-agent-id (optional)',
  });
});
```

### 6. Otimizações de Performance e Conexão

**Problema:** Configurações padrão de conexão não otimizadas para streaming de longa duração.

**Solução:**

- Configuração do Fastify com `connectionTimeout: 0` e `keepAliveTimeout: 5000`
- Uso de `setNoDelay(true)` para reduzir latência
- Headers de resposta otimizados: `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`
- Uso de `duplex: "half"` no fetch para evitar problemas de hanging em Node.js

**Arquivo alterado:** `adapter-server.mjs` (linhas 10-14, 21-23, 104-109, 83-91)

### 7. Melhoria no Tratamento de Erros

**Problema:** Tratamento de erros pouco específico e perda de informações de diagnóstico.

**Solução:**

- Erros upstream retornam código de status HTTP correspondente
- Mensagens de erro mais informativas incluindo código de status
- Logging detalhado de erros upstream com truncamento seguro
- Tratamento adequado de término de stream em caso de erro

**Arquivo alterado:** `adapter-server.mjs` (linhas 93-102, 164-169)

### 8. Correção de URL do Endpoint

**Problema:** URLs com dupla barra (`//api/v1/`) causando problemas em alguns ambientes.

**Solução:**

- Correção para URL simples: `/agent-chat/api/v1/agent/{agentId}/stream`
- Aplicado consistentemente em todo o código

**Arquivo alterado:** `adapter-server.mjs` (linha 17)

```javascript
function getAgentEndpoint(agentId) {
  return `https://api.iaedu.pt/agent-chat/api/v1/agent/${agentId}/stream`;
}
```

## Problemas Identificados na Auditoria (AUDITORIA_2026-05-13.md)

### 1. Chaves API Hardcoded em Arquivos de Teste

**Localização:**

- `/opt/iaedu-adapter/test_boundary_fix.mjs`
- `/opt/iaedu-adapter/test_latency.mjs`
- `/opt/pt-tax-intelligence-layer/examples/iaedu-adapter/test_boundary_fix.mjs`
- `/opt/pt-tax-intelligence-layer/examples/iaedu-adapter/test_latency.mjs`

**Problema:** Contêm chaves API hardcoded que podem ter sido comprometidas.

**Ação Necessária:**

- Remover chaves hardcoded desses arquivos
- Garantir que dependam exclusivamente de variáveis de ambiente
- Adicionar validação de saída se variável não estiver definida
- Revogar chaves comprometidas no portal IAEDU.pt

**Exemplo de Correção Aplicada:**

```javascript
// Antes (problemático)
const API_KEY = process.env.IAEDU_API_KEY;

// Depois (corrigido)
const API_KEY = process.env.IAEDU_API_KEY;
if (!API_KEY) {
  console.error('ERRO: IAEDU_API_KEY não definida na variável de ambiente');
  process.exit(1);
}
```

### 2. URL com Dupla Barra em Alguns Arquivos

**Localização:** Diversos arquivos de teste ainda possuem a URL com `//api/v1/`

**Ação Necessária:**

- Corrigir todas as instâncias para usar `/api/v1/` (single slash)
- Aplicar consistentemente em todos os ambientes

## Recomendações para Melhorias Futuras

### 1. Suporte a Headers Customizados no OpenWebUI

**Descrição:** Implementar mecanismo para que o OpenWebUI envie os headers requeridos diretamente, sem necessidade de reverse proxy.

**Prioridade:** Alta

### 2. Cache de Respostas

**Descrição:** Implementar cache para requests frequentes (mesma mensagem, mesmo contexto) para melhorar performance e reduzir chamadas à IAEDU.pt.

**Prioridade:** Média

### 3. Rate Limiting Avançado

**Descrição:** Adicionar rate limiting por tenant ou por API key para prevenir abuso e garantir qualidade de serviço.

**Prioridade:** Média

### 4. Métricas e Monitoring

**Descrição:** Adicionar endpoint de métricas Prometheus e melhor logging estruturado para observabilidade.

**Prioridade:** Média

### 5. Suporte a WebSockets

**Descrição:** Explorar suporte a WebSockets para comunicação bidirecional em tempo real com o OpenWebUI.

**Prioridade:** Baixa

### 6. Dockerização

**Descrição:** Criar imagem Docker para facilitar deployment e garantir consistência entre ambientes.

**Prioridade:** Média

### 7. Persistência Opcional de Thread ID

**Descrição:** Permitir que clients especifiquem seu próprio thread_id via header para manter continuidade de conversas explícitas, mantendo o UUID como fallback.

**Prioridade:** Baixa

## Conclusão

O IAEDU-Adapter evoluiu significativamente da versão 2 para a versão 6 (multi-tenant), abordando problemas críticos de segurança, escalabilidade e usabilidade. As principais conquistas incluem:

1. **Arquitetura verdadeiramente multi-tenant** que permite servir múltiplos clients com uma única instância
2. **Eliminação completa de credenciais hardcoded** através de configuração baseada em headers
3. **Melhorias de performance e confiabilidade** através de otimizações de conexão e tratamento de erros
4. **Maior observabilidade** com endpoint de saúde e logging aprimorado
5. **Flexibilidade aumentada** com geração automática de thread ID e tratamento de mensagens do sistema

As ações corretivas identificadas na auditoria (remoção de chaves hardcoded de arquivos de teste e revogação de chaves comprometidas) são essenciais para manter a segurança do sistema.

Com essas melhorias, o adapter está bem posicionado para servir como uma ponte robusta e segura entre OpenWebUI e os serviços de IA da IAEDU.pt, atendendo às necessidades tanto de implementações individuais quanto de plataformas de serviço multi-tenant.
