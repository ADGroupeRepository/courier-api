terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "europe-west1"
}

variable "cloud_run_url" {
  type = string
}

module "api_gateway_prod" {
  source = "../../modules/api_gateway"

  project_id       = var.project_id
  region           = var.region
  api_id           = "bara-api"
  api_display_name = "Bara API (Prod)"
  gateway_id       = "bara-api-gateway-prod"
  
  # Inject the Cloud Run URL into the OpenAPI spec
  openapi_spec_content = replace(
    file("${path.module}/../../../../api-gateway/openapi-prod.yaml"),
    "{{CLOUD_RUN_URL}}",
    var.cloud_run_url
  )
}

output "gateway_url" {
  value = module.api_gateway_prod.gateway_url
}
