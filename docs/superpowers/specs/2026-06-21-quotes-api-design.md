# Technical Design: Express.js TypeScript Quotes API with Prisma & PostgreSQL on GCP

A lightweight, enterprise-ready quotes microservice using Express.js, TypeScript, and Prisma ORM, designed for deployment on Google Cloud Run and Google Cloud SQL (PostgreSQL).

## 1. System Architecture

The project is structured using the **Layered Controller-Service-Repository Pattern** to ensure highly maintainable, testable, and decoupled code.

```mermaid
graph TD
    Client[HTTP Client] -->|HTTP Request| Controller[Controller Layer]
    Controller -->|Parse & Validate| Service[Service Layer]
    Service -->|Business Logic| Repository[Repository Layer]
    Repository -->|ORM Client| Prisma[Prisma Client]
    Prisma -->|Query/Command| DB[(PostgreSQL)]
```

### Layer Responsibilities:
- **Controller Layer (`src/controllers`)**: Handles parsing incoming HTTP requests, validating request bodies, and structuring HTTP responses (status codes, JSON payload).
- **Service Layer (`src/services`)**: Coordinates business transactions and validations (e.g., ensuring text isn't empty, handling logic boundaries).
- **Repository Layer (`src/repositories`)**: Encapsulates all direct data access/Prisma Client interactions. No SQL or ORM calls live outside this layer.
- **Config Layer (`src/config`)**: Instantiates global singletons like the `PrismaClient`.

---

## 2. Database Schema

We define a 1-to-many relationship between `Author` and `Quote`. A single author can write multiple quotes.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Author {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  quotes    Quote[]
}

model Quote {
  id        Int      @id @default(autoincrement())
  text      String
  authorId  Int
  author    Author   @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## 3. API Specification

All routes are prefixed with `/api`.

### Authors API

#### `GET /api/authors`
Lists all authors in the database.
- **Response (200 OK):**
  ```json
  [
    {
      "id": 1,
      "name": "Bjarne Stroustrup",
      "createdAt": "2026-06-21T03:00:00.000Z",
      "updatedAt": "2026-06-21T03:00:00.000Z"
    }
  ]
  ```

#### `POST /api/authors`
Explicitly creates a new author.
- **Request Body:**
  ```json
  {
    "name": "Dennis Ritchie"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "id": 2,
    "name": "Dennis Ritchie",
    "createdAt": "2026-06-21T03:01:00.000Z",
    "updatedAt": "2026-06-21T03:01:00.000Z"
  }
  ```
- **Errors:**
  - `400 Bad Request` if name is empty or missing.
  - `409 Conflict` if the author name already exists.

---

### Quotes API

#### `GET /api/quotes`
Lists all quotes with nested author information.
- **Response (200 OK):**
  ```json
  [
    {
      "id": 1,
      "text": "There are only two kinds of languages: the ones people complain about and the ones nobody uses.",
      "authorId": 1,
      "createdAt": "2026-06-21T03:00:00.000Z",
      "updatedAt": "2026-06-21T03:00:00.000Z",
      "author": {
        "id": 1,
        "name": "Bjarne Stroustrup"
      }
    }
  ]
  ```

#### `GET /api/quotes/:id`
Fetch a single quote by its integer ID.
- **Response (200 OK):**
  ```json
  {
    "id": 1,
    "text": "There are only two kinds of languages: the ones people complain about and the ones nobody uses.",
    "authorId": 1,
    "createdAt": "2026-06-21T03:00:00.000Z",
    "updatedAt": "2026-06-21T03:00:00.000Z",
    "author": {
      "id": 1,
      "name": "Bjarne Stroustrup"
    }
  }
  ```
- **Errors:**
  - `404 Not Found` if the quote ID does not exist.

#### `POST /api/quotes`
Creates a new quote with **Dynamic Author Resolution**. If the provided author name does not exist, it will be automatically created first.
- **Request Body:**
  ```json
  {
    "text": "There are only two kinds of languages: the ones people complain about and the ones nobody uses.",
    "authorName": "Bjarne Stroustrup"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "id": 1,
    "text": "There are only two kinds of languages: the ones people complain about and the ones nobody uses.",
    "authorId": 1,
    "createdAt": "2026-06-21T03:00:00.000Z",
    "updatedAt": "2026-06-21T03:00:00.000Z"
  }
  ```
- **Errors:**
  - `400 Bad Request` if `text` or `authorName` is missing/empty.

---

## 4. GCP Architecture & Deployment Strategy

Google Cloud Run works optimally when coupled with Google Cloud SQL using standard socket injection.

### Local vs. Production Database Connectivity
- **Local Development**: Connects via traditional TCP port:
  `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/quotes?schema=public"`
- **Production Cloud Run**: We mount the Cloud SQL instance directly to the Cloud Run service as a volume under `/cloudsql`.
  `DATABASE_URL="postgresql://db_user:db_password@localhost/db_name?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME"`

### GCP Provisioning Sequence
1. Create a Cloud SQL (PostgreSQL) instance.
2. Create a database user and an empty database.
3. Build the Docker container using Google Cloud Build.
4. Deploy the service to Google Cloud Run, mounting the Cloud SQL instance connection name and configuring `DATABASE_URL` via environment variables.
5. Execute the database migration step during deployment or via an admin task.
