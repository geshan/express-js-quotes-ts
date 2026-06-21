import { Request, Response } from "express";
import { AuthorService } from "../services/author.service.js";

export class AuthorController {
  constructor(private authorService: AuthorService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, email } = req.body;
      const result = await this.authorService.createAuthor({ name, email });
      res.status(201).json(result);
    } catch (err: any) {
      if (err.message === "Author name or email already exists") {
        res.status(409).json({ error: err.message });
      } else {
        res.status(400).json({ error: err.message });
      }
    }
  };

  getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const authors = await this.authorService.getAllAuthors();
      res.status(200).json(authors);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
}
