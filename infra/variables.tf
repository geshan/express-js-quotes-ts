variable "project_id" {
  type        = string
  description = "The Google Cloud Project ID where resources will be created."
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "The region where the database and Cloud Run service will be deployed."
}

variable "db_user" {
  type        = string
  default     = "quotes_user"
  description = "The database user name."
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "The password for the database user."
}

variable "db_name" {
  type        = string
  default     = "quotes_api"
  description = "The name of the database to be created inside Google Cloud SQL."
}

variable "image_name" {
  type        = string
  description = "The full Docker container image path on GCR/GAR to deploy to Cloud Run."
}
