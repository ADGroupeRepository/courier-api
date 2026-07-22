
resource "google_service_account" "cloudrun_sa" {

  account_id = "cloudrun-sa"

  display_name = "Cloud Run Service Account"

  depends_on = [
    google_project_service.iam_api
  ]
}

resource "google_service_account" "apigateway_sa" {

  account_id = "apigateway-sa"

  display_name = "API Gateway Service Account"

  depends_on = [
    google_project_service.iam_api
  ]
}