import { test } from "node:test";
import assert from "node:assert";
import winston from "winston";
import { logger } from "../src/utils/logger.js";
import { trace, context, TraceFlags } from "@opentelemetry/api";
import { AsyncHooksContextManager } from "@opentelemetry/context-async-hooks";

// Register the AsyncHooksContextManager to enable context propagation in test environment
const contextManager = new AsyncHooksContextManager();
contextManager.enable();
context.setGlobalContextManager(contextManager);

test("Winston Logger - PII Masking and Redaction Formatter", () => {
  const logs: any[] = [];
  
  // Custom transport to capture logs
  class MemoryTransport extends winston.Transport {
    log(info: any, callback: () => void) {
      logs.push(info);
      if (callback) {
        callback();
      }
    }
  }

  const memoryTransport = new MemoryTransport();
  logger.add(memoryTransport);

  try {
    // 1. Direct log message redaction (string message)
    logger.info("Please contact customer-support@test.com or call +1 555-555-0199 for help.");

    // 2. Metadata redaction for sensitive keys and nested fields
    logger.info("User details login attempt", {
      password: "secretpassword123",
      token: "bearer-token-abc",
      apiKey: "key-12345",
      user: {
        email: "user@domain.com",
        phone: "555-555-0199",
        name: "John Doe"
      }
    });

    assert.strictEqual(logs.length, 2);

    // Verify first log message is redacted
    assert.ok(logs[0].message.includes("[REDACTED_EMAIL]"), "Email in first log message was not redacted");
    assert.ok(logs[0].message.includes("[REDACTED_PHONE]"), "Phone in first log message was not redacted");

    // Verify second log metadata redactions
    assert.strictEqual(logs[1].password, "[REDACTED]", "Password was not redacted in metadata");
    assert.strictEqual(logs[1].token, "[REDACTED]", "Token was not redacted in metadata");
    assert.strictEqual(logs[1].apiKey, "[REDACTED]", "apiKey was not redacted in metadata");
    assert.strictEqual(logs[1].user.email, "[REDACTED]", "Nested email sensitive key was not redacted in metadata");
    assert.strictEqual(logs[1].user.phone, "[REDACTED_PHONE]", "Nested phone number was not redacted in metadata");
    assert.strictEqual(logs[1].user.name, "John Doe", "Non-sensitive user name was incorrectly redacted");

  } finally {
    logger.remove(memoryTransport);
  }
});

test("Winston Logger - OpenTelemetry Trace Correlation Formatter", () => {
  const logs: any[] = [];
  
  class MemoryTransport extends winston.Transport {
    log(info: any, callback: () => void) {
      logs.push(info);
      if (callback) {
        callback();
      }
    }
  }

  const memoryTransport = new MemoryTransport();
  logger.add(memoryTransport);

  try {
    // Define a mock OpenTelemetry active span context
    const mockSpanContext = {
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      traceFlags: TraceFlags.SAMPLED,
    };
    const mockSpan = trace.wrapSpanContext(mockSpanContext);

    // Set mock GCP project env variables to verify full prefix format
    process.env.GCP_PROJECT = "my-gcp-project-123";

    context.with(trace.setSpan(context.active(), mockSpan), () => {
      logger.info("Log statement inside active span");
    });

    assert.strictEqual(logs.length, 1);
    const logResult = logs[0];

    // Assert trace and span propagation properties are correctly added
    assert.strictEqual(
      logResult["logging.googleapis.com/trace"],
      "projects/my-gcp-project-123/traces/4bf92f3577b34da6a3ce929d0e0e4736",
      "Trace ID with GCP Project prefix was not correctly correlated"
    );
    assert.strictEqual(
      logResult["logging.googleapis.com/spanId"],
      "00f067aa0ba902b7",
      "Span ID was not correctly correlated"
    );
    assert.strictEqual(
      logResult["logging.googleapis.com/trace_sampled"],
      true,
      "Trace Sampled flag was not correctly correlated"
    );

    // Clean up env variables and test without project ID prefix
    delete process.env.GCP_PROJECT;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    logs.length = 0;

    context.with(trace.setSpan(context.active(), mockSpan), () => {
      logger.info("Log statement without GCP project env");
    });

    assert.strictEqual(logs.length, 1);
    assert.strictEqual(
      logs[0]["logging.googleapis.com/trace"],
      "4bf92f3577b34da6a3ce929d0e0e4736",
      "Trace ID without prefix was not correctly correlated"
    );

  } finally {
    logger.remove(memoryTransport);
  }
});

