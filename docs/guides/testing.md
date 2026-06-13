# Testing

Status: **current** · Last verified: 2026-06-13

Unit tests live in [`tests/`](../../tests/) and run **fully offline** — no Azure, no external APIs.

## Run them

```bash
# from the repo root, using the backend venv
backend/.venv/Scripts/python.exe -m pytest          # all tests
backend/.venv/Scripts/python.exe -m pytest -v       # verbose
```

Test-only deps: [tests/requirements.txt](../../tests/requirements.txt) (`pytest`, `pytest-mock`).

## What's covered

| Area | File |
| --- | --- |
| Blob storage helpers | `test_blobs.py` |

## Adding a test

Mock out `storage.blobs.get_client` to avoid touching Azure. Use `monkeypatch` per test.
