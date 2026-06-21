import { prisma } from "../config/database.js";
import { quote } from "@prisma/client";

export type QuoteWithAuthor = quote & {
  author: {
    id: number;
    name: string;
    email: string | null;
  };
};

export class QuoteRepository {
  async createWithDynamicAuthor(text: string, author_name: string): Promise<quote> {
    return prisma.quote.create({
      data: {
        text,
        author: {
          connectOrCreate: {
            where: { name: author_name },
            create: { name: author_name },
          },
        },
      },
    });
  }

  async findAll(): Promise<QuoteWithAuthor[]> {
    return prisma.quote.findMany({
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    }) as Promise<QuoteWithAuthor[]>;
  }

  async findById(id: number): Promise<QuoteWithAuthor | null> {
    return prisma.quote.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }) as Promise<QuoteWithAuthor | null>;
  }
}
