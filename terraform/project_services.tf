# Needed to create the Artifact Registry repository and store Docker images.
resource "google_project_service" "artifactregistry_api" {

  project = var.project_id

  service = "artifactregistry.googleapis.com"

  disable_on_destroy = false
}

# Needed for Cloud Run.
resource "google_project_service" "run_api" {

  project = var.project_id

  service = "run.googleapis.com"

  disable_on_destroy = false
}

# Needed for Secret Manager.
resource "google_project_service" "secretmanager_api" {

  project = var.project_id

  service = "secretmanager.googleapis.com"

  disable_on_destroy = false
}

# Needed to create service accounts and IAM bindings.
resource "google_project_service" "iam_api" {

  project = var.project_id

  service = "iam.googleapis.com"

  disable_on_destroy = false

}

# Required for Workload Identity Federation and service account impersonation used by GitHub Actions.
resource "google_project_service" "wif_api" {

  project = var.project_id

  service = "iamcredentials.googleapis.com"

  disable_on_destroy = false

}

# Required for Workload Identity Federation (Security Token Service).
resource "google_project_service" "sts_api" {

  project = var.project_id

  service = "sts.googleapis.com"

  disable_on_destroy = false

}

# Required for creating an API Gateway.
resource "google_project_service" "gateway_api" {

  project = var.project_id

  service = "apigateway.googleapis.com"

  disable_on_destroy = false

}

# Required for service configurations
resource "google_project_service" "servicemanagement_api" {

  project = var.project_id

  service = "servicemanagement.googleapis.com"

  disable_on_destroy = false

}