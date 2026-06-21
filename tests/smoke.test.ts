import { test } from "node:test";
import assert from "node:assert";

test("Smoke Test: TypeScript environment verification", () => {
  const greeting: string = "Hello, TypeScript!";
  assert.strictEqual(greeting, "Hello, TypeScript!");
});
