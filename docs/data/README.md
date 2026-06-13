# Data layer

Status: **stub** · Last verified: 2026-06-13

The Function App reads and writes blobs to Azure Blob Storage via `storage/blobs.py`.
All blobs live in the `data` container of the storage account provisioned by `infra/main.bicep`.

Update this doc when you define schemas for your application's blobs.

## Storage account

See [storage-account.md](storage-account.md) for naming and auth details.
