# GCP Deployment Guide: Cloud Run + Cloud SQL (PostgreSQL)

This guide outlines how to deploy the Quotes API using standard Google Cloud CLI (`gcloud`) utilities.

### 1. Prerequisite Environment Variables
Ensure these variables are substituted inside your terminal session:
```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="us-central1"
export INSTANCE_NAME="quotes-db-instance"
export DB_PASSWORD="StrongDBPassword123"
export DB_USER="quotes_user"
export DB_NAME="quotes_api"
```

### 2. Set Active GCP Project
```bash
gcloud config set project $PROJECT_ID
```

### 3. Enable Required GCP Service APIs
```bash
gcloud services enable \
    run.googleapis.com \
    sqladmin.googleapis.com \
    cloudbuild.googleapis.com
```

### 4. Create Google Cloud SQL (PostgreSQL) Instance
```bash
gcloud sql instances create $INSTANCE_NAME \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=$REGION \
    --root-password=$DB_PASSWORD
```

### 5. Create SQL Database & Service User
Create database:
```bash
gcloud sql databases create $DB_NAME --instance=$INSTANCE_NAME
```
Create database user:
```bash
gcloud sql users create $DB_USER --instance=$INSTANCE_NAME --password=$DB_PASSWORD
```

### 6. Retrieve Instance Connection Name
Execute:
```bash
gcloud sql instances describe $INSTANCE_NAME --format="value(connectionName)"
```
*Note connection name which formats as:* `$PROJECT_ID:$REGION:$INSTANCE_NAME`

Let's assign this to a variable:
```bash
export INSTANCE_CONNECTION_NAME="your-project-id:us-central1:quotes-db-instance"
```

### 7. Compile and Build Container on Cloud Build
```bash
gcloud builds submit --tag gcr.io/$PROJECT_ID/quotes-api:latest
```

### 8. Deploy Container to Cloud Run
We mount the Cloud SQL connection dynamically into `/cloudsql` inside the container.
```bash
gcloud run deploy quotes-api-service \
    --image gcr.io/$PROJECT_ID/quotes-api:latest \
    --add-cloudsql-instances $INSTANCE_CONNECTION_NAME \
    --update-env-vars DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost/$DB_NAME?host=/cloudsql/$INSTANCE_CONNECTION_NAME" \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated
```

### 9. Run Database Migrations in Cloud Run environment
To initialize schema inside Cloud SQL production database, you can run migrations locally by tunnel:
```bash
# Local authentication proxy tunnel execution
./cloud-sql-proxy $INSTANCE_CONNECTION_NAME
# Then in a separate terminal:
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME" npx prisma migrate deploy
```
