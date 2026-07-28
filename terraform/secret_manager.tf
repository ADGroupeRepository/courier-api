locals {

  secrets = [

    "APP_KEY_${upper(var.environment)}",

    "APPWRITE_KEY_${upper(var.environment)}",

    "APPWRITE_PROJECT_ID_${upper(var.environment)}",

    "APPWRITE_ENDPOINT_${upper(var.environment)}",

    "TEMP_MEMBER_PASSWORD_${upper(var.environment)}",

    "REDIS_PASSWORD_${upper(var.environment)}",

    "RESEND_API_KEY_${upper(var.environment)}",

    "MAIL_FROM_ADDRESS_${upper(var.environment)}"

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
