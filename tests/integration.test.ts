import { test, after, beforeEach } from "node:test";
import assert from "node:assert";
import { prisma } from "../src/config/database.js";
import { AuthorRepository } from "../src/repositories/author.repository.js";
import { AuthorService } from "../src/services/author.service.js";
import { QuoteRepository } from "../src/repositories/quote.repository.js";
import { QuoteService } from "../src/services/quote.service.js";

const authorRepo = new AuthorRepository();
const authorService = new AuthorService(authorRepo);

const quoteRepo = new QuoteRepository();
const quoteService = new QuoteService(quoteRepo);

beforeEach(async () => {
  await prisma.quote.deleteMany();
  await prisma.author.deleteMany();
});

after(async () => {
  await prisma.$disconnect();
});

test("AuthorService - create and retrieve author", async () => {
  const record = await authorService.createAuthor({
    name: "Bjarne Stroustrup",
    email: "bjarne@stroustrup.com",
  });
  assert.strictEqual(record.name, "Bjarne Stroustrup");
  assert.strictEqual(record.email, "bjarne@stroustrup.com");
  assert.ok(record.id > 0);

  const list = await authorService.getAllAuthors();
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].name, "Bjarne Stroustrup");
});

test("AuthorService - duplicate author email/name check", async () => {
  await authorService.createAuthor({
    name: "Bjarne Stroustrup",
    email: "bjarne@stroustrup.com",
  });
  await assert.rejects(
    () => authorService.createAuthor({ name: "Bjarne Stroustrup", email: "other@stroustrup.com" }),
    /Author name or email already exists/
  );
});

test("QuoteService - create with Dynamic Author Resolution and retrieve", async () => {
  // 1. Create a quote with a completely new author name (should auto-create author)
  const quote1 = await quoteService.createQuote({
    text: "There are only two kinds of languages...",
    author_name: "Bjarne Stroustrup",
  });
  assert.strictEqual(quote1.text, "There are only two kinds of languages...");
  assert.ok(quote1.author_id > 0);

  // Verify author was dynamically created
  const record = await prisma.author.findUnique({ where: { id: quote1.author_id } });
  assert.ok(record);
  assert.strictEqual(record.name, "Bjarne Stroustrup");

  // 2. Create another quote with the SAME author name (should link to existing author)
  const quote2 = await quoteService.createQuote({
    text: "C++ makes it harder to shoot yourself in the foot...",
    author_name: "Bjarne Stroustrup",
  });
  assert.strictEqual(quote2.author_id, quote1.author_id);

  // 3. List all quotes (includes author)
  const quotes = await quoteService.getAllQuotes();
  assert.strictEqual(quotes.length, 2);
  assert.strictEqual(quotes[0].author.name, "Bjarne Stroustrup");
});

test("QuoteService - fetch by ID", async () => {
  const created = await quoteService.createQuote({
    text: "Simple is better than complex.",
    author_name: "Tim Peters",
  });

  const quote = await quoteService.getQuoteById(created.id);
  assert.ok(quote);
  assert.strictEqual(quote.text, "Simple is better than complex.");
  assert.strictEqual(quote.author.name, "Tim Peters");
});
