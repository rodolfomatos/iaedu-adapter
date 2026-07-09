# Quality Gates

## Node.js / Fastify Project Gates

| Gate       | Command                 | Pass Condition               |
| ---------- | ----------------------- | ---------------------------- |
| Lint       | `make lint`             | Exit 0, no errors            |
| Test       | `make test`             | Exit 0, all tests pass       |
| Format     | `make format:check`     | Exit 0, no changes needed    |
| Health     | `make health`           | Returns `{"status":"ok"}`    |
| Ready      | `make ready`            | Returns `{"status":"ready"}` |
| Doctor     | `make doctor`           | All checks green             |
| No secrets | grep for hardcoded keys | No matches in source         |

## Service Gates

| Gate         | Check                                        |
| ------------ | -------------------------------------------- |
| Service runs | `systemctl is-active iaedu-adapter` = active |
| Auto-restart | RestartSec=10 in service file                |
| Env loaded   | `EnvironmentFile=/opt/iaedu-adapter/.env`    |
| Permissions  | .env is 600, owned by www-data               |

## Regression Detection

Before any change to adapter-server.mjs:

1. Run `make test` (baseline)
2. Make change
3. Run `make test` again
4. Compare results
5. Run `make health` to verify service is alive
