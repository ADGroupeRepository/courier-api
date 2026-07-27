terraform {

  backend "gcs" {

    bucket = "courier-tf-state"

    prefix = "environments"

  }

}
