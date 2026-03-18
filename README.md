# pi-structured-return

Structured command execution for pi agents: compact results for the model, full logs for humans.

Cross-platform Pi package that combines:
- a `structured-return` skill for choosing compact / machine-readable command forms
- a `structured-return` extension that captures output, stores artifacts, applies parsers, and falls back to tail + log path

## Token reduction

Tool output is designed for humans: source diffs, line annotations, timing breakdowns, absolute paths repeated on every line. Useful on a terminal. Expensive in a model context, especially on failure when output is most verbose and the model needs to act fast.

Test runners: 3 tests, 1 passing, 1 assertion failure, 1 unexpected error.
Linters: 1 unused variable warning in a single file.

| Parser | Raw (tokens) | Structured (tokens) | Reduction | Notes |
|---|---|---|---|---|
| `junit-xml` (maven) | 1056 | 74 | **93%** | build lifecycle noise with surefire stack traces per failure |
| `junit-xml` (go) | 400 | 58 | **86%** | verbose output with full stack trace per failure |
| `junit-xml` (dotnet) | 488 | 100 | **80%** | build header and VSTest output with per-failure stack traces |
| `vitest-json` | 348 | 75 | **78%** | source diff with inline arrows and ANSI color codes per failure |
| `junit-xml` (jest) | 303 | 67 | **78%** | source annotations with deep jest-circus stack traces per failure |
| `junit-xml` (pytest) | 289 | 71 | **75%** | verbose output with source snippets and summary footer |
| `rspec-json` | 212 | 55 | **74%** | default output with backtrace |
| `junit-xml` (gradle) | 263 | 81 | **69%** | gradle console output with build lifecycle noise |
| `minitest-text` | 168 | 59 | **65%** | default output with backtrace |
| `ruff-json` | 107 | 52 | **51%** | source context + help text per error |
| `eslint-json` | 64 | 59 | **8%** | already compact formatter |

Tokens counted with `cl100k_base` (tiktoken). Linter output is more compact than test runner output to begin with, so the baseline reduction is lower. The numbers above are measured against a single file with a single error — a conservative lower bound. Both ruff and eslint repeat absolute file paths per error in their raw output, so reduction grows as violations spread across more files.

## Built-in parsers
- `junit-xml` (JUnit XML — covers pytest `--junitxml`, Gradle, Maven, Jest with `jest-junit`, Go with `go-junit-report`, and any other tool that emits the JUnit XML schema)
- `vitest-json`
- `rspec-json`
- `minitest-text` (parses default minitest output — no flags or reporters needed)
- `ruff-json` (`ruff check` only — `ruff format` has no json support)
- `eslint-json`


## Before / after

**Raw pytest output (262 tokens):**
```
============================= test session starts ==============================
platform darwin -- Python 3.14.2, pytest-9.0.2
collecting ... collected 3 items

test_math.py::test_adds_two_numbers_correctly PASSED                     [ 33%]
test_math.py::test_multiplies_two_numbers_correctly FAILED               [ 66%]
test_math.py::test_does_not_divide_by_zero FAILED                        [100%]

=================================== FAILURES ===================================
____________________ test_multiplies_two_numbers_correctly _____________________

    def test_multiplies_two_numbers_correctly():
>       assert 3 * 4 == 99
E       assert (3 * 4) == 99

test_math.py:5: AssertionError
_________________________ test_does_not_divide_by_zero _________________________

    def test_does_not_divide_by_zero():
>       result = 1 / 0
                 ^^^^^
E       ZeroDivisionError: division by zero

test_math.py:8: ZeroDivisionError
=========================== short test summary info ============================
FAILED test_math.py::test_multiplies_two_numbers_correctly
FAILED test_math.py::test_does_not_divide_by_zero - ZeroDivisionError: ...
========================= 2 failed, 1 passed in 0.01s ==========================
```

**Structured result returned to the model (56 tokens):**
```
pytest test_math.py --junitxml=.tmp/report.xml → cwd: project
2 failed, 1 passed
  test_math.py:5  assert (3 * 4) == 99
  test_math.py:8  ZeroDivisionError: division by zero
```

## Installation

```bash
pi install npm:@robhowley/pi-structured-return
```

## How it works

