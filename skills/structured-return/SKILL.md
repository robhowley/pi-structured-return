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

### vitest
- `structured_return({ command: "vitest run [any vitest args] --reporter=json", parseAs: "vitest-json" })` — file paths, filters, etc. go in `[any vitest args]`

### eslint
- `structured_return({ command: "eslint [any eslint args] -f json", parseAs: "eslint-json" })` — paths, configs, rules, etc. go in `[any eslint args]`

### rspec
- `structured_return({ command: "bundle exec rspec [any rspec args] --format json", parseAs: "rspec-json" })` — `--format json` is required; without it output is not parseable

### minitest
- `structured_return({ command: "ruby [any minitest args]", parseAs: "minitest-text" })` — no format flags needed; works with plain ruby invocation

### junit-xml

JUnit XML is the de facto standard output format across the JVM ecosystem and many others — Maven, Gradle, pytest (`--junitxml`), Go (`go-junit-report`), .NET (`--logger trx` with conversion), Jest (`jest-junit`), and more. If a tool can emit JUnit XML, `junit-xml` covers it without a custom parser.

- `structured_return({ command: "[tool] [args] --junitxml=.tmp/report.xml", parseAs: "junit-xml", artifactPaths: [".tmp/report.xml"] })` — pytest, nose2, and any other tool that writes to a file via `--junitxml`
- `structured_return({ command: "go test [any go test args] 2>&1 | go-junit-report > .tmp/report.xml", parseAs: "junit-xml", artifactPaths: [".tmp/report.xml"] })` — Go requires `go-junit-report` (`go install github.com/jstemmer/go-junit-report/v2@latest`); pipe `go test -v` output through it
- `structured_return({ command: "gradle test", parseAs: "junit-xml", artifactPaths: ["build/test-results/test/TEST-*.xml"] })` — Gradle writes one XML per test class; pass all matching paths

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
