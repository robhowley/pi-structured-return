# pi-structured-return

Structured command execution for Pi agents: compact results for the model, full logs for humans.

Tool output is designed for humans: source diffs, line annotations, timing breakdowns, absolute paths repeated on every line. Useful on a terminal. Expensive in a model context, especially on failure when output is most verbose and the model needs to act fast.

This Pi package adds a `structured_return` tool alongside `bash`. A bundled skill teaches the model when to reach for it — test suites, linters, build tools, data pipelines — anywhere verbose output burns tokens. It captures full logs, applies a parser, and returns a compact structured result. The full output stays on disk.

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

262 → 56 tokens. The model knows which tests failed, where, and why. No platform line, no progress bar, no source snippets, no banner separators, no short summary repeating the same info. And that's a single run — in an agentic loop the cost compounds. Every tool result accumulates in context for the life of the task. Over 15 red-green iterations, the difference isn't 262 vs 56 — it's 3,930 vs 840 tokens for one command in one task.

## Token reduction

Measured with `cl100k_base` (tiktoken). All benchmarks use tiny fixtures — reduction grows with real-world output.

### Test runners

Benchmark: 3 tests — 1 passing, 1 assertion failure, 1 unexpected error.

| Parser | Raw | Structured | Reduction | Notes |
|---|---|---|---|---|
| `go-test-json` | 1819 | 48 | **97%** | NDJSON event stream with stack traces; file:line + expected/actual preserved |
| `junit-xml` (maven) | 1063 | 86 | **92%** | build lifecycle noise with surefire stack traces per failure |
| `node-test-text` | 629 | 64 | **90%** | strips full stack traces, assertion internals, timing; preserves expected/actual |
| `ava-text` | 483 | 56 | **88%** | source snippets, diffs, full stack traces stripped; expected/actual preserved |
| `junit-xml` (go) | 400 | 58 | **86%** | verbose output with full stack trace per failure |
| `junit-xml` (dotnet) | 487 | 107 | **78%** | build header and VSTest output with per-failure stack traces |
| `vitest-json` | 348 | 75 | **78%** | source diff with inline arrows and ANSI color codes per failure |
| `unittest-text` | 231 | 52 | **78%** | full tracebacks with source annotations; expected/actual from AssertionError |
| `cargo-test` | 285 | 68 | **76%** | cargo progress + test binary output with panic traces per failure |
| `junit-xml` (pytest) | 289 | 71 | **75%** | verbose output with source snippets and summary footer |
| `rspec-json` | 212 | 55 | **74%** | default output with backtrace |
| `junit-xml` (gradle) | 263 | 81 | **69%** | gradle console output with build lifecycle noise |
| `mocha-json` | 180 | 55 | **69%** | stack traces + assertion diff formatting; expected/actual preserved |
| `junit-xml` (jest) | 309 | 99 | **68%** | source annotations with deep jest-circus stack traces per failure |
| `minitest-text` | 168 | 59 | **65%** | default output with backtrace |

### Linters, type checkers, and build tools

Benchmark: 1 file, 1–2 violations. Reduction is a conservative lower bound — scales with file and error count since raw output repeats paths, source snippets, and annotations per violation.

| Parser | Raw | Structured | Reduction | Notes |
|---|---|---|---|---|
| `dotnet-build-text` | 383 | 53 | **86%** | strips restore/timing noise, deduplicates repeated error lines, absolute paths relativized |
| `cargo-build` | 225 | 77 | **66%** | rustc error annotations with code spans and help text per error |
| `swiftc-text` | 161 | 58 | **64%** | source annotations with backtick markers deduplicated |
| `ruff-json` | 107 | 52 | **51%** | source context + help text per error |
| `shellcheck-json` | 224 | 117 | **48%** | strips source snippets, carets, suggestions, wiki URLs |
| `rubocop-json` | 149 | 90 | **40%** | strips source snippets, caret indicators, summary line |
| `tsc-text` | 107 | 72 | **33%** | vs `--pretty true` default; source snippets and underlines stripped |
| `stylelint-json` | 70 | 51 | **27%** | strips summary footer and fix hint |
| `pylint-json` | 141 | 120 | **15%** | strips header, score line, separator; scales with error count |
| `hadolint-json` | 178 | 156 | **12%** | strips ANSI color codes and level labels; measured vs colored output |
| `eslint-json` | 64 | 59 | **8%** | already compact formatter |
| `bandit-json` | 402 | 99 | **75%** | strips source snippets, CWE URLs, run metrics, confidence labels |
| `pyright-json` | 100 | 59 | **41%** | strips version, timing, absolute paths; detail lines collapsed |
| `clang-text` | 109 | 77 | **29%** | strips source snippets, caret indicators, line numbers from gutter |
| `javac-text` | 79 | 66 | **16%** | strips source snippets, caret indicators; folds symbol/location into message |
| `mypy-json` | 75 | 72 | **4%** | mypy text is already compact; notes folded into parent errors |
| `black-text` | 155 | 31 | **80%** | strips diff hunks, emoji, timestamps; lists files needing reformatting |
| `flake8` | 75 | — | **—** | already compact (`file:line:col: CODE message`); no parser — use `bash` directly |

### Pipeline tools

dbt output is the noisiest tool in this repo relative to useful signal. Every run prints version info, adapter registration, project stats, concurrency settings, and per-node start/finish lines — all before any result.

The numbers below use 3–4 model toy examples; real projects run hundreds of models where the noise scales linearly and reduction compounds.

| Parser | Raw | Structured | Reduction | Notes |
|---|---|---|---|---|
| `dbt-json` (run, success) | 428 | 20 | **95%** | version, adapter, concurrency, per-model start/finish — all noise on success |
| `dbt-json` (run, failure) | 618 | 198 | **68%** | error messages, model paths, compiled code paths preserved |
| `dbt-json` (test) | 720 | 274 | **62%** | unit test diff tables preserved verbatim; preamble stripped |
| `dbt-json` (compile) | 775 | 683 | **12%** | compiled SQL is the signal and returned verbatim |

At 12 models, run failures hit 85% reduction. An 18-model DAG success: 1,645 → 20 tokens (99%).

## Built-in parsers

**Test runners:** `junit-xml` (pytest, Gradle, Maven, Jest, Go, .NET — anything that emits JUnit XML), `vitest-json`, `rspec-json`, `minitest-text`, `cargo-test`, `go-test-json`, `mocha-json`, `ava-text`, `unittest-text`, `node-test-text`

**Linters & type checkers:** `ruff-json`, `eslint-json`, `mypy-json`, `pyright-json`, `tsc-text`, `pylint-json`, `shellcheck-json`, `rubocop-json`, `swiftc-text`, `hadolint-json`, `stylelint-json`, `bandit-json`, `black-text`

**Build tools:** `cargo-build`, `javac-text`, `dotnet-build-text`, `clang-text`

**Pipeline tools:** `dbt-json` (run, test, compile)

Run `/sr-parsers` in a pi session to see all registered parsers with their match rules.


## Installation

Install the skill and extension:

```bash
pi install npm:@robhowley/pi-structured-return
```

## How it works

1. The agent runs commands through `structured_return` when it would reduce noise and token usage.
2. Full output is captured and stored as a log.
3. A parser converts noisy CLI output into a compact structured result. If no parser matches, the last 200 lines and the log path are returned as a fallback.
4. The agent receives the structured result in context — signal only, no noise.
5. The full log is always available on disk for both the agent and humans to inspect.

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

