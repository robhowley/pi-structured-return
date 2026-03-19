---
name: structured-return
description: Choose compact, machine-readable commands across common test, lint, build, and log workflows. Use when raw terminal output would be noisy and the agent should prefer json, junit/xml, porcelain, quiet, no-pretty, or narrow-scope command forms.
---

# structured-return

Prefer better output at the source.

## What structured_return does

`structured_return` is a tool — use it instead of `bash` for lint, test, and build commands. It runs the command, stores the full log, and returns a compact parsed result to the model. When a parser matches, only the signal (failures, errors, summary) comes back into context. When no parser matches, it falls back to the last 200 lines of output plus a log path — still better than dumping everything into context via `bash`.

## Rules

1. Before running any lint, test, or build command, check for project-defined scripts (`package.json`, `Makefile`, `pyproject.toml`, etc.). If a script exists for the task, inspect it to identify the underlying tool and the scope/paths it uses. Then invoke that tool directly with machine-readable flags and the same scope — rather than running through the script wrapper.
2. Use `structured_return` instead of `bash` for lint, test, and build commands. For tools with a built-in parser, use the command form shown in the examples below. For tools without one, use known machine-readable flags (`--json`, `--format json`, `--message-format=json`, `--console=plain`, `--porcelain`, etc.) and let the tail fallback handle the result.
3. Otherwise prefer quiet, plain, no-color, and narrow-scope modes.
4. Prefer file/test-specific runs before full-suite runs.
5. Prefer bounded log reads over full log dumps.
6. Do not invent flags. Use known patterns from examples below or your own knowledge of the tool.
7. When using `structured_return`, pass explicit parser hints when known.
8. If a repo defines project-local parser mappings in `.pi/structured-return.json`, prefer those mappings.

## Examples

### pytest
- `structured_return({ command: "pytest [any pytest args] --junitxml=.tmp/report.xml", parseAs: "junit-xml", artifactPaths: [".tmp/report.xml"] })` — `--junitxml` is built into pytest, no extra dependencies needed; scope, filters, markers, etc. go in `[any pytest args]`

### ruff check
- `structured_return({ command: "ruff check [any ruff args] --output-format=json", parseAs: "ruff-json" })` — scope, selects, ignores, etc. go in `[any ruff args]`

### ruff format
- `ruff format --check .` (no structured_return — json output not supported)

### mypy
- `structured_return({ command: "mypy [any mypy args] --output json", parseAs: "mypy-json" })` — `--output json` is built into mypy (1.0+); outputs NDJSON to stderr with file, line, column, message, error code, and severity; notes are folded into their parent error's message

### bandit
- `structured_return({ command: "bandit -f json [any bandit args]", parseAs: "bandit-json" })` — `-f json` is built into bandit; strips source snippets, CWE URLs, run metrics, and confidence labels; severity breakdown in summary

### pyright
- `structured_return({ command: "pyright --outputjson [any pyright args]", parseAs: "pyright-json" })` — `--outputjson` is built into pyright; JSON output includes file, line, message, and rule code; multi-line detail messages collapsed; warnings excluded from failures

### tsc
- `structured_return({ command: "tsc --noEmit --pretty false [any tsc args]", parseAs: "tsc-text" })` — `--pretty false` suppresses source snippets and ANSI codes; parser extracts file, line, TS error code, and message from the compact `file(line,col): error TSXXXX: message` format

### pylint
- `structured_return({ command: "pylint [any pylint args] --output-format=json", parseAs: "pylint-json" })` — `--output-format=json` is built into pylint; rule includes both message-id and symbol name (e.g. `W0612(unused-variable)`)

### shellcheck
- `structured_return({ command: "shellcheck [any shellcheck args] --format=json", parseAs: "shellcheck-json" })` — `--format=json` is built into shellcheck; strips source snippets, caret indicators, "Did you mean" suggestions, and wiki URLs

