# Bara API Infrastructure - Terraform

This directory contains the Terraform configuration to manage the Google API Gateway for both Development and Production environments.

## Structure

- `modules/api_gateway`: A reusable module that creates the API, API Config, and the Gateway.
- `environments/dev`: Configuration for the Development environment.
- `environments/prod`: Configuration for the Production environment.

## Requirements

1. **Terraform CLI** (v1.0+)
2. **GCP Service Account** with the following roles:
   - `roles/apigateway.admin`
   - `roles/iam.serviceAccountUser`
   - `roles/compute.viewer` (optional, for verification)

## Usage

### Local Execution

To deploy the Development gateway manually:

```bash
cd environments/dev
terraform init
terraform apply -var="project_id=your-project-id" -var="cloud_run_url=https://your-cloud-run-url.a.run.app"
```

### GitLab CI/CD Integration

The pipeline should be updated to replace the `gcloud api-gateway` commands with Terraform:

```yaml
# Example snippet for .gitlab-ci.yml
deploy_dev:
  script:
    -  # ... deploy cloud run ...
    - SERVICE_URL=$(gcloud run services describe bara-api-dev --format='value(status.url)')
    - cd infrastructure/terraform/environments/dev
    - terraform init
    - terraform apply -auto-approve -var="project_id=$GCP_PROJECT_ID" -var="cloud_run_url=$SERVICE_URL"
```

## Note on API Configs

API Gateway configurations are immutable. This Terraform setup automatically generates a unique `api_config_id` based on the SHA256 hash of your OpenAPI specification. This ensures that any change to your `openapi-dev.yaml` or `openapi-prod.yaml` triggers a new configuration deployment.
