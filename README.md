# IAEDU Adapter

Servidor Node.js (Fastify) que adapta o formato OpenAI do OpenWebUI para a API iaedu.pt. Converte JSON para multipart/form-data e faz stream NDJSON → SSE em tempo real.

## Quick Start

```bash
# 1. Instalar dependências
make setup

# 2. Configurar variáveis de ambiente
sudo cp .env.example .env
sudo nano .env  # preencher IAEDU_API_KEY

# 3. Instalar e iniciar serviço
make install-service
make start

# 4. Verificar
make health
```

## Comandos Make

```bash
# Serviço
make start          # Iniciar serviço
make stop           # Parar serviço
make restart        # Reiniciar serviço
make status         # Estado do serviço
make logs           # Logs em tempo real
make logs-tail      # Últimas 50 linhas
make enable         # Ativar arranque automático
make disable        # Desativar arranque automático

# Desenvolvimento
make dev            # Executar em foreground
make setup          # Instalar dependências

# Qualidade
make test           # Correr testes
make lint           # Verificar código (eslint)
make lint-fix       # Corrigir código automaticamente
make format         # Formatar com prettier
make format-check   # Verificar formatação
make check          # lint + test

# Saúde
make health         # Verificar /health
make ready          # Verificar /ready
make doctor         # Diagnóstico completo

# Instalação
make install-service    # Instalar serviço systemd
make uninstall-service  # Remover serviço systemd
make clean              # Remover node_modules
```

## Configuração

Variáveis de ambiente em `.env` (carregadas pelo systemd):

| Variável             | Obrigatório | Default                     | Descrição          |
| -------------------- | ----------- | --------------------------- | ------------------ |
| `IAEDU_API_KEY`      | Sim         | —                           | Chave API iaedu.pt |
| `IAEDU_CHANNEL_ID`   | Não         | `cmh0rfgmn0i64j801uuoletwy` | Channel ID         |
| `IAEDU_AGENT_ID`     | Não         | `cmamvd3n40000c801qeacoad2` | Agent ID           |
| `ADAPTER_PORT`       | Não         | `4000`                      | Porta do servidor  |
| `SERVER_HOST`        | Não         | `0.0.0.0`                   | Host do servidor   |
| `MODEL_NAME`         | Não         | `iaedu-custom`              | Nome do modelo     |
| `REQUEST_TIMEOUT_MS` | Não         | `60000`                     | Timeout em ms      |
| `LOG_LEVEL`          | Não         | `info`                      | Nível de log       |

**Precedência:** Headers HTTP > Variáveis de ambiente > Defaults

Headers suportados por request:

- `x-iaedu-api-key` ou `x-api-key` — API key
- `x-iaedu-channel-id` — Channel ID
- `x-iaedu-agent-id` — Agent ID

## Endpoints

| Método | Path                   | Descrição                |
| ------ | ---------------------- | ------------------------ |
| POST   | `/v1/chat/completions` | Chat (compatível OpenAI) |
| GET    | `/v1/models`           | Lista de modelos         |
| GET    | `/health`              | Liveness probe           |
| GET    | `/ready`               | Readiness probe          |

## Arquitectura

```
OpenWebUI → POST /v1/chat/completions (JSON)
                 ↓
         Fastify valida (JSON schema)
                 ↓
         FormData → iaedu.pt API
                 ↓
         NDJSON stream → SSE → OpenWebUI
```

## Sistema de Serviço

O adapter corre como serviço systemd (`iaedu-adapter.service`):

- Arranca automaticamente no boot
- Reinicia automaticamente em caso de falha (10s delay)
- API key carregada de `/opt/iaedu-adapter/.env` (sem chaves hardcoded)
- Logs no journal: `journalctl -u iaedu-adapter -f`

## OpenWebUI

Configuração no OpenWebUI (Settings → Connections):

- **Base URL:** `http://host.docker.internal:4000/v1`
- **API Key:** `dummy_key` (não é usada diretamente)
- **Model:** `iaedu-custom`

Para passar headers customizados, usar um reverse proxy (Nginx/Caddy) que adicione `x-iaedu-api-key`, `x-iaedu-channel-id` e `x-iaedu-agent-id`.

## Project Structure

```
adapter-server.mjs    # Servidor (ficheiro único)
package.json          # Dependências
.env                  # Variáveis de ambiente (não committado)
Makefile              # Comandos de gestão
CLAUDE.md             # Contrato operacional AES
docs/                 # Documentação do projecto
aes/                  # Estrutura AES (kanban, sprints, tickets)
test/                 # Testes
```

## Desenvolvimento

```bash
# Correr em foreground com auto-reload
make dev

# Correr testes contra o serviço em execução
make test

# Verificar qualidade completa
make check
```

## Licença

MIT