### rubocop
- `structured_return({ command: "rubocop [any rubocop args] --format json", parseAs: "rubocop-json" })` — `--format json` is built into rubocop; cop name prefix stripped from messages; source snippets and caret indicators removed

### flake8
- `flake8 [any flake8 args]` (no structured_return — default output is already compact `file:line:col: CODE message`; no JSON without a plugin; use `bash` directly)

### swiftc
- `structured_return({ command: "swiftc -typecheck [any swiftc args]", parseAs: "swiftc-text" })` — parses `file:line:col: error: message` from stderr; source annotations and duplicate error lines deduplicated; warnings filtered out

### hadolint
- `structured_return({ command: "hadolint [any hadolint args] --format json", parseAs: "hadolint-json" })` — `--format json` is built into hadolint; strips ANSI color codes and level labels from text output

### stylelint
- `structured_return({ command: "stylelint [any stylelint args] --formatter json", parseAs: "stylelint-json" })` — `--formatter json` is built into stylelint; rule name suffix stripped from message text; requires a `.stylelintrc` config

### ava
- `structured_return({ command: "npx ava [any ava args] --no-color", parseAs: "ava-text" })` — parses default text output from stderr; assertion failures extract expected/actual from diff lines and file:line; runtime errors extract message and file:line from stack trace

### mocha
- `structured_return({ command: "mocha [any mocha args] --reporter json", parseAs: "mocha-json" })` — `--reporter json` is built into mocha; assertion failures surface explicit expected/actual values; runtime errors surface message and file:line from stack trace

### Python unittest
- `structured_return({ command: "python3 -m unittest [any unittest args]", parseAs: "unittest-text" })` — no special flags needed; parses the default verbose traceback output from stderr; assertion messages extracted from `AssertionError` lines; file:line from traceback frames

### go test
- `structured_return({ command: "go test -json [any go test args]", parseAs: "go-test-json" })` — `-json` is built into `go test`; NDJSON output; assertion failures extract file:line and message from `t.Error`/`t.Errorf` output; panics extract message and user-code file:line from stack trace; 97% reduction vs raw NDJSON

### vitest
- `structured_return({ command: "vitest run [any vitest args] --reporter=json", parseAs: "vitest-json" })` — file paths, filters, etc. go in `[any vitest args]`

### eslint
- `structured_return({ command: "eslint [any eslint args] -f json", parseAs: "eslint-json" })` — paths, configs, rules, etc. go in `[any eslint args]`

### rspec
- `structured_return({ command: "bundle exec rspec [any rspec args] --format json", parseAs: "rspec-json" })` — `--format json` is required; without it output is not parseable

### minitest
- `structured_return({ command: "ruby [any minitest args]", parseAs: "minitest-text" })` — no format flags needed; works with plain ruby invocation

### dbt (run, test, compile)
- `structured_return({ command: "dbt run [any dbt args] --log-format json", parseAs: "dbt-json" })` — `--log-format json` required; model selectors, flags, etc. go in `[any dbt args]`
- `structured_return({ command: "dbt test [any dbt args] --log-format json", parseAs: "dbt-json" })` — same parser handles run and test; unit test diffs preserved verbatim
- `structured_return({ command: "dbt compile [any dbt args] --log-format json", parseAs: "dbt-json" })` — returns compiled SQL; preamble stripped

### cargo build
- `structured_return({ command: "cargo build --message-format=json", parseAs: "cargo-build" })` — `--message-format=json` is built into cargo; errors include file, line, error code (E0308 etc.), and primary span label (expected X, found Y); warnings are filtered out

### cargo test
- `structured_return({ command: "cargo test", parseAs: "cargo-test" })` — no extra flags needed; assertion failures surface left/right values and file:line; panics surface the message and file:line; if compilation fails, the summary says so and tells the model to run `cargo build --message-format=json` for structured errors
- `structured_return({ command: "cargo test [filter]", parseAs: "cargo-test" })` — filter by test name substring, module path, or `--test integration_test_name`

