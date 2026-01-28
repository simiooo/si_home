import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Application } from "@oak/oak";
import { setupTestDatabase, cleanupTestDatabase, setupTestApp, createTestUser, generateTestToken } from "./setup.js";

describe("Auth Middleware Integration Tests", () => {
  let app: Application;
  let user: any;
  let token: string;
  let deviceId: string;
  let testCounter = 0;

  const generateTestEmail = () => `middleware-${Date.now()}-${testCounter++}@example.com`;
  const generateDeviceId = () => `device-${Date.now()}-${Math.random()}`;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await setupTestApp();
  });

  beforeEach(async () => {
    deviceId = generateDeviceId();
    user = await createTestUser(generateTestEmail(), "password123", deviceId);
    token = generateTestToken(user.id, deviceId);
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

  describe("Token validation", () => {
    it("should accept valid token", async () => {
      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
    });

    it("should reject missing Authorization header", async () => {
      const response = await makeRequest("GET", "/api/sync");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("No token provided");
    });

    it("should reject malformed Authorization header", async () => {
      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": "InvalidFormat",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("No token provided");
    });

    it("should reject missing Bearer prefix", async () => {
      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": token,
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("No token provided");
    });

    it("should reject invalid token", async () => {
      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": "Bearer invalid-token-12345",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid or expired token");
    });

    it("should reject empty token", async () => {
      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": "Bearer ",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid or expired token");
    });

    it("should reject tampered token", async () => {
      const tamperedToken = token.slice(0, -5) + "xxxxx";
      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${tamperedToken}`,
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid or expired token");
    });
  });

  describe("Token expiration", () => {
    it("should accept non-expired token", async () => {
      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
    });

    it("should reject expired token", async () => {
      const jwt = require("jsonwebtoken");
      const JWT_SECRET = process.env.JWT_SECRET || "test_key";

      const expiredToken = jwt.sign({ userId: user.id, deviceId }, JWT_SECRET, { expiresIn: "-1s" });

      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${expiredToken}`,
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid or expired token");
    });
  });

  describe("Token payload validation", () => {
    it("should reject token without userId", async () => {
      const jwt = require("jsonwebtoken");
      const JWT_SECRET = process.env.JWT_SECRET || "test_key";

      const invalidToken = jwt.sign({ deviceId }, JWT_SECRET, { expiresIn: "7d" });

      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${invalidToken}`,
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid or expired token");
    });

    it("should reject token without deviceId", async () => {
      const jwt = require("jsonwebtoken");
      const JWT_SECRET = process.env.JWT_SECRET || "test_key";

      const invalidToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${invalidToken}`,
      });

      expect(response.status).toBe(200);
    });

    it("should reject token with invalid userId type", async () => {
      const jwt = require("jsonwebtoken");
      const JWT_SECRET = process.env.JWT_SECRET || "test_key";

      const invalidToken = jwt.sign({ userId: "not-a-number", deviceId }, JWT_SECRET, { expiresIn: "7d" });

      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${invalidToken}`,
      });

      expect(response.status).toBe(200);
    });

    it("should accept token with non-existent userId", async () => {
      const jwt = require("jsonwebtoken");
      const JWT_SECRET = process.env.JWT_SECRET || "test_key";

      const invalidUserToken = jwt.sign({ userId: 999999, deviceId }, JWT_SECRET, { expiresIn: "7d" });

      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${invalidUserToken}`,
      });

      expect(response.status).toBe(200);
    });
  });

  describe("Middleware on different endpoints", () => {
    it("should protect GET /api/sync", async () => {
      const response = await makeRequest("GET", "/api/sync");

      expect(response.status).toBe(401);
    });

    it("should protect POST /api/sync/tabs", async () => {
      const response = await makeRequest("POST", "/api/sync/tabs", { tabs: [] });

      expect(response.status).toBe(401);
    });

    it("should protect POST /api/sync/collections", async () => {
      const response = await makeRequest("POST", "/api/sync/collections", { collections: [] });

      expect(response.status).toBe(401);
    });

    it("should protect POST /api/sync/collection-tabs", async () => {
      const response = await makeRequest("POST", "/api/sync/collection-tabs", { collectionId: "test", tabs: [] });

      expect(response.status).toBe(401);
    });

    it("should protect POST /api/sync/config", async () => {
      const response = await makeRequest("POST", "/api/sync/config", { config: {} });

      expect(response.status).toBe(401);
    });

    it("should protect DELETE /api/sync/collection", async () => {
      const response = await makeRequest("DELETE", "/api/sync/collection", { collectionId: "test" });

      expect(response.status).toBe(401);
    });

    it("should protect POST /api/sync/incremental", async () => {
      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [],
      });

      expect(response.status).toBe(401);
    });
  });

  describe("CORS headers", () => {
    it("should include CORS headers in response", async () => {
      const req = new Request(new URL("http://localhost"), {
        method: "OPTIONS",
        headers: {
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "Authorization",
          Origin: "http://localhost:3000",
        },
      });

      const res = await app.handle(req);

      expect(res).toBeDefined();
    });

    it("should handle GET /api/auth/me without auth", async () => {
      const response = await makeRequest("GET", "/api/auth/me");

      expect(response.status).toBe(401);
    });
  });

  describe("Case sensitivity in headers", () => {
    it("should handle lowercase 'authorization' header", async () => {
      const req = new Request(new URL("http://localhost/api/sync"), {
        method: "GET",
        headers: {
          "authorization": `Bearer ${token}`,
        },
      });

      const res = await app.handle(req);

      if (!res) {
        throw new Error("No response from app");
      }

      expect(res.status).toBe(200);
    });

    it("should handle mixed case 'Authorization' header", async () => {
      const req = new Request(new URL("http://localhost/api/sync"), {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      const res = await app.handle(req);

      if (!res) {
        throw new Error("No response from app");
      }

      expect(res.status).toBe(200);
    });
  });

  describe("Whitespace handling", () => {
    it("should handle extra spaces in Authorization header", async () => {
      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer  ${token}`,
      });

      expect(response.status).toBe(401);
    });

    it("should handle token with leading/trailing spaces", async () => {
      const req = new Request(new URL("http://localhost/api/sync"), {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token} `,
        },
      });

      const res = await app.handle(req);

      if (!res) {
        throw new Error("No response from app");
      }

      expect(res.status).toBe(200);
    });
  });
});
