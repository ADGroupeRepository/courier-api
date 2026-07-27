locals {

  github_roles = [
    "roles/artifactregistry.admin",
    "roles/run.developer",
    "roles/apigateway.admin",
    "roles/secretmanager.secretAccessor",
    "roles/iam.serviceAccountUser"
  ]

}

# github actions Service Account
resource "google_project_iam_member" "github_actions" {

  for_each = toset(local.github_roles)

  project = var.project_id

  role = each.value

  member = "serviceAccount:${google_service_account.github_actions_sa.email}"
}

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

resource "google_service_account_iam_member" "github_wif" {

  service_account_id = google_service_account.github_actions_sa.name

  role = "roles/iam.workloadIdentityUser"

  member = "principalSet://iam.googleapis.com/projects/798287738190/locations/global/workloadIdentityPools/github-pool/attribute.repository/ADGroupeRepository/courier-api"
}


resource "google_service_account_iam_member" "github_actions_impersonation" {

  service_account_id = google_service_account.github_actions_sa.name

  role = "roles/iam.serviceAccountTokenCreator"

  member = "principalSet://iam.googleapis.com/projects/798287738190/locations/global/workloadIdentityPools/github-pool/attribute.repository/ADGroupeRepository/courier-api"
}
