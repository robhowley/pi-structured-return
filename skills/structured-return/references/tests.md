# tests

## python
- `pytest --json-report --json-report-file=.tmp/pytest-report.json`
- `pytest --junitxml=.tmp/pytest-report.xml -q`
- `pytest -q`
- `pytest path/to/test_file.py -q`
- `pytest -k "name" -q`

## javascript / typescript
- `jest --json`
- `structured_return({ command: "vitest run --reporter=json", parseAs: "vitest-json" })`

## ruby — rspec
Must include `--format json`. Without it output is not parseable.

```
structured_return({ command: "bundle exec rspec --format json", parseAs: "rspec-json" })
structured_return({ command: "bundle exec rspec spec/foo_spec.rb --format json", parseAs: "rspec-json" })
```

- Always pass `parseAs: "rspec-json"` explicitly.
- `--format json` is required — default RSpec output will not be parsed.

## ruby — minitest
Parses minitest's default output. No flags or reporters required.

```
structured_return({ command: "ruby test/my_test.rb", parseAs: "minitest-text" })
structured_return({ command: "bundle exec ruby test/my_test.rb", parseAs: "minitest-text" })
structured_return({ command: "ruby test/math_test.rb test/other_test.rb", parseAs: "minitest-text" })
```

- Always pass `parseAs: "minitest-text"` explicitly.
- No format flags needed — works with plain `ruby` invocation.
