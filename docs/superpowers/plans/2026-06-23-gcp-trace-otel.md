# GCP Cloud Trace and Structured Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Google Cloud Trace and structured JSON logging with automatic PII masking and log-trace correlation into the Express-Prisma TypeScript project using OpenTelemetry.

**Architecture:** 
- A custom `src/instrumentation.ts` file initializes OpenTelemetry with the GCP Trace Exporter, registers Express, HTTP, and Prisma instrumentations, and applies a custom `SpanProcessor` to redact PII from spans.
- A custom Winston-based logger in `src/utils/logger.ts` formats logs as JSON, applies PII masking, extracts trace context from OpenTelemetry, and injects it using GCP-recognized trace fields.
- First-line imports in `src/server.ts` ensure proper load ordering.

**Tech Stack:**
- OpenTelemetry: `@opentelemetry/api`, `@opentelemetry/sdk-node`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/sdk-trace-node`, `@opentelemetry/resources`, `@opentelemetry/semantic-conventions`
- GCP Exporter: `@google-cloud/opentelemetry-cloud-trace-exporter`
- Instrumentations: `@opentelemetry/instrumentation-http`, `@opentelemetry/instrumentation-express`, `@prisma/instrumentation`
- Logging: `winston`

## Global Constraints
- Do not use placeholders or TBD comments.
- Maintain existing database connections and logic.
- Ensure TypeScript compilation completes successfully without warnings or errors.
- Mask sensitive keys (`password`, `token`, `authorization`, `secret`, `email`, `apiKey`) and regex formats (emails, phone numbers).

---

## Tasks

### Task 1: Install Dependencies and Enable Prisma Tracing

**Files:**
- Modify: `package.json`
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: None
- Produces: Installed NPM packages and Prisma client compiled with tracing preview feature.

- [ ] **Step 1.1: Install new dependencies**
  Run:
  ```bash
  npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/sdk-trace-base @opentelemetry/sdk-trace-node @opentelemetry/resources @opentelemetry/semantic-conventions @opentelemetry/instrumentation-http @opentelemetry/instrumentation-express @prisma/instrumentation @google-cloud/opentelemetry-cloud-trace-exporter winston
  ```

- [ ] **Step 1.2: Enable tracing preview feature in `prisma/schema.prisma`**
  Modify lines 6-8 of `prisma/schema.prisma` to include the `previewFeatures` option:
  ```prisma
  generator client {
    provider        = "prisma-client-js"
    previewFeatures = ["tracing"]
  }
  ```

- [ ] **Step 1.3: Generate Prisma Client and rebuild**
  Run:
  ```bash
  npx prisma generate
  ```
  Expected: Prisma Client is re-generated successfully with tracing support.

---

### Task 2: Implement PII Masking Utility and OpenTelemetry Instrumentation

**Files:**
- Create: `src/utils/pii.ts`
- Create: `src/instrumentation.ts`

**Interfaces:**
- Consumes: Prisma schema, OpenTelemetry SDK packages
- Produces: `redactPii` utility and a registered OpenTelemetry SDK instance running on startup.

- [ ] **Step 2.1: Create `src/utils/pii.ts` with masking logic**
  Create `src/utils/pii.ts` with the following implementation:
  ```typescript
  export function redactPii(value: string): string {
    // 1. Email pattern regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    
    // 2. Simple phone number pattern regex
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

    let redacted = value;
    redacted = redacted.replace(emailRegex, "[REDACTED_EMAIL]");
    redacted = redacted.replace(phoneRegex, "[REDACTED_PHONE]");

    // Replace sensitive URL query params or JSON keys
    const sensitiveKeys = ["password", "token", "authorization", "secret", "email", "apiKey"];
    sensitiveKeys.forEach(key => {
      const queryRegex = new RegExp(`(${key})=([^&\\s\\"\']+)`, "gi");
      redacted = redacted.replace(queryRegex, `$1=[REDACTED]`);
      
      const jsonRegex = new RegExp(`(\"${key}\"\\s*:\\s*)(\"[^\"]+\"|[^\\s,}]+)`, "gi");
      redacted = redacted.replace(jsonRegex, `$1"[REDACTED]"`);
    });

    return redacted;
  }
  ```

- [ ] **Step 2.2: Create `src/instrumentation.ts`**
  Create `src/instrumentation.ts` to boot OpenTelemetry and register a custom `SpanProcessor` to mask PII inside span attributes:
  ```typescript
  import { NodeSDK } from "@opentelemetry/sdk-node";
  import { Resource } from "@opentelemetry/resources";
  import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
  import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
  import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
  import { PrismaInstrumentation } from "@prisma/instrumentation";
  import { TraceExporter } from "@google-cloud/opentelemetry-cloud-trace-exporter";
  import { SpanProcessor, ReadableSpan, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
  import { redactPii } from "./utils/pii.js";

  class PiiRedactionProcessor implements SpanProcessor {
    forceFlush(): Promise<void> {
      return Promise.resolve();
    }

    onStart(): void {
      // No-op
    }

    onEnd(span: ReadableSpan): void {
      const keys = Object.keys(span.attributes);
      for (const key of keys) {
        const val = span.attributes[key];
        if (typeof val === "string") {
          span.attributes[key] = redactPii(val);
        } else if (Array.isArray(val)) {
          span.attributes[key] = val.map(item => typeof item === "string" ? redactPii(item) : item);
        }
      }
      
      // Also scrub PII from the span name
      if (span.name) {
        (span as any).name = redactPii(span.name);
      }
    }

    shutdown(): Promise<void> {
      return Promise.resolve();
    }
  }

  // Create Exporter
  const traceExporter = new TraceExporter();

  // Create custom SpanProcessor that wraps BatchSpanProcessor with redaction
  const piiProcessor = new PiiRedactionProcessor();

  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: "express-js-quotes-api",
    }),
    traceExporter,
    spanProcessors: [
      piiProcessor,
      new BatchSpanProcessor(traceExporter),
    ],
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new PrismaInstrumentation(),
    ],
  });

  try {
    sdk.start();
    console.log("Telemetry initialization complete.");
  } catch (error) {
    console.error("Error initializing telemetry:", error);
  }

  // Graceful shutdown
  process.on("SIGTERM", () => {
    sdk.shutdown()
      .then(() => console.log("Tracing terminated"))
      .catch((err) => console.error("Error terminating tracing", err));
  });
  ```

---

### Task 3: Implement Winston Logger with Trace Context Correlation and PII Masking

**Files:**
- Create: `src/utils/logger.ts`

**Interfaces:**
- Consumes: Winston, OpenTelemetry API, `redactPii`
- Produces: Winston logger instance with automatic trace propagation and formatting.

- [ ] **Step 3.1: Create `src/utils/logger.ts`**
  Create `src/utils/logger.ts` with the custom trace correlation and PII masking formatters:
  ```typescript
  import winston from "winston";
  import { trace, context } from "@opentelemetry/api";
  import { redactPii } from "./pii.js";

  // Formatter to inject GCP Trace and Span IDs
  const traceCorrelationFormat = winston.format((info) => {
    const activeSpan = trace.getSpan(context.active());
    if (activeSpan) {
      const spanContext = activeSpan.spanContext();
      const projectId = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "";
      
      if (projectId) {
        info["logging.googleapis.com/trace"] = `projects/${projectId}/traces/${spanContext.traceId}`;
      } else {
        info["logging.googleapis.com/trace"] = spanContext.traceId;
      }
      info["logging.googleapis.com/spanId"] = spanContext.spanId;
      info["logging.googleapis.com/trace_sampled"] = Boolean(spanContext.traceFlags & 1);
    }
    return info;
  });

  // Formatter to recursively redact PII from log arguments
  const piiMaskingFormat = winston.format((info) => {
    const redactObject = (obj: any): any => {
      if (typeof obj === "string") {
        return redactPii(obj);
      }
      if (Array.isArray(obj)) {
        return obj.map(redactObject);
      }
      if (obj !== null && typeof obj === "object") {
        const result: any = {};
        for (const key of Object.keys(obj)) {
          const sensitiveKeys = ["password", "token", "authorization", "secret", "email", "apiKey"];
          if (sensitiveKeys.includes(key.toLowerCase())) {
            result[key] = "[REDACTED]";
          } else {
            result[key] = redactObject(obj[key]);
          }
        }
        return result;
      }
      return obj;
    };

    const redactedInfo = redactObject(info);
    return redactedInfo;
  });

  export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.combine(
      traceCorrelationFormat(),
      piiMaskingFormat(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console()
    ],
  });
  ```

---

### Task 4: Hook Up Telemetry and Update Server Logging

**Files:**
- Modify: `src/server.ts`

**Interfaces:**
- Consumes: `src/instrumentation.ts` (loaded first), `src/utils/logger.ts`
- Produces: Telemetry-instrumented server startup.

- [ ] **Step 4.1: Import telemetry at the very beginning of `src/server.ts` and replace console logs with our structured logger**
  Update `src/server.ts` completely:
  ```typescript
  import "./instrumentation.js";
  import "dotenv/config";
  import app from "./app.js";
  import { logger } from "./utils/logger.js";

  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });
  ```

---

### Task 5: Verify the Setup

- [ ] **Step 5.1: Compile the project and verify no TypeScript compilation errors**
  Run:
  ```bash
  npm run build
  ```
  Expected: The project compiles into `dist/` without errors or warnings.

- [ ] **Step 5.2: Run existing tests to ensure no regressions**
  Run:
  ```bash
  npm run test
  ```
  Expected: All tests pass.

- [ ] **Step 5.3: Add a test specifically verifying PII masking**
  Create a smoke test `tests/pii-masking.test.ts` to verify the `redactPii` functionality.
  ```typescript
  import { test } from "node:test";
  import assert from "node:assert";
  import { redactPii } from "../src/utils/pii.js";

  test("PII Masking - Redacts emails, phone numbers, and keys", () => {
    const inputEmail = "Send an email to john.doe@example.com immediately.";
    const outputEmail = redactPii(inputEmail);
    assert.strictEqual(outputEmail, "Send an email to [REDACTED_EMAIL] immediately.");

    const inputPhone = "Call me at +1-555-555-0199 or 555-555-0199.";
    const outputPhone = redactPii(inputPhone);
    assert.ok(outputPhone.includes("[REDACTED_PHONE]"));

    const inputQuery = "http://localhost:3000/api/login?password=mysecretpassword&email=john@doe.com";
    const outputQuery = redactPii(inputQuery);
    assert.ok(outputQuery.includes("password=[REDACTED]"));
    assert.ok(outputQuery.includes("email=[REDACTED]"));
  });
  ```

- [ ] **Step 5.4: Run the new PII test**
  Run:
  ```bash
  node --import tsx --test tests/pii-masking.test.ts
  ```
  Expected: Test passes successfully.
