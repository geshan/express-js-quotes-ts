import { test, after, beforeEach } from "node:test";
import assert from "node:assert";
import { prisma } from "../src/config/database.ts";
import { AuthorRepository } from "../src/repositories/author.repository.ts";
import { AuthorService } from "../src/services/author.service.ts";

const repo = new AuthorRepository();
const service = new AuthorService(repo);

beforeEach(async () => {
  await prisma.quote.deleteMany();
  await prisma.author.deleteMany();
});

after(async () => {
  await prisma.$disconnect();
});

test("AuthorService - create and retrieve author", async () => {
  const record = await service.createAuthor({ name: "Bjarne Stroustrup", email: "bjarne@stroustrup.com" });
  assert.strictEqual(record.name, "Bjarne Stroustrup");
  assert.strictEqual(record.email, "bjarne@stroustrup.com");
  assert.ok(record.id > 0);

  const list = await service.getAllAuthors();
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].name, "Bjarne Stroustrup");
});

test("AuthorService - duplicate author email/name check", async () => {
  await service.createAuthor({ name: "Bjarne Stroustrup", email: "bjarne@stroustrup.com" });
  await assert.rejects(
    () => service.createAuthor({ name: "Bjarne Stroustrup", email: "other@stroustrup.com" }),
    /Author name or email already exists/
  );
});
