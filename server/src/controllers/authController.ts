import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { generateToken } from "../utils/jwt.js";
import type { RouterContext } from "@oak/oak";
import type { AuthState } from "../middleware/authMiddleware.js";

export const register = async (ctx: RouterContext<string, AuthState>) => {
  const { email, password, deviceId } = await ctx.request.body.json();

  if (!email || !password || !deviceId) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Email, password, and deviceId are required" };
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      "INSERT INTO users (email, password_hash, device_id) VALUES ($1, $2, $3) RETURNING id, email, device_id",
      [email, passwordHash, deviceId]
    );

    const user = result.rows[0];
    const token = generateToken({ userId: user.id, deviceId: user.device_id });

    ctx.response.body = {
      user: { id: user.id, email: user.email },
      token,
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      ctx.response.status = 409;
      ctx.response.body = { error: "Email already registered" };
    } else {
      ctx.response.status = 500;
      ctx.response.body = { error: "Internal server error" };
    }
  }
};

export const login = async (ctx: RouterContext<string, AuthState>) => {
  const { email, password, deviceId } = await ctx.request.body.json();

  if (!email || !password || !deviceId) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Email, password, and deviceId are required" };
    return;
  }

  try {
    const result = await db.query(
      "SELECT id, email, password_hash FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Invalid credentials" };
      return;
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Invalid credentials" };
      return;
    }

    await db.query("UPDATE users SET device_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [
      deviceId,
      user.id,
    ]);

    const token = generateToken({ userId: user.id, deviceId });

    ctx.response.body = {
      user: { id: user.id, email: user.email },
      token,
    };
  } catch {
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
};

export const logout = async (ctx: RouterContext<string, AuthState>) => {
  ctx.response.body = { message: "Logged out successfully" };
};

export const me = async (ctx: RouterContext<string, AuthState>) => {
  const userId = ctx.state.userId;

  if (!userId) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Unauthorized" };
    return;
  }

  try {
    const result = await db.query("SELECT id, email, device_id FROM users WHERE id = $1", [userId]);

    if (result.rows.length === 0) {
      ctx.response.status = 404;
      ctx.response.body = { error: "User not found" };
      return;
    }

    ctx.response.body = { user: result.rows[0] };
  } catch {
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
};
