# Pre-Commit Checklist

## Pre-commit (quick)

- [ ] `make lint` passes
- [ ] `make test` passes
- [ ] `make format:check` passes
- [ ] No `console.log` in src files
- [ ] No TODO/FIXME in new code
- [ ] No hardcoded secrets
- [ ] Health endpoint works (`make health`)
- [ ] Diffstory written (for AES tickets)

## Pre-release (thorough)

- [ ] All pre-commit items
- [ ] Service restarts cleanly (`make restart`)
- [ ] `make doctor` all green
- [ ] README.md reflects current state
- [ ] .env.example matches actual env vars used
- [ ] systemd service uses EnvironmentFile (not hardcoded keys)
- [ ] No breaking changes to API contract
- [ ] Logs reviewed for errors

## Blockers

| Item                 | Level   |
| -------------------- | ------- |
| Lint errors          | BLOCKER |
| Test failures        | BLOCKER |
| Hardcoded secrets    | BLOCKER |
| Health endpoint down | BLOCKER |
| Format issues        | WARNING |
| Missing docs         | WARNING |
