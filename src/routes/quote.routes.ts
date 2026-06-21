import { Router } from "express";
import { QuoteRepository } from "../repositories/quote.repository.js";
import { QuoteService } from "../services/quote.service.js";
import { QuoteController } from "../controllers/quote.controller.js";

const router = Router();
const repo = new QuoteRepository();
const service = new QuoteService(repo);
const controller = new QuoteController(service);

router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.post("/", controller.create);

export default router;
