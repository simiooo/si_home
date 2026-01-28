import "dotenv/config";
import { Pool } from "pg";
import { Application } from "@oak/oak";
import authRoutes from "../../routes/authRoutes.js";
import syncRoutes from "../../routes/syncRoutes.js";
import { initDatabase } from "../../db.js";

const TEST_DB_URL = "postgresql://sihome:sihome123@localhost:5434/sihome";
const JWT_SECRET = process.env.JWT_SECRET || "test_key";

let testApp: Application;
let testPool: Pool;

export const setupTestApp = async () => {
  testPool = new Pool({ connectionString: TEST_DB_URL });

  const app = new Application();

  app.use(async (ctx, next) => {
    ctx.response.headers.set("Access-Control-Allow-Origin", "*");
    ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (ctx.request.method === "OPTIONS") {
      ctx.response.status = 200;
      return;
    }

    await next();
  });

  app.use(authRoutes.routes());
  app.use(authRoutes.allowedMethods());

  app.use(syncRoutes.routes());
  app.use(syncRoutes.allowedMethods());

  app.use((ctx) => {
    ctx.response.body = { message: "Si Home Server API" };
  });

  testApp = app;

  return app;
};

let counter = 0;

const generateId = () => {
  counter++;
  return `test-${Date.now()}-${counter}`;
};

export const setupTestDatabase = async () => {
  const pool = new Pool({ connectionString: TEST_DB_URL });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM sync_log");
    await client.query("DELETE FROM client_sync");
    await client.query("DELETE FROM collection_tabs");
    await client.query("DELETE FROM collections");
    await client.query("DELETE FROM configs");
    await client.query("DELETE FROM tabs");
    await client.query("DELETE FROM users");

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

export const cleanupTestDatabase = async () => {
  const pool = new Pool({ connectionString: TEST_DB_URL });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM sync_log");
    await client.query("DELETE FROM client_sync");
    await client.query("DELETE FROM collection_tabs");
    await client.query("DELETE FROM collections");
    await client.query("DELETE FROM configs");
    await client.query("DELETE FROM tabs");
    await client.query("DELETE FROM users");

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

export const getTestApp = () => testApp;

export const createTestUser = async (email: string, password: string, deviceId?: string) => {
  const pool = new Pool({ connectionString: TEST_DB_URL });

  const client = await pool.connect();

  try {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 10);
    const actualDeviceId = deviceId || generateId();

    const result = await client.query(
      "INSERT INTO users (email, password_hash, device_id) VALUES ($1, $2, $3) RETURNING id, email, device_id",
      [email, passwordHash, actualDeviceId]
    );

    return result.rows[0];
  } finally {
    client.release();
    await pool.end();
  }
};

export const generateTestToken = (userId: number, deviceId: string): string => {
  const jwt = require("jsonwebtoken");

  return jwt.sign({ userId, deviceId }, JWT_SECRET, { expiresIn: "7d" });
};
