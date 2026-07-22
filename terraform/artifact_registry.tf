resource "google_artifact_registry_repository" "courier_api" {

  location = var.region

  repository_id = "courier-api"

  description = "Docker repository for Courier API"

  format = "DOCKER"

  depends_on = [
    google_project_service.artifactregistry_api
  ]
}