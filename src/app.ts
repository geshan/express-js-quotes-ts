import express from "express";
import cors from "cors";
import apiRouter from "./routes/index.js";

const app = express();

app.use(cors());
app.use(express.json());

// API router mount
app.use("/api", apiRouter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

export default app;
