# lint

ESLint, ruff, and tsc each require a specific output format for the parser to work.
Always use the exact command forms below — do not omit the format flags.

## eslint

Must include `-f json`. Without it the output is not parseable and the fallback is used.

```
structured_return({ command: "eslint . -f json", parseAs: "eslint-json" })
structured_return({ command: "eslint src/ -f json", parseAs: "eslint-json" })
```

- Always pass `parseAs: "eslint-json"` explicitly.
- `-f json` is required — plain eslint output will not be parsed.

## ruff

### ruff check

Must include `--output-format=json`. Only applies to `ruff check` — not `ruff format`.

```
structured_return({ command: "ruff check . --output-format=json", parseAs: "ruff-json" })
```

### ruff format

`ruff format` does not support `--output-format=json`. Do not use `ruff-json` as the parser. Run without `structured_return` or use plain flags.

```
ruff format --check .
ruff format --check . -q
```

## tsc

No JSON mode — use quiet/plain flags. Tail fallback applies.

```
structured_return({ command: "tsc --pretty false --noEmit" })
```
