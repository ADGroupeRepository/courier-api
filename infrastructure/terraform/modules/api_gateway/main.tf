resource "google_api_gateway_api" "api" {
  provider = google-beta
  api_id   = var.api_id
  project  = var.project_id
  display_name = var.api_display_name
}

resource "google_api_gateway_api_config" "config" {
  provider      = google-beta
  api           = google_api_gateway_api.api.api_id
  # Generate a unique ID based on a short hash to force recreation on change (max 63 chars)
  # Include the gateway_service_account in the hash to force a new config to be created if the SA changes.
  api_config_id = "${var.api_id}-cfg-${substr(sha256(join("", [var.openapi_spec_content, var.gateway_service_account != null ? var.gateway_service_account : ""])), 0, 12)}"
  project       = var.project_id

  openapi_documents {
    document {
      path     = "openapi.yaml"
      contents = base64encode(var.openapi_spec_content)
    }
  }

  dynamic "gateway_config" {
    for_each = var.gateway_service_account != null ? [1] : []
    content {
      backend_config {
        google_service_account = var.gateway_service_account
      }
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_api_gateway_gateway" "gateway" {
  provider   = google-beta
  region     = var.region
  gateway_id = var.gateway_id
  api_config = google_api_gateway_api_config.config.id
  project    = var.project_id
  display_name = "${var.api_display_name} Gateway"
}

output "gateway_url" {
  value = google_api_gateway_gateway.gateway.default_hostname
}
