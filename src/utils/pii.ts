const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

const sensitiveKeys = ["password", "token", "authorization", "secret", "email", "apiKey"];

const queryRegexes = sensitiveKeys.map(key => new RegExp(`(${key})=([^&\\s\\"\']+)`, "gi"));
const jsonRegexes = sensitiveKeys.map(key => new RegExp(`(\"${key}\"\\s*:\\s*)(\"[^\"]+\"|[^\\s,}]+)`, "gi"));

export function redactPii(value: string): string {
  let redacted = value;
  redacted = redacted.replace(emailRegex, "[REDACTED_EMAIL]");
  redacted = redacted.replace(phoneRegex, "[REDACTED_PHONE]");

  // Replace sensitive URL query params or JSON keys
  for (let i = 0; i < sensitiveKeys.length; i++) {
    redacted = redacted.replace(queryRegexes[i], `$1=[REDACTED]`);
    redacted = redacted.replace(jsonRegexes[i], `$1"[REDACTED]"`);
  }

  return redacted;
}

