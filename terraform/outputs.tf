output "artifact_registry_url" {

  value = google_artifact_registry_repository.courier_api.name

}

output "cloudrun_sa_email" {

  value = google_service_account.cloudrun_sa.email

}

output "apigateway_sa_email" {

  value = google_service_account.apigateway_sa.email

}