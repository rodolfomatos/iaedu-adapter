# CLAUDE.md — IAEDU Adapter

## Project

OpenWebUI ↔ iaedu.pt API adapter. Translates OpenAI JSON format to iaedu.pt multipart/form-data and streams NDJSON responses as SSE. Single-file Node.js server (Fastify).

## Critical Files

- `adapter-server.mjs` — the entire server (single file, ~420 lines)
- `package.json` — dependencies and scripts
- `.env` — secrets (API key, never committed)
- `/etc/systemd/system/iaedu-adapter.service` — systemd service definition

## Commands

```bash
make start          # Start adapter as systemd service
make stop           # Stop the service
make restart        # Restart the service
make status         # Show service status
make logs           # Tail service logs (journalctl)
make test           # Run tests
make lint           # Run eslint
make lint-fix       # Run eslint with auto-fix
make format         # Run prettier
make format-check   # Check formatting
make health         # Curl health endpoint
make setup          # Install dependencies
make doctor         # Check environment health
```

## Non-Goals

- Do NOT add new dependencies without explicit approval (Fastify is the only runtime dep)
- Do NOT change the iaedu.pt API contract (we adapt to it, not the other way)
- Do NOT add authentication middleware (auth is handled by upstream headers)
- Do NOT split adapter-server.mjs into multiple files (simplicity > modularity at this scale)

## Never-Do

- Never hardcode API keys or secrets in source code
- Never expose `.env` in git or logs
- Never skip the `/health` or `/ready` endpoints
- Never remove the graceful shutdown handlers (SIGTERM/SIGINT)
- Never add emojis to source code (.mjs, .js files)

## Architecture

```
OpenWebUI → [adapter-server.mjs] → iaedu.pt API
                 ↓
         POST /v1/chat/completions (JSON)
         ↓ convert
         multipart/form-data → iaedu.pt
         ↓ convert
         NDJSON stream → SSE (text/event-stream) → OpenWebUI
```

## Config Precedence

Headers > Environment Variables > Defaults:

- `x-iaedu-api-key` / `x-api-key` → `IAEDU_API_KEY` → error
- `x-iaedu-channel-id` → `IAEDU_CHANNEL_ID` → default
- `x-iaedu-agent-id` → `IAEDU_AGENT_ID` → default

## Service Management

Service runs as `iaedu-adapter.service` under systemd.
API key loaded from `/opt/iaedu-adapter/.env` via `EnvironmentFile`.
Auto-restarts on failure with 10s delay.

## Testing

Tests use Node.js built-in test runner (`node:test`).
Test files are in `test/`.
Run with `make test` or `node test/basic.test.mjs`.

## Quality Gates

Before any change:

- [ ] `make lint` passes
- [ ] `make test` passes
- [ ] No hardcoded secrets
- [ ] Health endpoint still works (`make health`)
