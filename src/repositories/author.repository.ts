import { prisma } from "../config/database.js";
import { author } from "@prisma/client";

export class AuthorRepository {
  async create(data: { name: string; email?: string }): Promise<author> {
    return prisma.author.create({
      data,
    });
  }

  async findAll(): Promise<author[]> {
    return prisma.author.findMany({
      orderBy: { name: "asc" },
    });
  }

  async findByName(name: string): Promise<author | null> {
    return prisma.author.findUnique({
      where: { name },
    });
  }

  async findByEmail(email: string): Promise<author | null> {
    return prisma.author.findUnique({
      where: { email },
    });
  }
}
