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
  const redactObject = (obj: any, visited = new WeakSet<any>()): any => {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === "string") {
      return redactPii(obj);
    }

    if (typeof obj !== "object") {
      return obj;
    }

    // Circular reference protection for reference types
    if (visited.has(obj)) {
      return "[Circular]";
    }
    visited.add(obj);

    if (Array.isArray(obj)) {
      return obj.map(item => redactObject(item, visited));
    }

    if (obj instanceof Date || obj instanceof RegExp) {
      return obj;
    }

    if (obj instanceof Set) {
      // Serialize Set to an array (recursively redacted)
      return redactObject(Array.from(obj), visited);
    }

    if (obj instanceof Map) {
      // Serialize Map to a plain object (recursively redacted)
      const plainObj: any = {};
      for (const [key, val] of obj.entries()) {
        const keyStr = String(key);
        const sensitiveKeys = ["password", "token", "authorization", "secret", "email", "apikey"];
        if (sensitiveKeys.includes(keyStr.toLowerCase())) {
          plainObj[keyStr] = "[REDACTED]";
        } else {
          plainObj[keyStr] = redactObject(val, visited);
        }
      }
      return plainObj;
    }

    if (obj instanceof Error) {
      const errorObj: any = {
        name: obj.name,
        message: redactPii(obj.message),
        stack: obj.stack ? redactPii(obj.stack) : undefined,
      };
      // Capture prototype and other non-enumerable properties recursively using Object.getOwnPropertyNames
      const propNames = Object.getOwnPropertyNames(obj);
      for (const key of propNames) {
        if (key === "name" || key === "message" || key === "stack") {
          continue;
        }
        const sensitiveKeys = ["password", "token", "authorization", "secret", "email", "apikey"];
        if (sensitiveKeys.includes(key.toLowerCase())) {
          errorObj[key] = "[REDACTED]";
        } else {
          errorObj[key] = redactObject((obj as any)[key], visited);
        }
      }
      return errorObj;
    }

    if (obj !== null && typeof obj === "object") {
      const result: any = {};
      for (const key of Object.keys(obj)) {
        const sensitiveKeys = ["password", "token", "authorization", "secret", "email", "apikey"];
        if (sensitiveKeys.includes(key.toLowerCase())) {
          result[key] = "[REDACTED]";
        } else {
          result[key] = redactObject(obj[key], visited);
        }
      }
      return result;
    }

    return obj;
  };

  const redactedInfo = redactObject(info);
  
  // Copy all Symbols from the original info to redactedInfo so that Winston can correctly identify/process the log
  const symbols = Object.getOwnPropertySymbols(info);
  for (const sym of symbols) {
    redactedInfo[sym] = (info as any)[sym];
  }
  
  return redactedInfo;
});

const isProduction = process.env.NODE_ENV === "production" || process.env.ENABLE_GCP_TRACE === "true";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    traceCorrelationFormat(),
    piiMaskingFormat(),
    isProduction ? winston.format.json() : winston.format.combine(winston.format.colorize(), winston.format.simple())
  ),
  transports: [
    new winston.transports.Console()
  ],
});
