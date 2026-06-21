output "service_url" {
  value       = google_cloud_run_v2_service.api_service.uri
  description = "The public URL of the deployed Quotes API service."
}

output "db_instance_connection_name" {
  value       = google_sql_database_instance.instance.connection_name
  description = "The connection name of the Cloud SQL PostgreSQL instance."
}

output "db_instance_ip" {
  value       = google_sql_database_instance.instance.public_ip_address
  description = "The public IP address of the Cloud SQL PostgreSQL instance."
}
