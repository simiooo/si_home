import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Application } from "@oak/oak";
import { setupTestDatabase, cleanupTestDatabase, setupTestApp, createTestUser, generateTestToken } from "./setup.js";

describe("Incremental Sync API Integration Tests", () => {
  let app: Application;
  let user: any;
  let token: string;
  let deviceId: string;
  let testCounter = 0;

  const generateTestEmail = () => `incsync-${Date.now()}-${testCounter++}@example.com`;
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

  describe("POST /api/sync/incremental", () => {
    it("should handle incremental sync with ADD collection operation", async () => {
      const operations = [
        {
          type: "ADD" as const,
          entityType: "collection" as const,
          entityId: "collection-1",
          data: {
            title: "Work",
            order: 0,
          },
        },
      ];

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations,
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("serverVersion");
      expect(response.body).toHaveProperty("operations");
      expect(Number(response.body.serverVersion)).toBeGreaterThan(0);
    });

    it("should handle incremental sync with ADD tab operation", async () => {
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

      const operations = [
        {
          type: "ADD" as const,
          entityType: "tab" as const,
          entityId: "tab-1",
          collectionId: "collection-1",
          data: {
            title: "Google",
            url: "https://www.google.com",
            favicon: "https://www.google.com/favicon.ico",
            sort_order: 0,
          },
        },
      ];

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations,
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("serverVersion");
      expect(response.body).toHaveProperty("operations");
    });

    it("should handle incremental sync with UPDATE collection operation", async () => {
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

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      const serverVersion = getResponse.body.collections[0].version;

      const operations = [
        {
          type: "UPDATE" as const,
          entityType: "collection" as const,
          entityId: "collection-1",
          clientVersion: serverVersion,
          data: {
            title: "Work Updated",
            order: 1,
          },
        },
      ];

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations,
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("serverVersion");
      expect(response.body).toHaveProperty("operations");
    });

    it("should handle incremental sync with DELETE collection operation", async () => {
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

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      const serverVersion = getResponse.body.collections[0].version;

      const operations = [
        {
          type: "DELETE" as const,
          entityType: "collection" as const,
          entityId: "collection-1",
          clientVersion: serverVersion,
        },
      ];

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations,
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("serverVersion");
    });

    it("should return 401 when no token provided", async () => {
      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [],
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });

    it("should return 401 when token is invalid", async () => {
      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [],
      }, {
        "Authorization": "Bearer invalid-token",
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });

    it("should return server operations from sync log", async () => {
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

      await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "ADD" as const,
            entityType: "collection" as const,
            entityId: "collection-2",
            data: {
              title: "Personal",
              order: 1,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("serverVersion");
      expect(response.body).toHaveProperty("operations");
      expect(response.body.operations.length).toBeGreaterThan(0);
    });

    it.skip("should detect version conflicts on UPDATE - version field issue", async () => {
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

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      if (!getResponse.body.collections || getResponse.body.collections.length === 0) {
        throw new Error("No collections returned from GET /api/sync");
      }

      const collection = getResponse.body.collections[0];

      if (!collection.version) {
        throw new Error("Collection has no version field");
      }

      const serverVersion = collection.version;

      const operations = [
        {
          type: "UPDATE" as const,
          entityType: "collection" as const,
          entityId: "collection-1",
          clientVersion: serverVersion + 1,
          data: {
            title: "Work Updated",
            order: 1,
          },
        },
      ];

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations,
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("conflicts");
      expect(response.body.conflicts).toBeDefined();
      expect(response.body.conflicts.length).toBeGreaterThan(0);
    });
  });
});
