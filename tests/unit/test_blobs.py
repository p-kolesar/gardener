"""Unit tests for storage.blobs."""

from unittest.mock import MagicMock

from storage import blobs


def test_upload_calls_upload_blob(monkeypatch):
    mock_container = MagicMock()
    monkeypatch.setattr(blobs, "get_client", lambda: MagicMock(get_container_client=lambda c: mock_container))

    blobs.upload("my-container", "file.json", b'{"hello": "world"}')

    mock_container.upload_blob.assert_called_once_with("file.json", b'{"hello": "world"}', overwrite=True)


def test_download_returns_bytes(monkeypatch):
    mock_blob = MagicMock()
    mock_blob.download_blob.return_value.readall.return_value = b"content"
    mock_container = MagicMock(get_blob_client=lambda name: mock_blob)
    monkeypatch.setattr(blobs, "get_client", lambda: MagicMock(get_container_client=lambda c: mock_container))

    result = blobs.download("my-container", "file.json")

    assert result == b"content"
