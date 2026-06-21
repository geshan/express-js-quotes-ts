# Express.js TypeScript Quotes API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a robust, layered Express.js TypeScript Quotes REST API using Prisma ORM and PostgreSQL, fully prepared for GCP Cloud Run and Cloud SQL deployment.

**Architecture:** Layered Controller-Service-Repository Pattern. Database operations are strictly encapsulated in Repository classes, coordinated by Services, invoked by Express Controllers, and bound to Routers.

**Tech Stack:** Express.js, TypeScript, Prisma ORM, Node.js (v24), PostgreSQL, native Node.js Test Runner, and `tsx` for execution.

## Global Constraints

- Language: TypeScript (strict mode enabled)
- Framework: Express.js (v4.x)
- ORM: Prisma (v5.x)
- Database: PostgreSQL (v15+)
- Database Keys: Auto-incrementing Integers (1, 2, 3...)
- API Feature: Dynamic Author Resolution on quote creation (creates the author if not exists, otherwise connects)
- Testing: Native Node.js Test Runner (`node --test`) using `tsx` for TS compilation
- Schema naming conventions: Lowercase table names (`author`, `quote`) and snake_case column names (`created_at`, `updated_at`, `author_id`).

---

### Task 1: Basic Scaffolding & Configuration [COMPLETED]

This task is fully completed. Files `package.json`, `tsconfig.json`, `.env`, and `tests/smoke.test.ts` exist and smoke tests are passing cleanly.

---

