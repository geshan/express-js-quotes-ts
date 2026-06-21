resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "iam.googleapis.com"
  ])
  service            = each.key
  disable_on_destroy = false
}

resource "random_id" "db_suffix" {
  byte_length = 4
}

resource "google_sql_database_instance" "instance" {
  name             = "quotes-db-instance-${random_id.db_suffix.hex}"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier = "db-f1-micro"

    ip_configuration {
      ipv4_enabled = true
    }
  }

  deletion_protection = false

  depends_on = [google_project_service.apis]
}

resource "google_sql_database" "database" {
  name     = var.db_name
  instance = google_sql_database_instance.instance.name
}

resource "google_sql_user" "user" {
  name     = var.db_user
  instance = google_sql_database_instance.instance.name
  password = var.db_password
}

resource "google_service_account" "cloud_run_sa" {
  account_id   = "quotes-api-run-sa"
  display_name = "Service Account for Quotes API Cloud Run"
  depends_on   = [google_project_service.apis]
}

resource "google_project_iam_member" "cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_cloud_run_v2_service" "api_service" {
  name     = "quotes-api-service"
  location = var.region

  template {
    service_account = google_service_account.cloud_run_sa.email

    containers {
      image = var.image_name

      ports {
        container_port = 3000
      }

      env {
        name  = "DATABASE_URL"
        value = "postgresql://${var.db_user}:${var.db_password}@localhost/${var.db_name}?host=/cloudsql/${google_sql_database_instance.instance.connection_name}"
      }

      env {
        name  = "PORT"
        value = "3000"
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.instance.connection_name]
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  deletion_protection = false

  depends_on = [
    google_project_service.apis,
    google_sql_database_instance.instance,
    google_project_iam_member.cloudsql_client
  ]
}

resource "google_cloud_run_v2_service_iam_member" "public_access" {
  name     = google_cloud_run_v2_service.api_service.name
  location = google_cloud_run_v2_service.api_service.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
