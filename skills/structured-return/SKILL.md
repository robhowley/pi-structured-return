---
name: structured-return
description: Choose compact, machine-readable commands across common test, lint, build, git, and log workflows. Use when raw terminal output would be noisy and the agent should prefer json, junit/xml, porcelain, quiet, no-pretty, or narrow-scope command forms.
---

# structured-return

Prefer better output at the source.

## Rules

1. Prefer machine-readable output when supported.
2. Otherwise prefer quiet, plain, no-color, and narrow-scope modes.
3. Prefer file/test-specific runs before full-suite runs.
4. Prefer bounded log reads over full log dumps.
5. Do not invent flags. Use known patterns from references.
6. When using `structured_return`, pass explicit parser hints when known.
7. If a repo defines project-local parser mappings in `.pi/machine-readable.json`, prefer those mappings.

## Categories

- Tests → see [references/tests.md](references/tests.md)
- Lint/static analysis → see [references/lint.md](references/lint.md)
- Build/compile → see [references/build.md](references/build.md)
- Fallback rules → see [references/fallback.md](references/fallback.md)

## Examples

### pytest
- `structured_return({ command: "pytest --json-report --json-report-file=.tmp/pytest-report.json", parseAs: "pytest-json-report", artifactPaths: [".tmp/pytest-report.json"] })`
- `structured_return({ command: "pytest --junitxml=.tmp/pytest-report.xml -q", parseAs: "junit-xml", artifactPaths: [".tmp/pytest-report.xml"] })`
- `structured_return({ command: "pytest -q" })`

### ruff
- `structured_return({ command: "ruff check . --output-format=json", parseAs: "ruff-json" })`

### eslint
- `structured_return({ command: "eslint . -f json", parseAs: "eslint-json" })`
