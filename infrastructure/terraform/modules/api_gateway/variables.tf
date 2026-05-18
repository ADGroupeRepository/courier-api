variable "project_id" {
  type        = string
  description = "The GCP project ID"
}

variable "region" {
  type        = string
  description = "The region to deploy the gateway"
  default     = "europe-west1"
}

variable "api_id" {
  type        = string
  description = "The ID of the API"
}

variable "api_display_name" {
  type        = string
  description = "Display name for the API"
}

variable "gateway_id" {
  type        = string
  description = "The ID of the Gateway"
}

variable "openapi_spec_content" {
  type        = string
  description = "The content of the OpenAPI spec file"
}

variable "gateway_service_account" {
  type        = string
  description = "The service account email to be used by the gateway config for backend authentication (OIDC)."
  default     = null
}
