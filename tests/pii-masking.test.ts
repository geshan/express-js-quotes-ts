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
