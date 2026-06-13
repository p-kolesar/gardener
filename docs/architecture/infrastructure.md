# Infrastructure & CI/CD

Status: **stub** · Last verified: 2026-06-13

Azure resources via Bicep (`infra/main.bicep`); three GitHub Actions pipelines.

## Resources provisioned

- Storage account (Standard LRS) with `deploymentpackage` and `data` containers
- Log Analytics workspace + Application Insights
- Flex Consumption hosting plan
- Function App (Python 3.13)
- Static Web App (Free tier)

## Pipelines

| File | What it does |
| --- | --- |
| `infra.yml` | Provisions all Azure resources |
| `deploy.yml` | Deploys Function App; smoke-tests `/api/health` |
| `deploy-frontend.yml` | Builds and deploys the React SPA |

## Required secrets / variables

See root [README.md](../../README.md).
