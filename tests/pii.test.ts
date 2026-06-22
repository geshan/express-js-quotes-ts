import { test } from "node:test";
import assert from "node:assert";
import { redactPii } from "../src/utils/pii.js";

test("PII Redaction: Email masking", () => {
  const input = "Please contact support@example.com for help.";
  const expected = "Please contact [REDACTED_EMAIL] for help.";
  assert.strictEqual(redactPii(input), expected);
});

test("PII Redaction: Phone number masking", () => {
  const input = "Call me at +1-123-456-7890 or 123-456-7890.";
  const expected = "Call me at [REDACTED_PHONE] or [REDACTED_PHONE].";
  assert.strictEqual(redactPii(input), expected);
});

test("PII Redaction: URL query parameter masking", () => {
  const input = "https://example.com/api?password=secret123&token=abc-123&email=user@test.com";
  // Since we replace email first, wait:
  // "https://example.com/api?password=secret123&token=abc-123&email=user@test.com"
  // 1. Email redact: "https://example.com/api?password=secret123&token=abc-123&email=[REDACTED_EMAIL]"
  // 2. sensitive keys replace: password=[REDACTED], token=[REDACTED], email=[REDACTED]
  // Let's verify our regex and redact output.
  const redacted = redactPii(input);
  assert.ok(redacted.includes("password=[REDACTED]"));
  assert.ok(redacted.includes("token=[REDACTED]"));
  assert.ok(redacted.includes("email=[REDACTED]"));
});

test("PII Redaction: JSON keys masking", () => {
  const input = JSON.stringify({
    password: "my-secure-password",
    token: "my-token",
    apiKey: "my-api-key",
    normalKey: "normal-value"
  });
  const redacted = redactPii(input);
  assert.ok(redacted.includes('"password":"[REDACTED]"'));
  assert.ok(redacted.includes('"token":"[REDACTED]"'));
  assert.ok(redacted.includes('"apiKey":"[REDACTED]"'));
  assert.ok(redacted.includes('"normalKey":"normal-value"'));
});
