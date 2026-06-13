# Storage account

Status: **stub** · Last verified: 2026-06-13

The storage account is provisioned by `infra/main.bicep`. Its connection string is set as the `AzureWebJobsStorage` app setting on the Function App.

## Containers

| Container | Purpose |
| --- | --- |
| `deploymentpackage` | Function App deployment packages (managed by Azure) |
| `data` | Application data blobs |

## Auth

The Function App uses the `AzureWebJobsStorage` connection string (storage account key). For local dev, use Azurite (`UseDevelopmentStorage=true`) or a real connection string in `local.settings.json`.
