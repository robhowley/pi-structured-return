---
name: structured-return
description: Choose compact, machine-readable commands across common test, lint, build, git, and log workflows. Use when raw terminal output would be noisy and the agent should prefer json, junit/xml, porcelain, quiet, no-pretty, or narrow-scope command forms.
---

# structured-return

Prefer better output at the source.

## Rules

1. Before running any lint, test, or build command, check for project-defined scripts (`package.json`, `Makefile`, `pyproject.toml`, etc.). If a script exists for the task, inspect it to identify the underlying tool and the scope/paths it uses. Then invoke that tool directly with machine-readable flags and the same scope — rather than running through the script wrapper.
2. Prefer machine-readable output when supported.
3. Otherwise prefer quiet, plain, no-color, and narrow-scope modes.
4. Prefer file/test-specific runs before full-suite runs.
5. Prefer bounded log reads over full log dumps.
6. Do not invent flags. Use known patterns from references.
7. When using `structured_return`, pass explicit parser hints when known.
8. If a repo defines project-local parser mappings in `.pi/structured-return.json`, prefer those mappings.

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
