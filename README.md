# iaedu-adapter

[![Test](https://github.com/rodolfomatos/iaedu-adapter/actions/workflows/test.yml/badge.svg)](https://github.com/rodolfomatos/iaedu-adapter/actions/workflows/test.yml)

*Adapter* OpenWebUI para a API iaedu.pt. Traduz pedidos OpenAI em `multipart/form-data` e converte o stream NDJSON de resposta em SSE.

## O que faz

```
OpenWebUI  →  [adapter:4000]  →  api.iaedu.pt
           ←  SSE stream       ←  NDJSON stream
```

- Converte o formato OpenAI (`POST /v1/chat/completions` em JSON) para `FormData`
- Encaminha para a API iaedu.pt
- Converte o stream NDJSON de resposta em `text/event-stream` (SSE)
- Gestao de threads: cada pedido usa um `chat_id` do OpenWebUI (ou UUID gerado)

## Requisitos

- Node.js 18+
- API key da iaedu.pt (obtida diretamente do fornecedor)
- OpenWebUI a correr (provavelmente em Docker)

## Instalacao rapida

```bash
# 1. Clonar/instalar
npm install

# 2. Criar .env com a API key
cp .env.example .env
# Editar .env e colocar o valor real em IAEDU_API_KEY

# 3. Arrancar
npm start
```

## Configuracao (variaveis de ambiente)

| Variavel | Obrigatorio | Default | Descricao |
|----------|-------------|---------|-----------|
| `IAEDU_API_KEY` | Sim | — | Chave API da iaedu.pt |
| `IAEDU_ENDPOINT` | Nao | URL hardcoded | Endpoint da stream API |
| `IAEDU_CHANNEL_ID` | Nao | hardcoded | Channel ID |
| `MODEL_NAME` | Nao | `iaedu-custom` | Nome do modelo reportado ao OpenWebUI |
| `ADAPTER_PORT` | Nao | `4000` | Porta local do adapter |
| `SERVER_HOST` | Nao | `0.0.0.0` | Interface de bind |
| `REQUEST_TIMEOUT_MS` | Nao | `60000` | Timeout por pedido (ms) |

## Integracao com OpenWebUI

1. Abrir OpenWebUI → Definicões → Ligacoes
2. Configurar:
   - **URL Base:** `http://host.docker.internal:4000/v1` (ou IP do servidor)
   - **Chave API:** `dummy_key` (nao e usada pelo adapter)
   - **Nome do Modelo:** `iaedu-custom`

## Endpoints

| Metodo | Path | Descricao |
|--------|------|-----------|
| `POST` | `/v1/chat/completions` | Chat (formato OpenAI) |
| `GET` | `/v1/models` | Lista de modelos |
| `GET` | `/health` | Health check (`{status:"ok", uptime:N}`) |
| `GET` | `/ready` | Readiness check |

## Deployment com systemd

```bash
# Criar o servico
sudo vim /etc/systemd/system/iaedu-adapter.service
```

```ini
[Unit]
Description=IAEDU API Adapter for OpenWebUI
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/iaedu-adapter
ExecStart=/usr/bin/node adapter-server.mjs
EnvironmentFile=/opt/iaedu-adapter/.env
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
# Proteger o .env
sudo chmod 600 /opt/iaedu-adapter/.env
sudo chown www-data:www-data /opt/iaedu-adapter/.env

# Ativar
sudo systemctl daemon-reload
sudo systemctl start iaedu-adapter
sudo systemctl enable iaedu-adapter
```

## Testes

```bash
# Testes automatizados (requer adapter a correr)
IAEDU_API_KEY=... npm test

# Teste de conectividade (envia pedido real)
IAEDU_API_KEY=... node test/test_api_dynamic_thread.mjs
```

## Desenvolvimento

```bash
# Arrancar em modo dev (com --watch)
npm run dev

# Teste de velocidade
IAEDU_API_KEY=... node test/test_speed.mjs

# Teste de latencia
IAEDU_API_KEY=... node test/test_latency.mjs
```

## Limitaçoes conhecidas

- **Threads efemeiras**: cada pedido e independente. O historico de conversa e enviado
  no campo `messages` pelo OpenWebUI a cada pedido.
- Nao ha retry automatico em falhas upstream.
- Nao ha rate limiting.

Ver [docs/ROADMAP.md](docs/ROADMAP.md) para a lista completa de issues e prioridades.