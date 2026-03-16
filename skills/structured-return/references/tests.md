# tests

## python
- `pytest --json-report --json-report-file=.tmp/pytest-report.json`
- `pytest --junitxml=.tmp/pytest-report.xml -q`
- `pytest -q`
- `pytest path/to/test_file.py -q`
- `pytest -k "name" -q`

## javascript / typescript
- `jest --json`
- `vitest --reporter=json`
