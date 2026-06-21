import { QuoteRepository } from "../repositories/quote.repository.js";
import { quote } from "@prisma/client";

export class QuoteService {
  constructor(private quoteRepository: QuoteRepository) {}

  async createQuote(data: { text: string; author_name: string }): Promise<quote> {
    if (!data.text || data.text.trim() === "") {
      throw new Error("Quote text is required");
    }
    if (!data.author_name || data.author_name.trim() === "") {
      throw new Error("Author name is required");
    }

    return this.quoteRepository.createWithDynamicAuthor(
      data.text.trim(),
      data.author_name.trim()
    );
  }

  async getAllQuotes() {
    return this.quoteRepository.findAll();
  }

  async getQuoteById(id: number) {
    const quote = await this.quoteRepository.findById(id);
    if (!quote) {
      throw new Error("Quote not found");
    }
    return quote;
  }
}
