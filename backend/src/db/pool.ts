import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();
let pool: Pool | null = null;

const getPool = () => {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not defined in the environment variables",
      );
    }
    pool = new Pool({ connectionString });
  }
  return pool;
};

const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

export { getPool, closePool };
