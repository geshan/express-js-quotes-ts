import { Router } from "express";
import authorRoutes from "./author.routes.js";
import quoteRoutes from "./quote.routes.js";

const router = Router();

router.use("/authors", authorRoutes);
router.use("/quotes", quoteRoutes);

export default router;