### Task 2: Prisma Schema & Database Client Config

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/config/database.ts`
- Test: `tests/database.test.ts`

**Interfaces:**
- Consumes: Prisma config and dependency pipeline (Task 1)
- Produces: `db` client instance (exporting `prisma: PrismaClient`)

- [x] **Step 1: Write prisma/schema.prisma**
  Create the Prisma schema model incorporating lowercase model names and snake_case column names.
  ```prisma
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }

  generator client {
    provider = "prisma-client-js"
  }

  model author {
    id         Int      @id @default(autoincrement())
    name       String   @unique
    email      String?  @unique
    created_at DateTime @default(now())
    updated_at DateTime @updatedAt
    quotes     quote[]
  }

  model quote {
    id         Int      @id @default(autoincrement())
    text       String
    author_id  Int
    author     author   @relation(fields: [author_id], references: [id], onDelete: Cascade)
    created_at DateTime @default(now())
    updated_at DateTime @updatedAt
  }
  ```

- [x] **Step 2: Write database configuration**
  Create `src/config/database.ts` for database connection pooling and Client exporting.
  ```typescript
  import { PrismaClient } from "@prisma/client";

  export const prisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
  ```

- [x] **Step 3: Run database migration locally**
  Run: `npx prisma migrate dev --name rename_to_snake_case`
  Expected: Success.

- [x] **Step 4: Create a database connection verification test**
  Create `tests/database.test.ts` to verify basic Prisma connectivity.
  ```typescript
  import { test, after } from "node:test";
  import assert from "node:assert";
  import { prisma } from "../src/config/database.ts";

  after(async () => {
    await prisma.$disconnect();
  });

  test("Database connectivity test", async () => {
    try {
      await prisma.$connect();
      assert.ok(true, "Database successfully connected!");
    } catch (err) {
      assert.fail("Failed to connect to the database: " + err);
    }
  });
  ```

- [x] **Step 5: Run tests**
  Run: `npm run test`
  Expected: PASS

- [x] **Step 6: Commit Task 2**
  `git commit -am "feat: setup Prisma schema and database client config"`

---

### Task 3: Author Layer (Repository, Service, Controller, Route)

**Files:**
- Create: `src/repositories/author.repository.ts`
- Create: `src/services/author.service.ts`
- Create: `src/controllers/author.controller.ts`
- Create: `src/routes/author.routes.ts`
- Test: `tests/author.test.ts`

**Interfaces:**
- Consumes: `prisma` (from `src/config/database.ts`)
- Produces: Express author routes, `AuthorRepository` and `AuthorService` classes

- [ ] **Step 1: Write integration tests for Author service/repository**
  Create `tests/author.test.ts`. This tests both repository and service layers.
  ```typescript
  import { test, after, beforeEach } from "node:test";
  import assert from "node:assert";
  import { prisma } from "../src/config/database.ts";
  import { AuthorRepository } from "../src/repositories/author.repository.ts";
  import { AuthorService } from "../src/services/author.service.ts";

  const repo = new AuthorRepository();
  const service = new AuthorService(repo);

  beforeEach(async () => {
    await prisma.quote.deleteMany();
    await prisma.author.deleteMany();
  });

  after(async () => {
    await prisma.$disconnect();
  });

  test("AuthorService - create and retrieve author", async () => {
    const record = await service.createAuthor({ name: "Bjarne Stroustrup", email: "bjarne@stroustrup.com" });
    assert.strictEqual(record.name, "Bjarne Stroustrup");
    assert.strictEqual(record.email, "bjarne@stroustrup.com");
    assert.ok(record.id > 0);

    const list = await service.getAllAuthors();
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].name, "Bjarne Stroustrup");
  });

  test("AuthorService - duplicate author email/name check", async () => {
    await service.createAuthor({ name: "Bjarne Stroustrup", email: "bjarne@stroustrup.com" });
    await assert.rejects(
      () => service.createAuthor({ name: "Bjarne Stroustrup", email: "other@stroustrup.com" }),
      /Author name or email already exists/
    );
  });
  ```

- [ ] **Step 2: Implement AuthorRepository**
  Create `src/repositories/author.repository.ts`.
  ```typescript
  import { prisma } from "../src/config/database.ts";
  import { author } from "@prisma/client";

  export class AuthorRepository {
    async create(data: { name: string; email?: string }): Promise<author> {
      return prisma.author.create({
        data,
      });
    }

    async findAll(): Promise<author[]> {
      return prisma.author.findMany({
        orderBy: { name: "asc" },
      });
    }

    async findByName(name: string): Promise<author | null> {
      return prisma.author.findUnique({
        where: { name },
      });
    }

    async findByEmail(email: string): Promise<author | null> {
      return prisma.author.findUnique({
        where: { email },
      });
    }
  }
  ```

- [ ] **Step 3: Implement AuthorService**
  Create `src/services/author.service.ts`.
  ```typescript
  import { AuthorRepository } from "../src/repositories/author.repository.ts";
  import { author } from "@prisma/client";

  export class AuthorService {
    constructor(private authorRepository: AuthorRepository) {}

    async createAuthor(data: { name: string; email?: string }): Promise<author> {
      if (!data.name || data.name.trim() === "") {
        throw new Error("Author name is required");
      }

      const existingByName = await this.authorRepository.findByName(data.name);
      if (existingByName) {
        throw new Error("Author name or email already exists");
      }

      if (data.email) {
        const existingByEmail = await this.authorRepository.findByEmail(data.email);
        if (existingByEmail) {
          throw new Error("Author name or email already exists");
        }
      }

      return this.authorRepository.create({
        name: data.name.trim(),
        email: data.email?.trim() || undefined,
      });
    }

    async getAllAuthors(): Promise<author[]> {
      return this.authorRepository.findAll();
    }
  }
  ```

- [ ] **Step 4: Implement AuthorController**
  Create `src/controllers/author.controller.ts`.
  ```typescript
  import { Request, Response } from "express";
  import { AuthorService } from "../src/services/author.service.ts";

  export class AuthorController {
    constructor(private authorService: AuthorService) {}

    create = async (req: Request, res: Response): Promise<void> => {
      try {
        const { name, email } = req.body;
        const result = await this.authorService.createAuthor({ name, email });
        res.status(201).json(result);
      } catch (err: any) {
        if (err.message === "Author name or email already exists") {
          res.status(409).json({ error: err.message });
        } else {
          res.status(400).json({ error: err.message });
        }
      }
    };

    getAll = async (req: Request, res: Response): Promise<void> => {
      try {
        const authors = await this.authorService.getAllAuthors();
        res.status(200).json(authors);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    };
  }
  ```

- [ ] **Step 5: Implement AuthorRoutes**
  Create `src/routes/author.routes.ts`.
  ```typescript
  import { Router } from "express";
  import { AuthorRepository } from "../src/repositories/author.repository.ts";
  import { AuthorService } from "../src/services/author.service.ts";
  import { AuthorController } from "../src/controllers/author.controller.ts";

  const router = Router();
  const repo = new AuthorRepository();
  const service = new AuthorService(repo);
  const controller = new AuthorController(service);

  router.get("/", controller.getAll);
  router.post("/", controller.create);

  export default router;
  ```

- [ ] **Step 6: Run Author integration tests**
  Run: `npm run test`
  Expected: PASS (author tests successfully pass)

- [ ] **Step 7: Commit Task 3**
  ```bash
  git add src/repositories/author.repository.ts src/services/author.service.ts src/controllers/author.controller.ts src/routes/author.routes.ts tests/author.test.ts
  git commit -m "feat: implement Author layered architecture with tests"
  ```

---

### Task 4: Quote Layer with Dynamic Author Resolution

**Files:**
- Create: `src/repositories/quote.repository.ts`
- Create: `src/services/quote.service.ts`
- Create: `src/controllers/quote.controller.ts`
- Create: `src/routes/quote.routes.ts`
- Test: `tests/quote.test.ts`

**Interfaces:**
- Consumes: `prisma` client, `AuthorRepository` (Task 3)
- Produces: Express quote routes, `QuoteRepository` and `QuoteService` classes

- [ ] **Step 1: Write integration tests for Quote service/repository**
  Create `tests/quote.test.ts` covering normal retrievals and the critical dynamic resolution transaction.
  ```typescript
  import { test, after, beforeEach } from "node:test";
  import assert from "node:assert";
  import { prisma } from "../src/config/database.ts";
  import { QuoteRepository } from "../src/repositories/quote.repository.ts";
  import { QuoteService } from "../src/services/quote.service.ts";

  const repo = new QuoteRepository();
  const service = new QuoteService(repo);

  beforeEach(async () => {
    await prisma.quote.deleteMany();
    await prisma.author.deleteMany();
  });

  after(async () => {
    await prisma.$disconnect();
  });

  test("QuoteService - create with Dynamic Author Resolution and retrieve", async () => {
    // 1. Create a quote with a completely new author name (should auto-create author)
    const quote1 = await service.createQuote({
      text: "There are only two kinds of languages...",
      author_name: "Bjarne Stroustrup",
    });
    assert.strictEqual(quote1.text, "There are only two kinds of languages...");
    assert.ok(quote1.author_id > 0);

    // Verify author was dynamically created
    const record = await prisma.author.findUnique({ where: { id: quote1.author_id } });
    assert.ok(record);
    assert.strictEqual(record.name, "Bjarne Stroustrup");

    // 2. Create another quote with the SAME author name (should link to existing author)
    const quote2 = await service.createQuote({
      text: "C++ makes it harder to shoot yourself in the foot...",
      author_name: "Bjarne Stroustrup",
    });
    assert.strictEqual(quote2.author_id, quote1.author_id);

    // 3. List all quotes (includes author)
    const quotes = await service.getAllQuotes();
    assert.strictEqual(quotes.length, 2);
    assert.strictEqual(quotes[0].author.name, "Bjarne Stroustrup");
  });

  test("QuoteService - fetch by ID", async () => {
    const created = await service.createQuote({
      text: "Simple is better than complex.",
      author_name: "Tim Peters",
    });

    const quote = await service.getQuoteById(created.id);
    assert.ok(quote);
    assert.strictEqual(quote.text, "Simple is better than complex.");
    assert.strictEqual(quote.author.name, "Tim Peters");
  });
  ```

- [ ] **Step 2: Implement QuoteRepository**
  Create `src/repositories/quote.repository.ts`.
  ```typescript
  import { prisma } from "../src/config/database.ts";
  import { quote } from "@prisma/client";

  type QuoteWithAuthor = quote & {
    author: {
      id: number;
      name: string;
      email: string | null;
    };
  };

  export class QuoteRepository {
    async createWithDynamicAuthor(text: string, author_name: string): Promise<quote> {
      return prisma.quote.create({
        data: {
          text,
          author: {
            connectOrCreate: {
              where: { name: author_name },
              create: { name: author_name },
            },
          },
        },
      });
    }

    async findAll(): Promise<QuoteWithAuthor[]> {
      return prisma.quote.findMany({
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
      }) as Promise<QuoteWithAuthor[]>;
    }

    async findById(id: number): Promise<QuoteWithAuthor | null> {
      return prisma.quote.findById({
        where: { id },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }) as Promise<QuoteWithAuthor | null>;
    }
  }
  ```

- [ ] **Step 3: Implement QuoteService**
  Create `src/services/quote.service.ts`.
  ```typescript
  import { QuoteRepository } from "../src/repositories/quote.repository.ts";
  import { quote } from "@prisma/client";

  export class QuoteService {
    constructor(private quoteRepository: QuoteRepository) {}

    async createQuote(data: { text: string; author_name: string }): Promise<quote> {
      if (!data.text || data.text.trim() === "") {
        throw new Error("Quote text is required");
      }
      if (!data.author_name || data.author_name.trim() === "") {
        throw new Error("Author name is required");
      }

      return this.quoteRepository.createWithDynamicAuthor(
        data.text.trim(),
        data.author_name.trim()
      );
    }

    async getAllQuotes() {
      return this.quoteRepository.findAll();
    }

    async getQuoteById(id: number) {
      const quote = await this.quoteRepository.findById(id);
      if (!quote) {
        throw new Error("Quote not found");
      }
      return quote;
    }
  }
  ```

- [ ] **Step 4: Implement QuoteController**
  Create `src/controllers/quote.controller.ts`.
  ```typescript
  import { Request, Response } from "express";
  import { QuoteService } from "../src/services/quote.service.ts";

  export class QuoteController {
    constructor(private quoteService: QuoteService) {}

    create = async (req: Request, res: Response): Promise<void> => {
      try {
        const { text, author_name } = req.body;
        const result = await this.quoteService.createQuote({ text, author_name });
        res.status(201).json(result);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    };

    getAll = async (req: Request, res: Response): Promise<void> => {
      try {
        const quotes = await this.quoteService.getAllQuotes();
        res.status(200).json(quotes);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    };

    getById = async (req: Request, res: Response): Promise<void> => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          res.status(400).json({ error: "Invalid ID parameter" });
          return;
        }
        const quote = await this.quoteService.getQuoteById(id);
        res.status(200).json(quote);
      } catch (err: any) {
        res.status(404).json({ error: err.message });
      }
    };
  }
  ```

- [ ] **Step 5: Implement QuoteRoutes**
  Create `src/routes/quote.routes.ts`.
  ```typescript
  import { Router } from "express";
  import { QuoteRepository } from "../src/repositories/quote.repository.ts";
  import { QuoteService } from "../src/services/quote.service.ts";
  import { QuoteController } from "../src/controllers/quote.controller.ts";

  const router = Router();
  const repo = new QuoteRepository();
  const service = new QuoteService(repo);
  const controller = new QuoteController(service);

  router.get("/", controller.getAll);
  router.get("/:id", controller.getById);
  router.post("/", controller.create);

  export default router;
  ```

- [ ] **Step 6: Run Quote integration tests**
  Run: `npm run test`
  Expected: PASS (smoke, db, author, and quote tests successful!)

- [ ] **Step 7: Commit Task 4**
  ```bash
  git add src/repositories/quote.repository.ts src/services/quote.service.ts src/controllers/quote.controller.ts src/routes/quote.routes.ts tests/quote.test.ts
  git commit -m "feat: implement Quote layered architecture with dynamic resolution"
  ```

---

### Task 5: App Routing, Server entrypoint, and DB Seeding

**Files:**
- Create: `src/routes/index.ts`
- Create: `src/app.ts`
- Create: `src/server.ts`
- Create: `prisma/seed.ts`

**Interfaces:**
- Consumes: routers (Task 3, 4)
- Produces: Working Express server instance & populated seed data script

- [ ] **Step 1: Create central Router**
  Create `src/routes/index.ts`.
  ```typescript
  import { Router } from "express";
  import authorRoutes from "./author.routes.ts";
  import quoteRoutes from "./quote.routes.ts";

  const router = Router();

  router.use("/authors", authorRoutes);
  router.use("/quotes", quoteRoutes);

  export default router;
  ```

- [ ] **Step 2: Create Express App initialization**
  Create `src/app.ts` linking routers and generic JSON middlewares.
  ```typescript
  import express from "express";
  import cors from "cors";
  import apiRouter from "./routes/index.ts";

  const app = express();

  app.use(cors());
  app.use(express.json());

  // API router mount
  app.use("/api", apiRouter);

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  export default app;
  ```

- [ ] **Step 3: Create Server bootstrap entrypoint**
  Create `src/server.ts` binding the server to `PORT`.
  ```typescript
  import "dotenv/config";
  import app from "./app.ts";

  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
  ```

- [ ] **Step 4: Create Database Seeder**
  Create `prisma/seed.ts` featuring Bjarne Stroustrup and other tech pioneers using updated lowercase models and snake_case fields.
  ```typescript
  import { PrismaClient } from "@prisma/client";

  const prisma = new PrismaClient();

  async function main() {
    // Clean database before seeding
    await prisma.quote.deleteMany();
    await prisma.author.deleteMany();

    // Create authors & quotes dynamically in single calls
    await prisma.quote.create({
      data: {
        text: "There are only two kinds of languages: the ones people complain about and the ones nobody uses.",
        author: {
          create: {
            name: "Bjarne Stroustrup",
            email: "bjarne@stroustrup.com",
          },
        },
      },
    });

    await prisma.quote.create({
      data: {
        text: "Simple is better than complex.",
        author: {
          create: {
            name: "Tim Peters",
            email: "tim@python.org",
          },
        },
      },
    });

    console.log("Database successfully seeded!");
  }

  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
  ```

- [ ] **Step 5: Execute database seeding**
  Run: `npx prisma db seed`
  Expected: "Database successfully seeded!"

- [ ] **Step 6: Verify full test suite passes**
  Run: `npm run test`
  Expected: ALL tests pass.

- [ ] **Step 7: Commit Task 5**
  ```bash
  git add src/routes/index.ts src/app.ts src/server.ts prisma/seed.ts
  git commit -m "feat: complete API routing, server bootstrapping, and db seeding"
  ```

---

### Task 6: Dockerization & GCP Deployment Instructions

**Files:**
- Create: `Dockerfile`
- Create: `gcp-deploy-guide.md`

**Interfaces:**
- Consumes: Whole codebase setup
- Produces: Production Docker container image and deployment roadmap

- [ ] **Step 1: Write multi-stage Dockerfile**
  Create `Dockerfile` optimized for GCP Cloud Run and Node sizing.
  ```dockerfile
  # --- Build Stage ---
  FROM node:24-alpine AS builder

  WORKDIR /app

  COPY package*.json ./
  COPY prisma ./prisma/

  RUN npm ci

  COPY tsconfig.json ./
  COPY src ./src

  # Generate Prisma Client and compile TS to JS
  RUN npx prisma generate
  RUN npm run build

  # --- Production Stage ---
  FROM node:24-alpine AS runner

  WORKDIR /app

  ENV NODE_ENV=production

  COPY package*.json ./
  COPY prisma ./prisma/

  # Install only production dependencies
  RUN npm ci --only=production && npx prisma generate

  # Copy compiled code from builder stage
  COPY --from=builder /app/dist ./dist

  EXPOSE 3000

  CMD ["node", "dist/server.js"]
  ```

- [ ] **Step 2: Create gcp-deploy-guide.md**
  Create `gcp-deploy-guide.md` documenting exact step-by-step commands to deploy.
  ```markdown
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
  ```

- [ ] **Step 3: Commit Task 6**
  ```bash
  git add Dockerfile gcp-deploy-guide.md
  git commit -m "docs: add Dockerfile and step-by-step GCP Cloud Run deployment guide"
  ```
