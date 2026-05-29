import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./config/supabase";
import apiRouter from "./routes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", apiRouter);

app.get("/health", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .limit(1);

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    return res.json({
      success: true,
      message: "Supabase connected",
      data,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Connection failed",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
