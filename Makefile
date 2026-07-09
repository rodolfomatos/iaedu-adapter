SERVICE := iaedu-adapter
NODE := /usr/bin/node
ADAPTER := adapter-server.mjs
PORT := 4000

# --- Service Management ---

.PHONY: start stop restart status logs logs-tail enable disable

start:
	sudo systemctl start $(SERVICE)

stop:
	sudo systemctl stop $(SERVICE)

restart:
	sudo systemctl restart $(SERVICE)

status:
	sudo systemctl status $(SERVICE)

logs:
	sudo journalctl -u $(SERVICE) -f --no-pager

logs-tail:
	sudo journalctl -u $(SERVICE) -n 50 --no-pager

enable:
	sudo systemctl enable $(SERVICE)

disable:
	sudo systemctl disable $(SERVICE)

# --- Development ---

.PHONY: dev setup install

dev:
	node $(ADAPTER)

setup:
	npm install

install: setup
	@echo "Dependencies installed."

# --- Quality Gates ---

.PHONY: test lint lint-fix format format-check health ready doctor

test:
	node test/basic.test.mjs

lint:
	npx eslint . --ext .js,.mjs

lint-fix:
	npx eslint . --ext .js,.mjs --fix

format:
	npx prettier --write .

format-check:
	npx prettier --check .

health:
	@curl -sf http://localhost:$(PORT)/health | python3 -m json.tool || echo "DOWN"

ready:
	@curl -sf http://localhost:$(PORT)/ready | python3 -m json.tool || echo "NOT READY"

doctor:
	@echo "=== Environment ==="
	@test -f .env && echo "  .env: found" || echo "  .env: MISSING"
	@echo "  Node: $$(node --version)"
	@test -d node_modules && echo "  node_modules: found" || echo "  node_modules: MISSING"
	@echo ""
	@echo "=== Service ==="
	@systemctl is-active $(SERVICE) 2>/dev/null && echo "  Status: running" || echo "  Status: not running"
	@echo "  Port: $(PORT)"
	@echo ""
	@echo "=== Health ==="
	@curl -sf http://localhost:$(PORT)/health | python3 -m json.tool 2>/dev/null || echo "  Health: unreachable"

# --- Code Quality ---

.PHONY: check clean

check: lint test
	@echo "All quality gates passed."

clean:
	rm -rf node_modules
	rm -f package-lock.json

# --- Service Installation ---

.PHONY: install-service uninstall-service

install-service:
	@echo "Creating systemd service..."
	@sudo cp /etc/systemd/system/$(SERVICE).service /etc/systemd/system/$(SERVICE).service.bak 2>/dev/null || true
	@sudo tee /etc/systemd/system/$(SERVICE).service > /dev/null << 'EOF'
	[Unit]
	After=network.target

	[Service]
	Type=simple
	User=www-data
	Group=www-data
	WorkingDirectory=/opt/iaedu-adapter
	ExecStart=$(NODE) $(ADAPTER)
	EnvironmentFile=/opt/iaedu-adapter/.env
	Restart=on-failure
	RestartSec=10
	StandardOutput=journal
	StandardError=journal

	[Install]
	WantedBy=multi-user.target
	EOF
	sudo systemctl daemon-reload
	sudo systemctl enable $(SERVICE)
	@echo "Service installed and enabled. Run 'make start' to start it."

uninstall-service:
	sudo systemctl stop $(SERVICE) 2>/dev/null || true
	sudo systemctl disable $(SERVICE) 2>/dev/null || true
	sudo rm -f /etc/systemd/system/$(SERVICE).service
	sudo systemctl daemon-reload
	@echo "Service removed."

# --- Info ---

.PHONY: help

help:
	@echo "IAEDU Adapter — Available Commands:"
	@echo ""
	@echo "  Service:"
	@echo "    make start          Start adapter service"
	@echo "    make stop           Stop adapter service"
	@echo "    make restart        Restart adapter service"
	@echo "    make status         Show service status"
	@echo "    make logs           Tail service logs"
	@echo "    make logs-tail      Last 50 log lines"
	@echo "    make enable         Enable service on boot"
	@echo "    make disable        Disable service on boot"
	@echo ""
	@echo "  Development:"
	@echo "    make dev            Run adapter in foreground"
	@echo "    make setup          Install npm dependencies"
	@echo ""
	@echo "  Quality:"
	@echo "    make test           Run tests"
	@echo "    make lint           Run eslint"
	@echo "    make lint-fix       Run eslint with auto-fix"
	@echo "    make format         Run prettier"
	@echo "    make format-check   Check formatting"
	@echo "    make check          Run lint + test"
	@echo ""
	@echo "  Health:"
	@echo "    make health         Check /health endpoint"
	@echo "    make ready          Check /ready endpoint"
	@echo "    make doctor         Full environment check"
	@echo ""
	@echo "  Install:"
	@echo "    make install-service   Install systemd service"
	@echo "    make uninstall-service Remove systemd service"
	@echo "    make clean            Remove node_modules"
