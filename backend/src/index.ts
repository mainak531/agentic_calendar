import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import {getPool} from "./db/pool.js"
import { connectionRouter } from "./routes/connection.routes.js";
import { agentRoutes } from "./routes/agent.routes.js";

dotenv.config();
const PORT = process.env.PORT || 4001;
const APP_ORIGIN = process.env.APP_URL || "http://localhost:3000";

const app = express();

app.use(
  cors({
    origin: APP_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
app.use(express.json());

app.get("/health", async (req, res) => { 
  try {
    await getPool().query("SELECT 1"); 
    res.json({
      status: "success",
      message: "Server is running",
      code: 200,
    });
  } catch (error) {
    console.error("Error in GET /:", error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      code: 500,
    });
  }
});

app.use("/api/connections", connectionRouter);
app.use("/api/agent", agentRoutes);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
