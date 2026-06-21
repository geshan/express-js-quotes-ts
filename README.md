# Express.js TypeScript Quotes API

A robust, layered Express.js TypeScript REST API for managing technical quotes and authors. This project is built using **Prisma ORM** with **PostgreSQL** and is pre-configured for containerized execution and deployment on Google Cloud Run and Cloud SQL.

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: Version `24.x` (Switch automatically with `.nvmrc` by running `nvm use`)
* **PostgreSQL**: Version `15+` (or Docker installed to run DB containers)

---

## 🛠️ Local Development (Native Node.js)

### 1. Spin up PostgreSQL locally
If you have Docker installed, you can start a local PostgreSQL container quickly:
```bash
docker run --name pg-quotes -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=quotes -p 5432:5432 -d postgres:15-alpine
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory (or use the pre-configured file):
```env
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/quotes?schema=public"
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Migrations & Database Seeding
Initialize the database tables and populate them with standard seed data:
```bash
# Apply migrations to local DB
npx prisma migrate dev

# Populate with pioneer seed data (Bjarne Stroustrup, Tim Peters, etc.)
npx prisma db seed
```

### 5. Start the Application
Run the API in hot-reload development watch mode:
```bash
npm run dev
```
The server will start listening at **`http://localhost:3000`**.

### 6. Run the Test Suite
Run integration and connectivity tests using Node's native test runner:
```bash
npm test
```

---

## 🐳 Local Development (Docker Compose)

You can spin up both the application service and the Postgres database simultaneously using Docker Compose:

```bash
docker compose up --build
```
This single command handles service compilation, database health checks, dependencies ordering, and exposes the REST API at **`http://localhost:3000`**.

### Running Tests inside Docker Compose
To execute the application integration test suite inside a dedicated, isolated Docker container containerized against the compose Postgres database, run:
```bash
docker compose --profile test run --rm test
```
This automatically builds the test-stage image, boots the DB container, waits for the DB container to be healthy, executes the Node.js native test runner, and prints the result.

---

## 📖 API Documentation & cURL Examples

All REST API endpoints are prefixed with `/api`.

### 1. Create a Quote (Dynamic Author Resolution)
Creates a new quote. If the `author_name` provided already exists in the database, the quote is dynamically connected to that author. If they do not exist, a new author record is created automatically.

* **Endpoint**: `POST /api/quotes`
* **cURL Command**:
```bash
curl -X POST http://localhost:3000/api/quotes \
  -H "Content-Type: application/json" \
  -d '{
    "text": "There are only two kinds of languages: the ones people complain about and the ones nobody uses.",
    "author_name": "Bjarne Stroustrup"
  }'
```
* **Sample Response (201 Created)**:
```json
{
  "id": 1,
  "text": "There are only two kinds of languages: the ones people complain about and the ones nobody uses.",
  "author_id": 1,
  "created_at": "2026-06-21T07:14:00.000Z",
  "updated_at": "2026-06-21T07:14:00.000Z"
}
```

### 2. Retrieve a Quote by ID
Fetch a single quote by its integer ID, including nested author information.

* **Endpoint**: `GET /api/quotes/:id`
* **cURL Command**:
```bash
curl -X GET http://localhost:3000/api/quotes/1
```
* **Sample Response (200 OK)**:
```json
{
  "id": 1,
  "text": "There are only two kinds of languages: the ones people complain about and the ones nobody uses.",
  "author_id": 1,
  "created_at": "2026-06-21T07:14:00.000Z",
  "updated_at": "2026-06-21T07:14:00.000Z",
  "author": {
    "id": 1,
    "name": "Bjarne Stroustrup",
    "email": "bjarne@stroustrup.com"
  }
}
```

### 3. Retrieve All Quotes
* **Endpoint**: `GET /api/quotes`
* **cURL Command**:
```bash
curl -X GET http://localhost:3000/api/quotes
```

### 4. Retrieve All Authors
* **Endpoint**: `GET /api/authors`
* **cURL Command**:
```bash
curl -X GET http://localhost:3000/api/authors
```

---

## ☁️ Google Cloud Deployment

Instructions and production multi-stage Docker build files are fully provided:
* **Docker configuration**: Check out the production [Dockerfile](file:///Users/geshan/Projects/misc/express-js-quotes-ts/Dockerfile).
* **Step-by-step GCP Deployment CLI Guide**: See [gcp-deploy-guide.md](file:///Users/geshan/Projects/misc/express-js-quotes-ts/gcp-deploy-guide.md).
* **Terraform Infrastructure scripts**: Provision cloud resources automatically with standard scripts in the [infra/](file:///Users/geshan/Projects/misc/express-js-quotes-ts/infra) directory.
