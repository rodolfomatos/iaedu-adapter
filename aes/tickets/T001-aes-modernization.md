---
ticket: T001
title: AES modernization: Makefile, systemd, docs
sprint: sprint-01
priority: high
status: in-progress
created: 2026-07-09
---

# T001 — AES Modernization

## Context

The iaedu-adapter was built with an older version of the AES protocol. It lacks:

- CLAUDE.md operational contract
- Makefile for service management
- Proper systemd service (current one has hardcoded API key)
- AES project structure (kanban, sprints)
- Complete documentation (DESIGN.md, CHECKLIST.md)

## Acceptance Criteria

- [ ] CLAUDE.md created with project info, commands, non-goals, never-do
- [ ] Makefile with start/stop/restart, test, lint, format, health, doctor
- [ ] Systemd service uses EnvironmentFile (no hardcoded secrets)
- [ ] AES kanban, sprint, and ticket structure initialized
- [ ] Missing docs created (DESIGN.md, CHECKLIST.md, QUALITY_GATES.md)
- [ ] `make lint` passes
- [ ] `make test` passes
- [ ] `make health` returns ok

## Scope

**In scope:** Makefile, systemd service, CLAUDE.md, AES structure, missing docs
**Out of scope:** Code changes to adapter-server.mjs (beyond bug fixes), new features, dependency changes

## Dependencies

- systemd service must be running to test `make health`
- Node.js 18+ must be installed

## Rollback

- Restore original systemd service from git
- Remove newly created files

## Known Risks

- Service restart during systemd service update may cause brief downtime
- .env file must have correct permissions (600, www-data:www-data)

## Notes

- Bugs found and fixed: duplicate channelId check, broken template literal
- API key moved from hardcoded systemd service to .env file
