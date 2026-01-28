import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Application } from "@oak/oak";
import { setupTestDatabase, cleanupTestDatabase, setupTestApp, createTestUser, generateTestToken } from "./setup.js";

describe("Data Consistency Integration Tests", () => {
  let app: Application;
  let user: any;
  let token: string;
  let deviceId: string;
  let testCounter = 0;

  const generateTestEmail = () => `consistency-${Date.now()}-${testCounter++}@example.com`;
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

  describe("Data isolation between users", () => {
    it("should not allow user A to access user B's data", async () => {
      const userB = await createTestUser(generateTestEmail(), "password123", generateDeviceId());
      const tokenB = generateTestToken(userB.id, userB.device_id);

      await makeRequest("POST", "/api/sync/collections", {
        collections: [
          {
            collectionId: "collection-b",
            title: "User B's Collection",
          },
        ],
      }, {
        "Authorization": `Bearer ${tokenB}`,
      });

      const responseA = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(responseA.status).toBe(200);
      expect(responseA.body.collections.length).toBe(0);
    });

    it("should prevent user A from updating user B's collection", async () => {
      const userB = await createTestUser(generateTestEmail(), "password123", generateDeviceId());
      const tokenB = generateTestToken(userB.id, userB.device_id);

      await makeRequest("POST", "/api/sync/collections", {
        collections: [
          {
            collectionId: "collection-b",
            title: "Original Title",
          },
        ],
      }, {
        "Authorization": `Bearer ${tokenB}`,
      });

      const getResponseB = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${tokenB}`,
      });

      const versionB = getResponseB.body.collections[0].version;

      const responseA = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "UPDATE" as const,
            entityType: "collection" as const,
            entityId: "collection-b",
            clientVersion: versionB,
            data: {
              title: "Modified by User A",
              order: 0,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(responseA.status).toBe(200);

      const finalResponseB = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${tokenB}`,
      });

      expect(finalResponseB.body.collections[0].title).toBe("Original Title");
    });
  });

  describe("Timestamp consistency", () => {
    it("should update updated_at timestamp on collection update", async () => {
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

      const getResponse1 = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      const originalTimestamp = getResponse1.body.collections[0].updated_at;

      await new Promise(resolve => setTimeout(resolve, 100));

      await makeRequest("POST", "/api/sync/collections", {
        collections: [
          {
            collectionId: "collection-1",
            title: "Updated Title",
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const getResponse2 = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      const updatedTimestamp = getResponse2.body.collections[0].updated_at;

      expect(updatedTimestamp).not.toBe(originalTimestamp);
    });

    it("should update updated_at timestamp on tab sync", async () => {
      await makeRequest("POST", "/api/sync/tabs", {
        tabs: [
          {
            tabId: "tab-1",
            title: "Original Title",
            url: "https://example.com",
            favicon: "https://example.com/favicon.ico",
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const getResponse1 = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      const originalTimestamp = getResponse1.body.tabs[0].updated_at;

      await new Promise(resolve => setTimeout(resolve, 100));

      await makeRequest("POST", "/api/sync/tabs", {
        tabs: [
          {
            tabId: "tab-1",
            title: "Updated Title",
            url: "https://example.com",
            favicon: "https://example.com/favicon.ico",
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const getResponse2 = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      const updatedTimestamp = getResponse2.body.tabs[0].updated_at;

      expect(updatedTimestamp).not.toBe(originalTimestamp);
    });
  });

  describe("Referential integrity", () => {
    it("should delete collection-tabs when collection is deleted", async () => {
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

      await makeRequest("POST", "/api/sync/collection-tabs", {
        collectionId: "collection-1",
        tabs: [
          {
            tabId: "tab-1",
            title: "Google",
            url: "https://google.com",
            favicon: "https://google.com/favicon.ico",
            sortOrder: 0,
          },
          {
            tabId: "tab-2",
            title: "GitHub",
            url: "https://github.com",
            favicon: "https://github.com/favicon.ico",
            sortOrder: 1,
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      await makeRequest("DELETE", "/api/sync/collection", {
        collectionId: "collection-1",
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.body.collections.length).toBe(0);
      expect(response.body.collectionTabs["collection-1"]).toBeUndefined();
    });
  });

  describe("Version consistency", () => {
    it("should increment version on collection update", async () => {
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

      const getResponse1 = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      const version1 = getResponse1.body.collections[0].version;

      await makeRequest("POST", "/api/sync/collections", {
        collections: [
          {
            collectionId: "collection-1",
            title: "Updated Title",
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const getResponse2 = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      const version2 = getResponse2.body.collections[0].version;

      expect(version2).toBeGreaterThan(version1);
    });

    it("should increment version on incremental sync UPDATE", async () => {
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

      const getResponse1 = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      const version1 = getResponse1.body.collections[0].version;

      await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "UPDATE" as const,
            entityType: "collection" as const,
            entityId: "collection-1",
            clientVersion: version1,
            data: {
              title: "Updated Title",
              order: 0,
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const getResponse2 = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      const version2 = getResponse2.body.collections[0].version;

      expect(version2).toBeGreaterThan(version1);
    });
  });

  describe("Order consistency", () => {
    it("should maintain tab sort order", async () => {
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

      const tabs = [
        {
          tabId: "tab-1",
          title: "First",
          url: "https://first.com",
          favicon: "https://first.com/favicon.ico",
          sortOrder: 0,
        },
        {
          tabId: "tab-2",
          title: "Second",
          url: "https://second.com",
          favicon: "https://second.com/favicon.ico",
          sortOrder: 1,
        },
        {
          tabId: "tab-3",
          title: "Third",
          url: "https://third.com",
          favicon: "https://third.com/favicon.ico",
          sortOrder: 2,
        },
      ];

      await makeRequest("POST", "/api/sync/collection-tabs", {
        collectionId: "collection-1",
        tabs,
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      const collectionTabs = response.body.collectionTabs["collection-1"];
      expect(collectionTabs[0].sort_order).toBe(0);
      expect(collectionTabs[1].sort_order).toBe(1);
      expect(collectionTabs[2].sort_order).toBe(2);
    });

    it("should update tab sort order", async () => {
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

      await makeRequest("POST", "/api/sync/collection-tabs", {
        collectionId: "collection-1",
        tabs: [
          {
            tabId: "tab-1",
            title: "First",
            url: "https://first.com",
            favicon: "https://first.com/favicon.ico",
            sortOrder: 0,
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      await makeRequest("POST", "/api/sync/collection-tabs", {
        collectionId: "collection-1",
        tabs: [
          {
            tabId: "tab-1",
            title: "First",
            url: "https://first.com",
            favicon: "https://first.com/favicon.ico",
            sortOrder: 5,
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.body.collectionTabs["collection-1"][0].sort_order).toBe(5);
    });
  });

  describe("Data integrity on concurrent operations", () => {
    it("should maintain consistency when overwriting same collection", async () => {
      const collections1 = [
        {
          collectionId: "collection-1",
          title: "Version 1",
        },
      ];

      const collections2 = [
        {
          collectionId: "collection-1",
          title: "Version 2",
        },
      ];

      await Promise.all([
        makeRequest("POST", "/api/sync/collections", { collections: collections1 }, {
          "Authorization": `Bearer ${token}`,
        }),
        makeRequest("POST", "/api/sync/collections", { collections: collections2 }, {
          "Authorization": `Bearer ${token}`,
        }),
      ]);

      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.body.collections.length).toBe(1);
      expect(["Version 1", "Version 2"]).toContain(response.body.collections[0].title);
    });

    it("should handle multiple updates to same tab", async () => {
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

      await makeRequest("POST", "/api/sync/collection-tabs", {
        collectionId: "collection-1",
        tabs: [
          {
            tabId: "tab-1",
            title: "Original",
            url: "https://original.com",
            favicon: "https://original.com/favicon.ico",
            sortOrder: 0,
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      await makeRequest("POST", "/api/sync/collection-tabs", {
        collectionId: "collection-1",
        tabs: [
          {
            tabId: "tab-1",
            title: "Updated 1",
            url: "https://updated1.com",
            favicon: "https://updated1.com/favicon.ico",
            sortOrder: 0,
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      await makeRequest("POST", "/api/sync/collection-tabs", {
        collectionId: "collection-1",
        tabs: [
          {
            tabId: "tab-1",
            title: "Updated 2",
            url: "https://updated2.com",
            favicon: "https://updated2.com/favicon.ico",
            sortOrder: 0,
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.body.collectionTabs["collection-1"].length).toBe(1);
    });
  });
});
