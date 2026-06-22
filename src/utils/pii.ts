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
