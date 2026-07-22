locals {

  secrets = [

    "APP_KEY",

    "APPWRITE_KEY",

    "APPWRITE_PROJECT_ID",

    "APPWRITE_ENDPOINT",

    "TEMP_MEMBER_PASSWORD",

    "REDIS_PASSWORD",

    "RESEND_API_KEY",

    "MAIL_FROM_ADDRESS"

  ]

}

resource "google_secret_manager_secret" "secret" {

  for_each = toset(local.secrets)

  secret_id = each.value

  replication {

    auto {}

  }

  depends_on = [
    google_project_service.secretmanager_api
  ]

}