import { Router } from "express";
import { AuthorRepository } from "../repositories/author.repository.js";
import { AuthorService } from "../services/author.service.js";
import { AuthorController } from "../controllers/author.controller.js";

const router = Router();
const repo = new AuthorRepository();
const service = new AuthorService(repo);
const controller = new AuthorController(service);

router.get("/", controller.getAll);
router.post("/", controller.create);

export default router;
