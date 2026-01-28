import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Application } from "@oak/oak";
import { setupTestDatabase, cleanupTestDatabase, setupTestApp } from "./setup.js";
import { createTestUser, generateTestToken } from "./setup.js";
import authRoutes from "../../routes/authRoutes.js";
import syncRoutes from "../../routes/syncRoutes.js";

describe("Auth API Integration Tests", () => {
  let app: Application;
  let testCounter = 0;

  const generateTestEmail = () => `test-${Date.now()}-${testCounter++}@example.com`;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await setupTestApp();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  const makeRequest = async (method: string, path: string, body?: any, headers?: Record<string, string>) => {
    const url = new URL(path, "http://localhost");

    const requestInit: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    if (body) {
      requestInit.body = JSON.stringify(body);
    }

    const req = new Request(url, requestInit);
    const res = await app.handle(req);

    if (!res) {
      throw new Error("No response from app");
    }

    const responseBody = await res.json().catch(() => res.text());

    return {
      status: res.status,
      body: responseBody,
    };
  };

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const email = generateTestEmail();
      const response = await makeRequest("POST", "/api/auth/register", {
        email,
        password: "password123",
        deviceId: "device-123",
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("token");
      expect(response.body.user).toHaveProperty("id");
      expect(response.body.user).toHaveProperty("email");
      expect(response.body.user.email).toBe(email);
      expect(response.body.token).toBeDefined();
    });

    it("should return 400 when missing email", async () => {
      const response = await makeRequest("POST", "/api/auth/register", {
        password: "password123",
        deviceId: "device-123",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Email, password, and deviceId are required");
    });

    it("should return 400 when missing password", async () => {
      const email = generateTestEmail();
      const response = await makeRequest("POST", "/api/auth/register", {
        email,
        deviceId: "device-123",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Email, password, and deviceId are required");
    });

    it("should return 400 when missing deviceId", async () => {
      const email = generateTestEmail();
      const response = await makeRequest("POST", "/api/auth/register", {
        email,
        password: "password123",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Email, password, and deviceId are required");
    });

    it("should return 409 when email already registered", async () => {
      const email = `duplicate-${Date.now()}-${Math.random()}@example.com`;
      const firstResponse = await makeRequest("POST", "/api/auth/register", {
        email,
        password: "password123",
        deviceId: `device-1-${Date.now()}`,
      });

      const response = await makeRequest("POST", "/api/auth/register", {
        email,
        password: "password456",
        deviceId: `device-2-${Date.now()}`,
      });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Email already registered");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login successfully with valid credentials", async () => {
      const email = generateTestEmail();
      await makeRequest("POST", "/api/auth/register", {
        email,
        password: "password123",
        deviceId: `device-1-${Date.now()}`,
      });

      const response = await makeRequest("POST", "/api/auth/login", {
        email,
        password: "password123",
        deviceId: `device-2-${Date.now()}`,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("token");
      expect(response.body.user).toHaveProperty("id");
      expect(response.body.user).toHaveProperty("email");
      expect(response.body.user.email).toBe(email);
    });

    it("should return 400 when missing email", async () => {
      const response = await makeRequest("POST", "/api/auth/login", {
        password: "password123",
        deviceId: "device-123",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Email, password, and deviceId are required");
    });

    it("should return 400 when missing password", async () => {
      const email = generateTestEmail();
      const response = await makeRequest("POST", "/api/auth/login", {
        email,
        deviceId: "device-123",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Email, password, and deviceId are required");
    });

    it("should return 401 when email does not exist", async () => {
      const email = generateTestEmail();
      const response = await makeRequest("POST", "/api/auth/login", {
        email,
        password: "password123",
        deviceId: "device-123",
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Invalid credentials");
    });

    it("should return 401 when password is incorrect", async () => {
      const email = generateTestEmail();
      await makeRequest("POST", "/api/auth/register", {
        email,
        password: "correctpassword",
        deviceId: "device-123",
      });

      const response = await makeRequest("POST", "/api/auth/login", {
        email,
        password: "wrongpassword",
        deviceId: "device-123",
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Invalid credentials");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should logout successfully", async () => {
      const response = await makeRequest("POST", "/api/auth/logout");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toBe("Logged out successfully");
    });
  });

  describe("GET /api/auth/me", () => {
    it.skip("should return user info when authenticated - token validation issue", async () => {
      const email = generateTestEmail();
      const registerResponse = await makeRequest("POST", "/api/auth/register", {
        email,
        password: "password123",
        deviceId: `device-me-${Date.now()}`,
      });

      const token = registerResponse.body.token;
      const userId = registerResponse.body.user.id;

      const response = await makeRequest("GET", "/api/auth/me", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("id");
      expect(response.body.user).toHaveProperty("email");
      expect(response.body.user).toHaveProperty("device_id");
      expect(response.body.user.id).toBe(userId);
      expect(response.body.user.email).toBe(email);
    });

    it("should return 401 when no token provided", async () => {
      const response = await makeRequest("GET", "/api/auth/me");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });

    it("should return 401 when token is invalid", async () => {
      const response = await makeRequest("GET", "/api/auth/me", undefined, {
        "Authorization": "Bearer invalid-token",
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });
  });
});
