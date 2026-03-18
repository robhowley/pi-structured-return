# Benchmarks

Each benchmark runs the same scenario two ways — raw tool output (what the `bash` tool returns to the model) vs structured output (what `structured_return` returns). The numbers in the main README token reduction table come from these files.

## Replicating the results

Token counts use `cl100k_base` via [tiktoken](https://github.com/openai/tiktoken). Install it before running:

```bash
pip install tiktoken
```

Open a pi session in this directory and send the following prompt:

> Read benchmarks/README.md. For each tool listed, run both the raw command using the bash tool and the structured version using structured_return. For each pair, count the tokens in what was returned to you as the tool result using cl100k_base (tiktoken). Then produce a markdown table with columns: Parser, Raw (tokens), Structured (tokens), Reduction (%). One row per tool.

## Test runners

All test runner benchmarks use the same three-test scenario: one passing test, one assertion failure (wrong expected value), one unexpected error/exception.

### pytest

```bash
# raw
pytest test-runners/pytest/test_math.py

# structured
structured_return({ command: "pytest test-runners/pytest/test_math.py --junitxml=.tmp/report.xml", parseAs: "junit-xml", artifactPaths: [".tmp/report.xml"] })
```

### vitest

```bash
# raw
npx vitest run test-runners/vitest/math.test.ts

# structured
structured_return({ command: "npx vitest run test-runners/vitest/math.test.ts --reporter=json", parseAs: "vitest-json" })
```

Note: vitest's raw output includes ANSI color codes. Count tokens on the raw output as-is — the model receives the escape sequences.

### rspec

Setup (run once from `test-runners/rspec/`):

```bash
cd test-runners/rspec && bundle init && bundle add rspec
```

Run both commands from `test-runners/rspec/`:

```bash
# raw
bundle exec rspec math_spec.rb

# structured
structured_return({ command: "bundle exec rspec math_spec.rb --format json", parseAs: "rspec-json" })
```

### minitest

```bash
# raw
ruby test-runners/minitest/math_test.rb

# structured
structured_return({ command: "ruby test-runners/minitest/math_test.rb", parseAs: "minitest-text" })
```

### go / junit-xml

Setup (install `go-junit-report` once):

```bash
go install github.com/jstemmer/go-junit-report/v2@latest
```

Run both commands from `test-runners/go/`:

```bash
# raw
go test

# structured
structured_return({ command: "go test -v 2>&1 | go-junit-report > .tmp/go-report.xml", parseAs: "junit-xml", artifactPaths: [".tmp/go-report.xml"] })
```

### gradle / junit-xml

Setup (run once from `test-runners/java/`):

```bash
cd test-runners/java && gradle test
```

Run both commands from `test-runners/java/`:

```bash
# raw
gradle test

# structured
structured_return({ command: "gradle test", parseAs: "junit-xml", artifactPaths: ["build/test-results/test/TEST-MathTest.xml"] })
```

### jest / junit-xml

Setup (run once from `test-runners/jest/`):

```bash
cd test-runners/jest && npm install
```

Run both commands from `test-runners/jest/`:

```bash
# raw
npx jest

# structured
structured_return({ command: "JEST_JUNIT_OUTPUT_FILE=.tmp/junit.xml npx jest --reporters=jest-junit", parseAs: "junit-xml", artifactPaths: [".tmp/junit.xml"] })
```

## Linters

Both linter benchmarks use a single file with one unused variable — a conservative lower bound. Reduction grows as violations spread across more files.

### ruff

```bash
# raw
ruff check linters/lint_check.py --select F841

# structured
structured_return({ command: "ruff check linters/lint_check.py --select F841 --output-format=json", parseAs: "ruff-json" })
```

### eslint

```bash
# raw
npx eslint --config linters/eslint.config.mjs linters/lint_check.ts

# structured
structured_return({ command: "npx eslint --config linters/eslint.config.mjs linters/lint_check.ts -f json", parseAs: "eslint-json" })
```
