locals {

  cloudrun_roles = [
    "roles/secretmanager.secretAccessor",
    "roles/run.developer"
  ]

}

# Cloud Run Service Account

resource "google_project_iam_member" "cloudrun_secret_accessor" {

  for_each = toset(local.cloudrun_roles)

  project = var.project_id

  role = each.value

  member = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}


# API Gateway Service Account

resource "google_project_iam_member" "gateway_invoker" {

  project = var.project_id

  role = "roles/run.invoker"

  member = "serviceAccount:${google_service_account.apigateway_sa.email}"

}