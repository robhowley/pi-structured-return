# pi-structured-return

Structured command execution for pi agents: compact results for the model, full logs for humans.

Cross-platform Pi package that combines:
- a `structured-return` skill for choosing compact / machine-readable command forms
- a `structured-return` extension that captures output, stores artifacts, applies parsers, and falls back to tail + log path

## Token reduction on failure cases

| Parser | Raw | Structured | Reduction | Notes |
|---|---|---|---|---|
| pytest-json-report | 299 | 65 | **78%** | 2 tests, 1 failure, default verbose output |
| vitest-json | 239 | 72 | **70%** | 27 tests, 1 failure, default reporter with source diff |
| ruff-json | 354 | 234 | **34%** | 5 errors, source context + help lines per error |
| eslint-json | 305 | 299 | **2%** | 9 warnings across 3 files, already compact formatter |

The noisier the tool's default output, the more structured_return pays off. For eslint the win comes at scale as errors spread across files — relative paths and grouped output keep per-error cost flat while raw bash pays a full absolute path header per file.

## Built-in parsers
- `pytest-json-report`
- `ruff-json` (`ruff check` only — `ruff format` has no json support)
- `eslint-json`
- `vitest-json`

## Project-local extension point
- `.pi/structured-return.json`
- `.pi/parsers/*.ts`

## Slash commands
- `/sr-parsers` — list all registered parsers (built-in and project-local) with their match rules and targets

## Structured result schema
- `tool`
- `exitCode`
- `status`
- `summary`
- `cwd`
- `failures`
- `artifact`
- `logPath`
- `rawTail`
