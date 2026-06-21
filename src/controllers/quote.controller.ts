import { Request, Response } from "express";
import { QuoteService } from "../services/quote.service.js";

export class QuoteController {
  constructor(private quoteService: QuoteService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const { text, author_name } = req.body;
      const result = await this.quoteService.createQuote({ text, author_name });
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  };

  getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const quotes = await this.quoteService.getAllQuotes();
      res.status(200).json(quotes);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID parameter" });
        return;
      }
      const quote = await this.quoteService.getQuoteById(id);
      res.status(200).json(quote);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  };
}
