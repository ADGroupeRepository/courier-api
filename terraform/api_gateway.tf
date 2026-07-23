# API Gateway

resource "google_api_gateway_api" "courier_api" {

  provider = google-beta

  api_id = "courier-api-${var.environment}"


  depends_on = [
    google_project_service.gateway_api
  ]

}

resource "google_api_gateway_api_config" "courier_config" {

  provider = google-beta

  api = google_api_gateway_api.courier_api.api_id

  api_config_id_prefix = "courier-config-api-${var.environment}-"

  openapi_documents {

    document {

      path = "gateway-spec.yaml"

      contents = filebase64("${path.module}/specs/gateway-spec-${var.environment}.yaml")

    }

  }

  lifecycle {
    create_before_destroy = true
  }

}

resource "google_api_gateway_gateway" "courier_gateway" {

  provider = google-beta

  gateway_id = "courier-gateway-${var.environment}"

  api_config = google_api_gateway_api_config.courier_config.id

  region = var.region

  depends_on = [
    google_api_gateway_api_config.courier_config
  ]

}