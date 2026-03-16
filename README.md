# pi-structured-return

Structured command execution for pi agents: compact results for the model, full logs for humans.

Cross-platform Pi package that combines:
- a `structured-return` skill for choosing compact / machine-readable command forms
- a `structured-return` extension that captures output, stores artifacts, applies parsers, and falls back to tail + log path

Built-in parsers:
- pytest json report
- ruff json
- eslint json

Project-local extension point:
- `.pi/machine-readable.json`
- `.pi/parsers/*.ts`

Slash commands:
- `/sr-parsers` — list all registered parsers (built-in and project-local) with their match rules and targets

Structured result schema:
- `tool`
- `exitCode`
- `status`
- `summary`
- `failures`
- `artifact`
- `logPath`
- `rawTail`
