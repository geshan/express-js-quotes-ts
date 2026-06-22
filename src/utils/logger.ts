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
    if (obj instanceof Date || obj instanceof RegExp) {
      return obj;
    }
    if (obj instanceof Error) {
      const errorObj: any = {
        name: obj.name,
        message: redactPii(obj.message),
        stack: obj.stack ? redactPii(obj.stack) : undefined,
      };
      for (const key of Object.keys(obj)) {
        errorObj[key] = redactObject((obj as any)[key]);
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
          result[key] = redactObject(obj[key]);
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
