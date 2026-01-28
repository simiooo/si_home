import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Application } from "@oak/oak";
import { setupTestDatabase, cleanupTestDatabase, setupTestApp, createTestUser, generateTestToken } from "./setup.js";

describe("Conflict Resolution Integration Tests", () => {
  let app: Application;
  let user: any;
  let token: string;
  let deviceId: string;
  let testCounter = 0;

  const generateTestEmail = () => `conflict-${Date.now()}-${testCounter++}@example.com`;
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

  describe("Version conflicts on UPDATE operations", () => {
    it("should detect conflict when UPDATE collection with stale version", async () => {
      await makeRequest("POST", "/api/sync/collections", {
        collections: [
          {
            collectionId: "collection-1",
            title: "Original Title",
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      const serverVersion = getResponse.body.collections[0].version;

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "UPDATE" as const,
            entityType: "collection" as const,
            entityId: "collection-1",
            clientVersion: serverVersion + 1,
            data: {
              title: "Stale Update",
              order: 1,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.conflicts).toBeDefined();
      expect(response.body.conflicts.length).toBe(1);
      expect(response.body.conflicts[0].entityType).toBe("collection");
      expect(response.body.conflicts[0].entityId).toBe("collection-1");
      expect(response.body.conflicts[0].serverData.version).toBe(serverVersion);
      expect(response.body.conflicts[0].clientData.version).toBe(serverVersion + 1);
    });

    it("should detect conflict when UPDATE tab with stale version", async () => {
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

      const addResponse = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "ADD" as const,
            entityType: "tab" as const,
            entityId: "tab-1",
            collectionId: "collection-1",
            data: {
              title: "Original Tab",
              url: "https://original.com",
              favicon: "https://original.com/favicon.ico",
              sort_order: 0,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const serverVersion = addResponse.body.serverVersion;

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "UPDATE" as const,
            entityType: "tab" as const,
            entityId: "tab-1",
            collectionId: "collection-1",
            clientVersion: serverVersion + 1,
            data: {
              title: "Stale Tab Update",
              url: "https://stale.com",
              favicon: "https://stale.com/favicon.ico",
              sort_order: 1,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.conflicts).toBeDefined();
      expect(response.body.conflicts.length).toBe(1);
      expect(response.body.conflicts[0].entityType).toBe("tab");
    });

    it("should apply UPDATE with matching version", async () => {
      await makeRequest("POST", "/api/sync/collections", {
        collections: [
          {
            collectionId: "collection-1",
            title: "Original Title",
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      const serverVersion = getResponse.body.collections[0].version;

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "UPDATE" as const,
            entityType: "collection" as const,
            entityId: "collection-1",
            clientVersion: serverVersion,
            data: {
              title: "Updated Title",
              order: 1,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.conflicts).toBeUndefined();

      const finalResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(finalResponse.body.collections[0].title).toBe("Updated Title");
    });
  });

  describe("Conflicts on DELETE operations", () => {
    it("should detect conflict when DELETE collection with stale version", async () => {
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

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "DELETE" as const,
            entityType: "collection" as const,
            entityId: "collection-1",
            clientVersion: serverVersion + 1,
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.conflicts).toBeDefined();
      expect(response.body.conflicts.length).toBe(1);
      expect(response.body.conflicts[0].entityType).toBe("collection");
    });

    it("should detect conflict when DELETE tab with stale version", async () => {
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

      const addResponse = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "ADD" as const,
            entityType: "tab" as const,
            entityId: "tab-1",
            collectionId: "collection-1",
            data: {
              title: "Tab 1",
              url: "https://example.com",
              favicon: "https://example.com/favicon.ico",
              sort_order: 0,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const serverVersion = addResponse.body.serverVersion;

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "DELETE" as const,
            entityType: "tab" as const,
            entityId: "tab-1",
            collectionId: "collection-1",
            clientVersion: serverVersion + 1,
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.conflicts).toBeDefined();
      expect(response.body.conflicts.length).toBe(1);
      expect(response.body.conflicts[0].entityType).toBe("tab");
    });

    it("should allow DELETE with matching version", async () => {
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

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "DELETE" as const,
            entityType: "collection" as const,
            entityId: "collection-1",
            clientVersion: serverVersion,
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.conflicts).toBeUndefined();

      const finalResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(finalResponse.body.collections.length).toBe(0);
    });
  });

  describe("Multiple conflicts in single request", () => {
    it("should return multiple conflicts", async () => {
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

      const version1 = getResponse.body.collections[0].version;
      const version2 = getResponse.body.collections[1].version;

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "UPDATE" as const,
            entityType: "collection" as const,
            entityId: "collection-1",
            clientVersion: version1 + 1,
            data: {
              title: "Stale Update 1",
              order: 0,
            },
          },
          {
            type: "UPDATE" as const,
            entityType: "collection" as const,
            entityId: "collection-2",
            clientVersion: version2 + 1,
            data: {
              title: "Stale Update 2",
              order: 1,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.conflicts).toBeDefined();
      expect(response.body.conflicts.length).toBe(2);
    });

    it("should continue processing after conflict", async () => {
      await makeRequest("POST", "/api/sync/collections", {
        collections: [
          {
            collectionId: "collection-1",
            title: "Collection 1",
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      const version1 = getResponse.body.collections[0].version;

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "UPDATE" as const,
            entityType: "collection" as const,
            entityId: "collection-1",
            clientVersion: version1 + 1,
            data: {
              title: "Stale Update",
              order: 0,
            },
          },
          {
            type: "ADD" as const,
            entityType: "collection" as const,
            entityId: "collection-2",
            data: {
              title: "New Collection",
              order: 1,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.conflicts).toBeDefined();
      expect(response.body.conflicts.length).toBe(1);

      const finalResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(finalResponse.body.collections.length).toBe(2);
      expect(finalResponse.body.collections.some((c: any) => c.title === "New Collection")).toBe(true);
    });
  });

  describe("Conflict data integrity", () => {
    it("should include complete server data in conflict", async () => {
      await makeRequest("POST", "/api/sync/collections", {
        collections: [
          {
            collectionId: "collection-1",
            title: "Original Title",
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      const serverVersion = getResponse.body.collections[0].version;

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "UPDATE" as const,
            entityType: "collection" as const,
            entityId: "collection-1",
            clientVersion: serverVersion + 1,
            data: {
              title: "Client Title",
              order: 5,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.conflicts[0].serverData).toHaveProperty("version");
      expect(response.body.conflicts[0].serverData).toHaveProperty("title");
      expect(response.body.conflicts[0].serverData).toHaveProperty("order_num");
      expect(response.body.conflicts[0].serverData.title).toBe("Original Title");
    });

    it("should include complete client data in conflict", async () => {
      await makeRequest("POST", "/api/sync/collections", {
        collections: [
          {
            collectionId: "collection-1",
            title: "Original Title",
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      const serverVersion = getResponse.body.collections[0].version;

      const clientData = {
        title: "Client Title",
        order: 5,
        extra: "data",
      };

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "UPDATE" as const,
            entityType: "collection" as const,
            entityId: "collection-1",
            clientVersion: serverVersion + 1,
            data: clientData,
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.conflicts[0].clientData).toEqual({
        ...clientData,
        version: serverVersion + 1,
      });
    });
  });
});
