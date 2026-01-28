import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Application } from "@oak/oak";
import { setupTestDatabase, cleanupTestDatabase, setupTestApp, createTestUser, generateTestToken } from "./setup.js";

describe("Error Handling Integration Tests", () => {
  let app: Application;
  let user: any;
  let token: string;
  let deviceId: string;
  let testCounter = 0;

  const generateTestEmail = () => `error-${Date.now()}-${testCounter++}@example.com`;
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

  describe("Invalid input validation", () => {
    it("should handle invalid email format", async () => {
      const response = await makeRequest("POST", "/api/auth/register", {
        email: "invalid-email",
        password: "password123",
        deviceId: "device-123",
      });

      expect(response.status).toBe(500);
    });

    it("should handle very short password", async () => {
      const response = await makeRequest("POST", "/api/auth/register", {
        email: generateTestEmail(),
        password: "123",
        deviceId: "device-123",
      });

      expect(response.status).toBe(200);
    });
  });

  describe("Missing required fields", () => {
    it("should handle missing email in register", async () => {
      const response = await makeRequest("POST", "/api/auth/register", {
        password: "password123",
        deviceId: "device-123",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Email, password, and deviceId are required");
    });

    it("should handle missing password in register", async () => {
      const response = await makeRequest("POST", "/api/auth/register", {
        email: generateTestEmail(),
        deviceId: "device-123",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Email, password, and deviceId are required");
    });

    it("should handle missing deviceId in register", async () => {
      const response = await makeRequest("POST", "/api/auth/register", {
        email: generateTestEmail(),
        password: "password123",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Email, password, and deviceId are required");
    });

    it("should handle missing tabs array in sync", async () => {
      const response = await makeRequest("POST", "/api/sync/tabs", {}, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(500);
    });

    it("should handle missing collections array in sync", async () => {
      const response = await makeRequest("POST", "/api/sync/collections", {}, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(500);
    });

    it("should handle missing collectionId in collection-tabs sync", async () => {
      const response = await makeRequest("POST", "/api/sync/collection-tabs", {
        tabs: [],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("CollectionId and tabs array are required");
    });

    it("should handle missing tabs array in collection-tabs sync", async () => {
      const response = await makeRequest("POST", "/api/sync/collection-tabs", {
        collectionId: "collection-1",
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("CollectionId and tabs array are required");
    });

    it("should handle missing config in config sync", async () => {
      const response = await makeRequest("POST", "/api/sync/config", {}, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Config is required");
    });

    it("should handle missing collectionId in delete collection", async () => {
      const response = await makeRequest("DELETE", "/api/sync/collection", {}, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("CollectionId is required");
    });
  });

  describe("Invalid data types", () => {
    it("should handle non-array tabs", async () => {
      const response = await makeRequest("POST", "/api/sync/tabs", {
        tabs: "not-an-array",
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Tabs must be an array");
    });

    it("should handle non-array collections", async () => {
      const response = await makeRequest("POST", "/api/sync/collections", {
        collections: "not-an-array",
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Collections must be an array");
    });

    it("should handle non-array collection-tabs", async () => {
      await makeRequest("POST", "/api/sync/collections", {
        collections: [
          {
            collectionId: "collection-1",
            title: "Work",
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const response = await makeRequest("POST", "/api/sync/collection-tabs", {
        collectionId: "collection-1",
        tabs: "not-an-array",
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("CollectionId and tabs array are required");
    });
  });

  describe("Resource not found errors", () => {
    it("should handle getting user info for non-existent user", async () => {
      const invalidToken = generateTestToken(999999, deviceId);
      const response = await makeRequest("GET", "/api/auth/me", undefined, {
        "Authorization": `Bearer ${invalidToken}`,
      });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });

    it("should handle deleting non-existent collection", async () => {
      const response = await makeRequest("DELETE", "/api/sync/collection", {
        collectionId: "non-existent",
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Collection not found");
    });

    it("should handle syncing tabs to non-existent collection", async () => {
      const response = await makeRequest("POST", "/api/sync/collection-tabs", {
        collectionId: "non-existent",
        tabs: [],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Collection not found");
    });
  });

  describe("Duplicate resource errors", () => {
    it("should handle registering with existing email", async () => {
      const email = generateTestEmail();
      await makeRequest("POST", "/api/auth/register", {
        email,
        password: "password123",
        deviceId: "device-1",
      });

      const response = await makeRequest("POST", "/api/auth/register", {
        email,
        password: "password456",
        deviceId: "device-2",
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Email already registered");
    });
  });

  describe("Authentication errors", () => {
    it("should handle login with wrong password", async () => {
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
      expect(response.body.error).toBe("Invalid credentials");
    });

    it("should handle login with non-existent email", async () => {
      const response = await makeRequest("POST", "/api/auth/login", {
        email: "nonexistent@example.com",
        password: "password123",
        deviceId: "device-123",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid credentials");
    });
  });

  describe("Authorization errors", () => {
    it("should handle accessing protected endpoint without token", async () => {
      const response = await makeRequest("GET", "/api/sync");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("No token provided");
    });

    it("should handle accessing protected endpoint with invalid token", async () => {
      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": "Bearer invalid-token",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid or expired token");
    });
  });

  describe("Missing properties in data objects", () => {
    it("should handle tab missing required properties", async () => {
      const response = await makeRequest("POST", "/api/sync/tabs", {
        tabs: [
          {
            tabId: "tab-1",
          } as any,
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(500);
    });

    it("should handle collection missing title", async () => {
      const response = await makeRequest("POST", "/api/sync/collections", {
        collections: [
          {
            collectionId: "collection-1",
          } as any,
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(500);
    });

    it("should handle collection-tab missing required properties", async () => {
      await makeRequest("POST", "/api/sync/collections", {
        collections: [
          {
            collectionId: "collection-1",
            title: "Work",
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const response = await makeRequest("POST", "/api/sync/collection-tabs", {
        collectionId: "collection-1",
        tabs: [
          {
            tabId: "tab-1",
          } as any,
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(500);
    });
  });

  describe("HTTP method validation", () => {
    it("should handle GET on POST endpoint", async () => {
      const req = new Request(new URL("http://localhost/api/sync/tabs"), {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      const res = await app.handle(req);

      if (!res) {
        throw new Error("No response from app");
      }

      expect(res.status).toBe(404);
    });

    it("should handle POST on DELETE endpoint", async () => {
      const response = await makeRequest("POST", "/api/sync/collection", {
        collectionId: "collection-1",
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(405);
    });
  });

  describe("Unknown routes", () => {
    it("should handle request to non-existent route", async () => {
      const req = new Request(new URL("http://localhost/api/nonexistent"), {
        method: "GET",
      });

      const res = await app.handle(req);

      if (!res) {
        throw new Error("No response from app");
      }

      expect(res.status).toBe(404);
    });

    it("should handle request with invalid method", async () => {
      const req = new Request(new URL("http://localhost/api/auth/register"), {
        method: "PATCH",
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
          deviceId: "device-123",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const res = await app.handle(req);

      if (!res) {
        throw new Error("No response from app");
      }

      expect(res.status).toBe(404);
    });
  });
});