### junit-xml

JUnit XML is the de facto standard output format across the JVM ecosystem and many others — Maven, Gradle, pytest (`--junitxml`), Go (`go-junit-report`), .NET (`--logger trx` with conversion), Jest (`jest-junit`), and more. If a tool can emit JUnit XML, `junit-xml` covers it without a custom parser.

- `structured_return({ command: "[tool] [args] --junitxml=.tmp/report.xml", parseAs: "junit-xml", artifactPaths: [".tmp/report.xml"] })` — pytest, nose2, and any other tool that writes to a file via `--junitxml`
- `structured_return({ command: "go test [any go test args] 2>&1 | go-junit-report > .tmp/report.xml", parseAs: "junit-xml", artifactPaths: [".tmp/report.xml"] })` — Go requires `go-junit-report` (`go install github.com/jstemmer/go-junit-report/v2@latest`); pipe `go test -v` output through it
- `structured_return({ command: "gradle test", parseAs: "junit-xml", artifactPaths: ["build/test-results/test/TEST-*.xml"] })` — Gradle writes one XML per test class; pass all matching paths

#### .NET / xUnit

`dotnet test` requires the `JunitXml.TestLogger` package (`dotnet add package JunitXml.TestLogger`). Pass the logger inline — no config file changes needed. Add a namespace to your test class or the logger will fall back to `UnknownNamespace.UnknownType` for classnames.

- `structured_return({ command: "dotnet test --logger \"junit;LogFilePath=.tmp/report.xml\"", parseAs: "junit-xml", artifactPaths: [".tmp/report.xml"] })` — any dotnet test args (project path, `--filter`, etc.) go before `--logger`

#### Maven

`mvn test` writes one XML per test class via surefire — no extra configuration needed.

- `structured_return({ command: "mvn test", parseAs: "junit-xml", artifactPaths: ["target/surefire-reports/TEST-*.xml"] })` — surefire writes one XML per class; glob covers all of them; any maven args (e.g. `-pl module`, `-Dtest=ClassName`) go before `test`

#### Jest

Jest requires the `jest-junit` reporter (`npm install --save-dev jest-junit`). Pass it via `--reporters` on the CLI — no permanent config change needed.

- `structured_return({ command: "jest [any jest args] --reporters=jest-junit", parseAs: "junit-xml", artifactPaths: [".tmp/junit.xml"] })` — set `JEST_JUNIT_OUTPUT_FILE=.tmp/junit.xml` or configure `outputFile` in `jest-junit` config; file paths, `--testPathPattern`, etc. go in `[any jest args]`

#### Swift / XCTest (Swift Package Manager)

`swift test` has native JUnit XML output via `--xunit-output` (Swift 5.7+). Use this for all SPM projects — no third-party reporter needed.

- `structured_return({ command: "swift test --xunit-output .tmp/report.xml", parseAs: "junit-xml", artifactPaths: [".tmp/report.xml"] })` — full test suite
- `structured_return({ command: "swift test --filter MathTests --xunit-output .tmp/report.xml", parseAs: "junit-xml", artifactPaths: [".tmp/report.xml"] })` — single test target or test case; `--filter` accepts a target name, class name, or `ClassName/testMethodName`

#### Swift / XCTest (Xcode projects)

`xcodebuild` output is high-volume and not directly parseable. Pipe through `xcbeautify` (install with `brew install xcbeautify`) to get JUnit XML:

- `structured_return({ command: "xcodebuild test -scheme [scheme] -destination '[destination]' 2>&1 | xcbeautify --report junit --output .tmp", parseAs: "junit-xml", artifactPaths: [".tmp/report.junit.xml"] })` — xcbeautify writes `report.junit.xml` into the `--output` directory; run `xcodebuild -showdestinations -scheme [scheme]` first to find the correct `[destination]` string for the project
