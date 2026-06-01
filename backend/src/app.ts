import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db } from "./config/database";
import apiRouter from "./routes";
import {
  errorMiddleware,
  notFoundMiddleware,
} from "./middleware/error.middleware";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 AS status");

    return res.json({
      success: true,
      message: "MySQL đã kết nối",
      data: rows,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "MySQL kết nối thất bại.",
    });
  }
});

app.use("/api", apiRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server đang chạy trên ${PORT}`);
});