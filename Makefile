.PHONY: all setup run dev test smoke check syntax-check doctor help

# Target padrão
all: test

# Instalar dependências (instalação limpa a partir do lockfile)
setup:
	@echo "🔧 Installing dependencies..."
	npm ci

install: setup

# Arrancar o adapter em produção
run:
	@echo "🚀 Starting adapter..."
	npm start

# Arrancar em modo desenvolvimento com watch
dev:
	@echo "🛠️  Starting adapter in watch mode..."
	npm run dev

# Executar smoke tests
test:
	@echo "🧪 Running smoke tests..."
	npm test

smoke: test

# Verificação de sintaxe de todos os .mjs
syntax-check:
	@echo "🔍 Checking syntax of JavaScript modules..."
	@for f in adapter-server.mjs test/*.mjs test_*.mjs; do \
		if [ -f "$$f" ]; then \
			node --check "$$f" || { echo "❌ Syntax error in $$f"; exit 1; }; \
		fi \
	done
	@echo "✅ All files have valid syntax."

# Combined quality gate: syntax + tests
check: syntax-check test

# Mostrar informações do ambiente
doctor:
	@echo "🔧 Environment:"
	@echo "  Node:   $$(node --version 2>/dev/null || echo 'not installed')"
	@echo "  npm:    $$(npm --version 2>/dev/null || echo 'not installed')"
	@echo "  Port:   $${ADAPTER_PORT:-4000}"
	@echo "  CWD:    $(CWD)"
	@echo "  Git:    $$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'not a repo')"

# Ajuda
help:
	@echo "Makefile targets:"
	@echo "  make setup      - Install dependencies (npm ci)"
	@echo "  make run        - Start adapter (production)"
	@echo "  make dev        - Start adapter with watch"
	@echo "  make test       - Run smoke tests"
	@echo "  make check      - Run syntax check + tests"
	@echo "  make doctor     - Show environment info"
	@echo "  make help       - Show this help"
