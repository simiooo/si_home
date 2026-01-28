import { verifyToken } from "../utils/jwt.js";
import type { Context, Next, State } from "@oak/oak";

interface AuthState extends State {
  userId?: number;
  deviceId?: string;
}

export const authMiddleware = async (ctx: Context<AuthState>, next: Next) => {
  const authHeader = ctx.request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    ctx.response.status = 401;
    ctx.response.body = { error: "No token provided" };
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Invalid or expired token" };
    return;
  }

  ctx.state.userId = payload.userId;
  ctx.state.deviceId = payload.deviceId;

  await next();
};

export type { AuthState };

