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

## ruby
Must include `--format json`. Without it output is not parseable.

```
structured_return({ command: "bundle exec rspec --format json", parseAs: "rspec-json" })
structured_return({ command: "bundle exec rspec spec/foo_spec.rb --format json", parseAs: "rspec-json" })
```

- Always pass `parseAs: "rspec-json"` explicitly.
- `--format json` is required — default RSpec output will not be parsed.
