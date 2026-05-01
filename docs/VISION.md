# VISION.md — iaedu-adapter

## O Problema

O OpenWebUI komunika usando o formato da API OpenAI (JSON/HTTPS), mas a API proprietária da iaedu.pt espera `multipart/form-data` no pedido e devolve um _stream_ NDJSON na resposta. Estas duas interfaces sao incompatíveis — sem uma ponte, nao ha comunicaçao.

## A Soluçao

Um servidor _adapter_ em Node.js que:
1. Recebe pedidos no formato OpenAI (`POST /v1/chat/completions`)
2. Traduz para `multipart/form-data` e faz o _forward_ para `api.iaedu.pt`
3. Converte o _stream_ NDJSON de resposta em SSE (`text/event-stream`)
4. Devolve ao OpenWebUI de forma transparente

## Proposta de Valor

- **Zero modificaçao no OpenWebUI** — funciona como qualquer outro fornecedor de API OpenAI-compatible
- **Zero modificaçao na API iaedu.pt** — o adapter абстраги a incompatibilidade de formato
- **Sessao isolada por pedido** — cada pedido e tratado como uma conversa independiente (thread efémera)
- **Seguranca** — a API key nunca está no código-fonte, lida apenas de variáveis de ambiente

## Arquitetura

```
OpenWebUI
   |  POST /v1/chat/completions  (JSON)
   v
iaedu-adapter  (Fastify, porta 4000)
   |  POST /agent-chat/...  (FormData, NDJSON stream)
   v
api.iaedu.pt
```

## Design Decisions

| decisáo | razáo |
|---------|-------|
| Thread efémera (UUID aleatório por pedido) | Garante contexto limpo em cada chamada — nao há historic cumulativo |
| FormData em vez de JSON | A API iaedu.pt exige este formato |
| NDJSON → SSE | OpenWebUI espera Server-Sent Events |
| Fastify em vez de raw Node http | Melhor performance, validação, e logging integrado |
| Variaveis de ambiente para segredos | Nunca no código-fonte |

## Estado Atual

Protótipo funcional em produçao auto-hospedada, com as limitaçoes documentadas em ROADMAP.md.