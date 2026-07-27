output "artifact_registry_name" {
  description = "Name of Artifact Registry"
  value       = google_artifact_registry_repository.courier_api.name

}

output "github_actions_sa_email" {
  description = "Github Actions Service Account Email"
  value       = google_service_account.github_actions_sa.email

}

output "cloudrun_sa_email" {
  description = "Cloud Run Service Account Email"
  value       = google_service_account.cloudrun_sa.email

}

output "apigateway_sa_email" {
  description = "API Gateway Service Account Email"
  value       = google_service_account.apigateway_sa.email

}


output "api_gateway_url" {
  description = "The default public URL endpoint for the API Gateway"
  value       = "https://${google_api_gateway_gateway.courier_gateway.default_hostname}"
}

output "api_config_id" {
  description = "The fully qualified resource path of the active API Configuration"
  value       = google_api_gateway_gateway.courier_gateway.api_config
}