1. The agent runs commands through `structured_return` instead of `bash`.
2. Full output is captured and stored as a log.
3. A parser converts noisy CLI output into a compact structured result. If no parser matches, the last 200 lines and the log path are returned as a fallback.
4. The agent receives the structured result in context — signal only, no noise.
5. The full log is always available on disk for both the agent and humans to inspect.

## Agentic loops

The token table above measures a single run. In an agentic loop the cost compounds — every tool result accumulates in context for the life of the task.

This applies to any loop: fixing a failing test suite, implementing a feature end-to-end, working through a migration, performance tuning execution times. The agent runs a command, reads the result, makes a change, runs it again. Each iteration adds another tool result to the context window. With a noisy CLI that means paying for the same verbose boilerplate every time.

A parser reduces each run to a one- or two-line signal. Over 15 iterations the difference isn't 80 tokens vs 15 tokens — it's 1,200 tokens vs 225 for a single command in a single task.

## Extending with project-local parsers

Built-in parsers cover common tools. For everything else — internal CLIs, custom test runners, proprietary lint tools — add a `.pi/structured-return.json` to your project root.

**Why:** keeps token costs low for tools the built-ins don't know about, without forking the package.

**Two options:**

### 1. Re-use a built-in parser

Route a project-specific command to an existing parser. Use this when your tool's output already matches a supported format (e.g. a test runner that emits JUnit XML).

```json
// .pi/structured-return.json
{
  "parsers": [
    {
      "id": "acme-tests",
      "match": { "argvIncludes": ["acme", "test"] },
      "parseAs": "junit-xml"
    }
  ]
}
```

### 2. Write a custom parser

Point to a local `.ts` file for tools with unique output formats.

```json
// .pi/structured-return.json
{
  "parsers": [
    {
      "id": "foo-json",
      "match": { "argvIncludes": ["foo-cli", "check"] },
      "module": "parsers/foo-cli.js"
    }
  ]
}
```

```ts
// .pi/parsers/foo-cli.ts
import fs from "node:fs";
import type { RunContext } from "@robhowley/pi-structured-return/types";

export default {
  id: "foo-json",
  async parse(ctx: RunContext) {
    const data = JSON.parse(fs.readFileSync(ctx.stdoutPath, "utf8"));
    return {
      tool: "foo-cli",
      status: data.ok ? "pass" : "fail",
      summary: data.ok ? "passed" : `${data.errors.length} errors`,
      failures: data.errors.map((e, i) => ({ id: e.id ?? `error-${i}`, file: e.file, line: e.line, message: e.message })),
      logPath: ctx.logPath,
    };
  },
};
```

The parser receives a `RunContext` (command, argv, cwd, stdout/stderr paths, artifact paths, log path) and returns a `ParsedResult`. Match rules support `argvIncludes` (array of required tokens) or `regex` (tested against the full argv string).

## Slash commands
- `/sr-parsers` — list all registered parsers (built-in and project-local) with their match rules and targets

## Structured result schema

Every parser returns the same shape. The model always knows where to look.

| Field | Type | Description |
|---|---|---|
| `tool` | `string` | Name of the tool that ran (`eslint`, `pytest`, etc.) |
| `exitCode` | `number` | Raw process exit code |
| `status` | `pass \| fail \| error` | Normalized outcome |
| `summary` | `string` | One-line human+model readable result (`3 failed, 12 passed`) |
| `cwd` | `string` | Working directory — anchor for resolving relative paths in failures |
| `failures` | `{ id, file?, line?, message?, rule? }[]` | Per-failure details with relative file paths |
| `artifact` | `string?` | Path to the saved report file, if one was written |
| `logPath` | `string` | Path to full stdout+stderr log |
| `rawTail` | `string?` | Last 200 lines of log, included on fallback when no parser matched |

## Design

`structured_return` is a separate tool, not a wrapper around `bash`. Intercepting `bash` to silently rewrite commands would override a primitive the model and platform both rely on. Pi's philosophy is to extend rather than obfuscate: features are built on top of the platform, not hidden inside it. A dedicated tool honors that. It adds to the available surface, keeps `bash` honest, and leaves the choice explicit. The skill guides the model toward it; nothing is hijacked to get there.

