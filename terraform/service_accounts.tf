# GitHub Actions Service Account
resource "google_service_account" "github_actions_sa" {

  account_id = "github-actions-sa-${var.environment}"

  display_name = "GitHub Actions Service Account"

  depends_on = [
    google_project_service.iam_api
  ]
}

# Cloud Run Service Account
resource "google_service_account" "cloudrun_sa" {

  account_id = "cloudrun-sa-${var.environment}"

  display_name = "Cloud Run Service Account"

  depends_on = [
    google_project_service.iam_api
  ]
}

# API Gateway Service Account
resource "google_service_account" "apigateway_sa" {

  account_id = "apigateway-sa-${var.environment}"

  display_name = "API Gateway Service Account"

  depends_on = [
    google_project_service.iam_api
  ]
}
