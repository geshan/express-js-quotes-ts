import { NodeSDK } from "@opentelemetry/sdk-node";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { RuntimeNodeInstrumentation } from "@opentelemetry/instrumentation-runtime-node";
import { TraceExporter } from "@google-cloud/opentelemetry-cloud-trace-exporter";
import { SpanProcessor, ReadableSpan, BatchSpanProcessor, ConsoleSpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
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
        span.attributes[key] = val.map(item => typeof item === "string" ? redactPii(item) : item) as any;
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

// Create custom SpanProcessor that wraps BatchSpanProcessor with redaction
const piiProcessor = new PiiRedactionProcessor();

const isProduction = process.env.NODE_ENV === "production" || process.env.ENABLE_GCP_TRACE === "true";

const spanProcessors: SpanProcessor[] = [piiProcessor];

if (isProduction) {
  const traceExporter = new TraceExporter();
  spanProcessors.push(new BatchSpanProcessor(traceExporter));
} else {
  const consoleExporter = new ConsoleSpanExporter();
  spanProcessors.push(new SimpleSpanProcessor(consoleExporter));
}

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: "express-js-quotes-api",
  }),
  spanProcessors,
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
    new PrismaInstrumentation(),
    new PgInstrumentation({
      enabled: true,
      enhancedDatabaseReporting: true,
      ignoreConnectSpans: true,
    }),
    new RuntimeNodeInstrumentation(),
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
