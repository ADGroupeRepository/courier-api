# Cloud Run

resource "google_cloud_run_v2_service" "courier_api" {

  name     = "courier-api-${var.environment}"
  location = var.region

  ingress = "INGRESS_TRAFFIC_ALL"

  #  deletion_protection = false

  template {

    service_account = google_service_account.cloudrun_sa.email

    scaling {

      min_instance_count = 0
      max_instance_count = 2

    }

    containers {

      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.courier_api.repository_id}/courier-api-${var.environment}:${var.image_tag}"

      resources {

        limits = {

          memory = "512Mi"

        }

      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "TZ"
        value = "UTC"
      }

      env {
        name  = "LOG_LEVEL"
        value = "info"
      }

      env {
        name  = "LOCK_STORE"
        value = "redis"
      }

      env {
        name  = "LIMITER_STORE"
        value = "redis"
      }

      env {
        name  = "REDIS_HOST"
        value = "country-exquisite-sack-66092.db.redis.io"
      }

      env {
        name  = "REDIS_PORT"
        value = "19713"
      }

      env {
        name  = "REDIS_KEY_PREFIX"
        value = "courier:"
      }

      env {
        name  = "APP_URL"
        value = "https://courier-gateway-a6q7woy6.ew.gateway.dev"
      }

      # Secret Manager variables

      env {

        name = "APP_KEY"

        value_source {

          secret_key_ref {

            secret  = google_secret_manager_secret.secret["APP_KEY"].secret_id
            version = "latest"

          }

        }

      }

      env {

        name = "APPWRITE_KEY"

        value_source {

          secret_key_ref {

            secret  = google_secret_manager_secret.secret["APPWRITE_KEY"].secret_id
            version = "latest"

          }

        }

      }

      env {

        name = "APPWRITE_PROJECT_ID"

        value_source {

          secret_key_ref {

            secret  = google_secret_manager_secret.secret["APPWRITE_PROJECT_ID"].secret_id
            version = "latest"

          }

        }

      }

      env {

        name = "APPWRITE_ENDPOINT"

        value_source {

          secret_key_ref {

            secret  = google_secret_manager_secret.secret["APPWRITE_ENDPOINT"].secret_id
            version = "latest"

          }

        }

      }

      env {

        name = "TEMP_MEMBER_PASSWORD"

        value_source {

          secret_key_ref {

            secret  = google_secret_manager_secret.secret["TEMP_MEMBER_PASSWORD"].secret_id
            version = "latest"

          }

        }

      }

      env {

        name = "REDIS_PASSWORD"

        value_source {

          secret_key_ref {

            secret  = google_secret_manager_secret.secret["REDIS_PASSWORD"].secret_id
            version = "latest"

          }

        }

      }

      env {

        name = "RESEND_API_KEY"

        value_source {

          secret_key_ref {

            secret  = google_secret_manager_secret.secret["RESEND_API_KEY"].secret_id
            version = "latest"

          }

        }

      }

      env {

        name = "MAIL_FROM_ADDRESS"

        value_source {

          secret_key_ref {

            secret  = google_secret_manager_secret.secret["MAIL_FROM_ADDRESS"].secret_id
            version = "latest"

          }

        }

      }

    }

  }

  depends_on = [
    google_service_account.cloudrun_sa,
    google_artifact_registry_repository.courier_api,
    google_secret_manager_secret.secret
  ]

}