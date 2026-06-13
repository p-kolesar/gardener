# Tests

Status: **current** · Last verified: 2026-06-13

Unit tests for the backend. Fully offline — no Azure, no Claude.

## Layout

```
pytest.ini              # (repo root) pythonpath=backend, testpaths=tests
tests/
  conftest.py           # shared fixtures
  requirements.txt      # test-only deps (pytest, pytest-mock)
  unit/
    test_blobs.py       # upload/download helpers
```

## Running

```bash
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt -r ../tests/requirements.txt
cd ..
backend/.venv/Scripts/python.exe -m pytest
```

## Conventions

- No real I/O. Patch `storage.blobs.get_client` with a mock per test.
- External clients (Anthropic) are stubbed per test.
- One behaviour per test, named `test_<unit>_<expectation>`.
