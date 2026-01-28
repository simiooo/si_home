import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Application } from "@oak/oak";
import { setupTestDatabase, cleanupTestDatabase, setupTestApp, createTestUser, generateTestToken } from "./setup.js";

describe("Sync API Integration Tests", () => {
  let app: Application;
  let user: any;
  let token: string;
  let deviceId: string;
  let testCounter = 0;

  const generateTestEmail = () => `syncuser-${Date.now()}-${testCounter++}@example.com`;
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

  describe("GET /api/sync", () => {
    it("should get all data successfully", async () => {
      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("tabs");
      expect(response.body).toHaveProperty("collections");
      expect(response.body).toHaveProperty("collectionTabs");
      expect(response.body).toHaveProperty("config");
      expect(response.body).toHaveProperty("lastSync");
      expect(Array.isArray(response.body.tabs)).toBe(true);
      expect(Array.isArray(response.body.collections)).toBe(true);
      expect(typeof response.body.collectionTabs).toBe("object");
    });

    it("should return 401 when no token provided", async () => {
      const response = await makeRequest("GET", "/api/sync");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });

    it("should return 401 when token is invalid", async () => {
      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": "Bearer invalid-token",
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("POST /api/sync/tabs", () => {
    it("should sync tabs successfully", async () => {
      const tabs = [
        {
          tabId: "tab-1",
          title: "Google",
          url: "https://www.google.com",
          favicon: "https://www.google.com/favicon.ico",
        },
        {
          tabId: "tab-2",
          title: "GitHub",
          url: "https://github.com",
          favicon: "https://github.com/favicon.ico",
        },
      ];

      const response = await makeRequest("POST", "/api/sync/tabs", { tabs }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toBe("Tabs synced successfully");

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(getResponse.body.tabs.length).toBe(2);
    });

    it("should return 400 when tabs is not an array", async () => {
      const response = await makeRequest("POST", "/api/sync/tabs", { tabs: "not-an-array" }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Tabs must be an array");
    });

    it("should return 401 when no token provided", async () => {
      const response = await makeRequest("POST", "/api/sync/tabs", { tabs: [] });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("POST /api/sync/collections", () => {
    it("should sync collections successfully", async () => {
      const collections = [
        {
          collectionId: "collection-1",
          title: "Work",
        },
        {
          collectionId: "collection-2",
          title: "Personal",
        },
      ];

      const response = await makeRequest("POST", "/api/sync/collections", { collections }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toBe("Collections synced successfully");

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(getResponse.body.collections.length).toBe(2);
    });

    it("should return 400 when collections is not an array", async () => {
      const response = await makeRequest("POST", "/api/sync/collections", { collections: "not-an-array" }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Collections must be an array");
    });

    it("should return 401 when no token provided", async () => {
      const response = await makeRequest("POST", "/api/sync/collections", { collections: [] });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("POST /api/sync/collection-tabs", () => {
    beforeEach(async () => {
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
    });

    it("should sync collection tabs successfully", async () => {
      const tabs = [
        {
          tabId: "tab-1",
          title: "Google",
          url: "https://www.google.com",
          favicon: "https://www.google.com/favicon.ico",
          sortOrder: 0,
        },
        {
          tabId: "tab-2",
          title: "GitHub",
          url: "https://github.com",
          favicon: "https://github.com/favicon.ico",
          sortOrder: 1,
        },
      ];

      const response = await makeRequest("POST", "/api/sync/collection-tabs", {
        collectionId: "collection-1",
        tabs,
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toBe("Collection tabs synced successfully");

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(getResponse.body.collectionTabs["collection-1"].length).toBe(2);
    });

    it("should return 400 when collectionId is missing", async () => {
      const response = await makeRequest("POST", "/api/sync/collection-tabs", {
        tabs: [],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("CollectionId and tabs array are required");
    });

    it("should return 400 when tabs is not an array", async () => {
      const response = await makeRequest("POST", "/api/sync/collection-tabs", {
        collectionId: "collection-1",
        tabs: "not-an-array",
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("CollectionId and tabs array are required");
    });

    it("should return 404 when collection does not exist", async () => {
      const response = await makeRequest("POST", "/api/sync/collection-tabs", {
        collectionId: "non-existent-collection",
        tabs: [],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Collection not found");
    });
  });

  describe("POST /api/sync/config", () => {
    it("should sync config successfully", async () => {
      const config = {
        theme: "dark",
        language: "en",
      };

      const response = await makeRequest("POST", "/api/sync/config", { config }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toBe("Config synced successfully");

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(getResponse.body.config).toEqual(config);
    });

    it("should return 400 when config is missing", async () => {
      const response = await makeRequest("POST", "/api/sync/config", {}, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Config is required");
    });

    it("should return 401 when no token provided", async () => {
      const response = await makeRequest("POST", "/api/sync/config", { config: {} });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("DELETE /api/sync/collection", () => {
    beforeEach(async () => {
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
    });

    it("should delete collection successfully", async () => {
      const response = await makeRequest("DELETE", "/api/sync/collection", {
        collectionId: "collection-1",
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toBe("Collection deleted successfully");

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(getResponse.body.collections.length).toBe(0);
    });

    it("should return 400 when collectionId is missing", async () => {
      const response = await makeRequest("DELETE", "/api/sync/collection", {}, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("CollectionId is required");
    });

    it("should return 404 when collection does not exist", async () => {
      const response = await makeRequest("DELETE", "/api/sync/collection", {
        collectionId: "non-existent-collection",
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Collection not found");
    });

    it("should return 401 when no token provided", async () => {
      const response = await makeRequest("DELETE", "/api/sync/collection", {
        collectionId: "collection-1",
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });
  });
});
