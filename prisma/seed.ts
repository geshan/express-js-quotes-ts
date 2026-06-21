import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean database before seeding
  await prisma.quote.deleteMany();
  await prisma.author.deleteMany();

  // Create authors & quotes dynamically in single calls
  await prisma.quote.create({
    data: {
      text: "There are only two kinds of languages: the ones people complain about and the ones nobody uses.",
      author: {
        create: {
          name: "Bjarne Stroustrup",
          email: "bjarne@stroustrup.com",
        },
      },
    },
  });

  await prisma.quote.create({
    data: {
      text: "Simple is better than complex.",
      author: {
        create: {
          name: "Tim Peters",
          email: "tim@python.org",
        },
      },
    },
  });

  console.log("Database successfully seeded!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
