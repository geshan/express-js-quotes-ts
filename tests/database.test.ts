import { test, after } from "node:test";
import assert from "node:assert";
import { prisma } from "../src/config/database.ts";

after(async () => {
  await prisma.$disconnect();
});

test("Database connectivity test", async () => {
  try {
    await prisma.$connect();
    assert.ok(true, "Database successfully connected!");
  } catch (err) {
    assert.fail("Failed to connect to the database: " + err);
  }
});