test("Winston Logger - Date, RegExp, and Error preservation and PII masking", () => {
  const logs: any[] = [];
  
  class MemoryTransport extends winston.Transport {
    log(info: any, callback: () => void) {
      logs.push(info);
      if (callback) {
        callback();
      }
    }
  }

  const memoryTransport = new MemoryTransport();
  logger.add(memoryTransport);

  try {
    const testDate = new Date("2026-06-22T22:00:00.000Z");
    const testRegExp = /test-[a-z]+/gi;
    const testError = new Error("Database connection failed for user john.doe@example.com! Phone: 123-456-7890.");
    (testError as any).customField = "some-custom-field-value";

    logger.error("Error occurred during operation", {
      timestamp: testDate,
      pattern: testRegExp,
      error: testError,
    });

    assert.strictEqual(logs.length, 1);
    const logResult = logs[0];

    // Assert Date is preserved
    assert.ok(logResult.timestamp instanceof Date, "Date object was not preserved");
    assert.strictEqual(logResult.timestamp.toISOString(), "2026-06-22T22:00:00.000Z");

    // Assert RegExp is preserved
    assert.ok(logResult.pattern instanceof RegExp, "RegExp object was not preserved");
    assert.strictEqual(logResult.pattern.source, "test-[a-z]+");

    // Assert Error is reconstructed and its PII is redacted
    assert.ok(logResult.error !== null && typeof logResult.error === "object", "Error property is not an object");
    assert.strictEqual(logResult.error.name, "Error");
    assert.ok(logResult.error.message.includes("[REDACTED_EMAIL]"), "PII email inside Error message was not redacted");
    assert.ok(logResult.error.message.includes("[REDACTED_PHONE]"), "PII phone inside Error message was not redacted");
    assert.ok(!logResult.error.message.includes("john.doe@example.com"), "Original email remained inside Error message");
    
    // Assert stack trace PII is redacted
    assert.ok(typeof logResult.error.stack === "string", "Error stack was not preserved as a string");
    assert.ok(logResult.error.stack.includes("[REDACTED_EMAIL]"), "PII email inside Error stack was not redacted");
    assert.ok(logResult.error.stack.includes("[REDACTED_PHONE]"), "PII phone inside Error stack was not redacted");

    // Assert custom properties on Error are recursively handled
    assert.strictEqual(logResult.error.customField, "some-custom-field-value");

  } finally {
    logger.remove(memoryTransport);
  }
});

test("Winston Logger - Circular Reference Protection", () => {
  const logs: any[] = [];
  
  class MemoryTransport extends winston.Transport {
    log(info: any, callback: () => void) {
      logs.push(info);
      if (callback) {
        callback();
      }
    }
  }

  const memoryTransport = new MemoryTransport();
  logger.add(memoryTransport);

  try {
    const circularObj: any = {
      name: "Main",
    };
    circularObj.self = circularObj; // Self circular reference
    
    const nestedCircularObj: any = {
      name: "Nested",
    };
    nestedCircularObj.parent = circularObj;
    circularObj.child = nestedCircularObj; // Indirect circular reference

    logger.info("Logging circular objects", {
      data: circularObj,
    });

    assert.strictEqual(logs.length, 1);
    const logResult = logs[0];

    assert.strictEqual(logResult.data.name, "Main");
    assert.strictEqual(logResult.data.self, "[Circular]");
    assert.strictEqual(logResult.data.child.name, "Nested");
    assert.strictEqual(logResult.data.child.parent, "[Circular]");

  } finally {
    logger.remove(memoryTransport);
  }
});

test("Winston Logger - Map & Set logs redaction and serialization", () => {
  const logs: any[] = [];
  
  class MemoryTransport extends winston.Transport {
    log(info: any, callback: () => void) {
      logs.push(info);
      if (callback) {
        callback();
      }
    }
  }

  const memoryTransport = new MemoryTransport();
  logger.add(memoryTransport);

  try {
    const testSet = new Set(["normal-value", "secret-password-to-redact@example.com", "555-555-0199"]);
    
    const testMap = new Map<string, any>([
      ["normalKey", "normal-value"],
      ["password", "secret-password-123"],
      ["nested", { email: "user@domain.com" }]
    ]);

    logger.info("Logging Maps and Sets", {
      mySet: testSet,
      myMap: testMap,
    });

    assert.strictEqual(logs.length, 1);
    const logResult = logs[0];

    // Assert Set has been serialized to Array and redacted recursively
    assert.ok(Array.isArray(logResult.mySet), "Set was not serialized to an Array");
    assert.strictEqual(logResult.mySet[0], "normal-value");
    assert.strictEqual(logResult.mySet[1], "[REDACTED_EMAIL]");
    assert.strictEqual(logResult.mySet[2], "[REDACTED_PHONE]");

    // Assert Map has been serialized to a Plain Object and redacted recursively
    assert.ok(logResult.myMap !== null && typeof logResult.myMap === "object" && !Array.isArray(logResult.myMap), "Map was not serialized to a plain Object");
    assert.strictEqual(logResult.myMap.normalKey, "normal-value");
    assert.strictEqual(logResult.myMap.password, "[REDACTED]");
    assert.strictEqual(logResult.myMap.nested.email, "[REDACTED]");

  } finally {
    logger.remove(memoryTransport);
  }
});

