import { AuthorRepository } from "../repositories/author.repository.js";
import { author } from "@prisma/client";

export class AuthorService {
  constructor(private authorRepository: AuthorRepository) {}

  async createAuthor(data: { name: string; email?: string }): Promise<author> {
    if (!data.name || data.name.trim() === "") {
      throw new Error("Author name is required");
    }

    const existingByName = await this.authorRepository.findByName(data.name);
    if (existingByName) {
      throw new Error("Author name or email already exists");
    }

    if (data.email) {
      const existingByEmail = await this.authorRepository.findByEmail(data.email);
      if (existingByEmail) {
        throw new Error("Author name or email already exists");
      }
    }

    return this.authorRepository.create({
      name: data.name.trim(),
      email: data.email?.trim() || undefined,
    });
  }

  async getAllAuthors(): Promise<author[]> {
    return this.authorRepository.findAll();
  }
}
