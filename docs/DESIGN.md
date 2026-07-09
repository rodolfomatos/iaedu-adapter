# Design Document

## Overview

Single-file Node.js server (Fastify) that bridges OpenWebUI to iaedu.pt API.

## Data Flow

```
OpenWebUI (JSON) → POST /v1/chat/completions
                          ↓
              Fastify validates (JSON schema)
                          ↓
              Extract messages, build FormData
                          ↓
              POST to iaedu.pt (multipart/form-data)
                          ↓
              NDJSON stream from iaedu.pt
                          ↓
              Parse each line, extract tokens
                          ↓
              SSE stream to OpenWebUI (text/event-stream)
```

## Endpoints

| Method | Path                 | Purpose                                |
| ------ | -------------------- | -------------------------------------- |
| POST   | /v1/chat/completions | Main chat endpoint (OpenAI-compatible) |
| GET    | /v1/models           | Model discovery for OpenWebUI          |
| GET    | /health              | Liveness probe                         |
| GET    | /ready               | Readiness probe                        |

## Configuration Architecture

```
Headers (per-request) > Environment Variables > Defaults
```

| Config     | Header             | Env Var            | Default                   |
| ---------- | ------------------ | ------------------ | ------------------------- |
| API Key    | x-iaedu-api-key    | IAEDU_API_KEY      | (required)                |
| Channel ID | x-iaedu-channel-id | IAEDU_CHANNEL_ID   | cmh0rfgmn0i64j801uuoletwy |
| Agent ID   | x-iaedu-agent-id   | IAEDU_AGENT_ID     | cmamvd3n40000c801qeacoad2 |
| Port       | —                  | ADAPTER_PORT       | 4000                      |
| Host       | —                  | SERVER_HOST        | 0.0.0.0                   |
| Model      | —                  | MODEL_NAME         | iaedu-custom              |
| Timeout    | —                  | REQUEST_TIMEOUT_MS | 60000                     |

## Error Handling

| Scenario                  | HTTP Status | Notes                 |
| ------------------------- | ----------- | --------------------- |
| Missing API key           | 400         | Returns error message |
| Missing channel ID        | 400         | Returns error message |
| Upstream error (iaedu.pt) | 502         | Bad Gateway           |
| Upstream timeout          | 504         | Gateway Timeout       |
| Internal error            | 500         | Server Error          |

## Streaming

- Uses `duplex: 'half'` for Node.js fetch compatibility
- SSE headers include `X-Accel-Buffering: no` for nginx proxy support
- Stream closed with `[DONE]` marker per OpenAI spec
- Socket `setNoDelay(true)` for low-latency streaming

## Security

- No hardcoded secrets (API key via .env or headers)
- .env file permissions: 600, owned by www-data
- No sensitive data in logs (agent ID truncated to 12 chars)
- Body limit: 1MB
