resource "google_project_service" "cloudbuild_api" {
  service            = "cloudbuild.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "artifactregistry_api" {
  service            = "artifactregistry.googleapis.com"
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "quotes_registry" {
  location      = var.region
  repository_id = "quotes-api"
  description   = "Docker repository for Quotes API"
  format        = "DOCKER"
  depends_on    = [google_project_service.artifactregistry_api]
}

resource "google_cloudbuild_trigger" "quotes_api_trigger" {
  name        = "quotes-api-trigger"
  description = "Builds and deploys the quotes-api-service to Cloud Run on push"
  depends_on  = [google_project_service.cloudbuild_api, google_artifact_registry_repository.quotes_registry]

  github {
    owner = "geshan"
    name  = "express-js-quotes-ts"
    push {
      branch = "^master$|^main$"
    }
  }

  build {
    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "build",
        "-t", "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.quotes_registry.repository_id}/quotes-api:$${SHORT_SHA}",
        "-t", "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.quotes_registry.repository_id}/quotes-api:$${BRANCH_NAME}",
        "-t", "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.quotes_registry.repository_id}/quotes-api:latest",
        "--build-arg", "COMMIT_SHA=$${SHORT_SHA}",
        "--build-arg", "BRANCH_NAME=$${BRANCH_NAME}",
        "."
      ]
    }

    step {
      name = "gcr.io/cloud-builders/docker"
      args = ["push", "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.quotes_registry.repository_id}/quotes-api"]
    }

    step {
      name = "gcr.io/cloud-builders/docker"
      args = ["push", "-a", "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.quotes_registry.repository_id}/quotes-api"]
    }

    step {
      name = "gcr.io/cloud-builders/gcloud"
      args = [
        "run",
        "deploy",
        "quotes-api-service",
        "--image", "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.quotes_registry.repository_id}/quotes-api:$${SHORT_SHA}",
        "--region", var.region,
        "--platform", "managed",
        "--allow-unauthenticated",
        "--cpu-boost"
      ]
    }

    images = ["${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.quotes_registry.repository_id}/quotes-api"]

    options {
      logging = "CLOUD_LOGGING_ONLY"
    }
  }
}
