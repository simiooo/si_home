import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Application } from "@oak/oak";
import { setupTestDatabase, cleanupTestDatabase, setupTestApp, createTestUser, generateTestToken } from "./setup.js";

describe("Complex Incremental Sync Integration Tests", () => {
  let app: Application;
  let user: any;
  let token: string;
  let deviceId: string;
  let testCounter = 0;

  const generateTestEmail = () => `complexsync-${Date.now()}-${testCounter++}@example.com`;
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

  describe("Mixed operation types in single request", () => {
    it("should handle ADD, UPDATE, and DELETE operations together", async () => {
      await makeRequest("POST", "/api/sync/collections", {
        collections: [
          {
            collectionId: "collection-1",
            title: "Collection 1",
          },
          {
            collectionId: "collection-2",
            title: "Collection 2",
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      const version = getResponse.body.collections[0].version;

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "ADD" as const,
            entityType: "collection" as const,
            entityId: "collection-3",
            data: {
              title: "Collection 3",
              order: 2,
            },
          },
          {
            type: "UPDATE" as const,
            entityType: "collection" as const,
            entityId: "collection-1",
            clientVersion: version,
            data: {
              title: "Updated Collection 1",
              order: 0,
            },
          },
          {
            type: "DELETE" as const,
            entityType: "collection" as const,
            entityId: "collection-2",
            clientVersion: getResponse.body.collections[1].version,
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.serverVersion).toBeGreaterThan(0);

      const finalResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(finalResponse.body.collections.length).toBe(2);
      expect(finalResponse.body.collections.find((c: any) => c.collection_id === "collection-1").title).toBe("Updated Collection 1");
      expect(finalResponse.body.collections.find((c: any) => c.collection_id === "collection-2")).toBeUndefined();
      expect(finalResponse.body.collections.find((c: any) => c.collection_id === "collection-3").title).toBe("Collection 3");
    });

    it("should handle mixed collection and tab operations", async () => {
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

      const response = await makeRequest("POST", "/api/sync/incremental", {
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
          {
            type: "ADD" as const,
            entityType: "tab" as const,
            entityId: "tab-1",
            collectionId: "collection-1",
            data: {
              title: "Google",
              url: "https://google.com",
              favicon: "https://google.com/favicon.ico",
              sort_order: 0,
            },
          },
          {
            type: "ADD" as const,
            entityType: "tab" as const,
            entityId: "tab-2",
            collectionId: "collection-2",
            data: {
              title: "GitHub",
              url: "https://github.com",
              favicon: "https://github.com/favicon.ico",
              sort_order: 0,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);

      const finalResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(finalResponse.body.collections.length).toBe(2);
      expect(finalResponse.body.collectionTabs["collection-1"].length).toBe(1);
      expect(finalResponse.body.collectionTabs["collection-2"].length).toBe(1);
    });
  });

  describe("Operation ordering and dependencies", () => {
    it("should handle adding tabs to collection in same request", async () => {
      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "ADD" as const,
            entityType: "collection" as const,
            entityId: "collection-1",
            data: {
              title: "Work",
              order: 0,
            },
          },
          {
            type: "ADD" as const,
            entityType: "tab" as const,
            entityId: "tab-1",
            collectionId: "collection-1",
            data: {
              title: "Google",
              url: "https://google.com",
              favicon: "https://google.com/favicon.ico",
              sort_order: 0,
            },
          },
          {
            type: "ADD" as const,
            entityType: "tab" as const,
            entityId: "tab-2",
            collectionId: "collection-1",
            data: {
              title: "GitHub",
              url: "https://github.com",
              favicon: "https://github.com/favicon.ico",
              sort_order: 1,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);

      const finalResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(finalResponse.body.collections.length).toBe(1);
      expect(finalResponse.body.collectionTabs["collection-1"].length).toBe(2);
    });

    it("should handle updating collection and its tabs in same request", async () => {
      await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "ADD" as const,
            entityType: "collection" as const,
            entityId: "collection-1",
            data: {
              title: "Work",
              order: 0,
            },
          },
          {
            type: "ADD" as const,
            entityType: "tab" as const,
            entityId: "tab-1",
            collectionId: "collection-1",
            data: {
              title: "Google",
              url: "https://google.com",
              favicon: "https://google.com/favicon.ico",
              sort_order: 0,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      const collectionVersion = getResponse.body.collections[0].version;
      const tabVersion = getResponse.body.collectionTabs["collection-1"][0].version;

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "UPDATE" as const,
            entityType: "collection" as const,
            entityId: "collection-1",
            clientVersion: collectionVersion,
            data: {
              title: "Work Updated",
              order: 0,
            },
          },
          {
            type: "UPDATE" as const,
            entityType: "tab" as const,
            entityId: "tab-1",
            collectionId: "collection-1",
            clientVersion: tabVersion,
            data: {
              title: "Google Updated",
              url: "https://google.com",
              favicon: "https://google.com/favicon.ico",
              sort_order: 0,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);

      const finalResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(finalResponse.body.collections[0].title).toBe("Work Updated");
      expect(finalResponse.body.collectionTabs["collection-1"][0].title).toBe("Google Updated");
    });
  });

  describe("Sync log operations retrieval", () => {
    it("should return all operations since last sync", async () => {
      const sync1 = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "ADD" as const,
            entityType: "collection" as const,
            entityId: "collection-1",
            data: {
              title: "Work",
              order: 0,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const version1 = sync1.body.serverVersion;

      const sync2 = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: version1,
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

      const version2 = sync2.body.serverVersion;

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: version1,
        operations: [],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.operations.length).toBe(1);
      expect(response.body.operations[0].entityId).toBe("collection-2");
    });

    it("should return empty operations when no new changes", async () => {
      const sync1 = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "ADD" as const,
            entityType: "collection" as const,
            entityId: "collection-1",
            data: {
              title: "Work",
              order: 0,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const version1 = sync1.body.serverVersion;

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: version1,
        operations: [],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.operations.length).toBe(0);
    });

    it("should include operation metadata in sync log", async () => {
      const sync1 = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "ADD" as const,
            entityType: "collection" as const,
            entityId: "collection-1",
            data: {
              title: "Work",
              order: 0,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const version1 = sync1.body.serverVersion;

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.operations.length).toBe(1);
      expect(response.body.operations[0]).toHaveProperty("id");
      expect(response.body.operations[0]).toHaveProperty("type");
      expect(response.body.operations[0]).toHaveProperty("entityType");
      expect(response.body.operations[0]).toHaveProperty("entityId");
      expect(response.body.operations[0]).toHaveProperty("data");
      expect(response.body.operations[0]).toHaveProperty("version");
      expect(response.body.operations[0]).toHaveProperty("timestamp");
    });
  });

  describe("Device sync state management", () => {
    it("should update device last_sync_version after sync", async () => {
      const sync1 = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "ADD" as const,
            entityType: "collection" as const,
            entityId: "collection-1",
            data: {
              title: "Work",
              order: 0,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const version1 = sync1.body.serverVersion;

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: version1,
        operations: [],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.body.serverVersion).toBe(version1);
    });

    it("should handle sync with stale lastSyncVersion", async () => {
      await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "ADD" as const,
            entityType: "collection" as const,
            entityId: "collection-1",
            data: {
              title: "Work",
              order: 0,
            },
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
      expect(response.body.operations.length).toBe(2);
    });
  });

  describe("Error handling and edge cases", () => {
    it("should handle operation with missing required fields gracefully", async () => {
      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "ADD" as const,
            entityType: "collection" as const,
            entityId: "collection-1",
            data: {},
          } as any,
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
    });

    it("should handle tab operation for non-existent collection", async () => {
      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "ADD" as const,
            entityType: "tab" as const,
            entityId: "tab-1",
            collectionId: "non-existent-collection",
            data: {
              title: "Google",
              url: "https://google.com",
              favicon: "https://google.com/favicon.ico",
              sort_order: 0,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.serverVersion).toBeGreaterThan(0);
    });

    it("should handle duplicate ADD operations idempotently", async () => {
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

      await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations,
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations,
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);

      const finalResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(finalResponse.body.collections.length).toBe(1);
    });
  });
});
