import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Application } from "@oak/oak";
import { setupTestDatabase, cleanupTestDatabase, setupTestApp, createTestUser, generateTestToken } from "./setup.js";

describe("Boundary Conditions Integration Tests", () => {
  let app: Application;
  let user: any;
  let token: string;
  let deviceId: string;
  let testCounter = 0;

  const generateTestEmail = () => `boundary-${Date.now()}-${testCounter++}@example.com`;
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

  describe("Empty data tests", () => {
    it("should handle empty tabs array", async () => {
      const response = await makeRequest("POST", "/api/sync/tabs", { tabs: [] }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Tabs synced successfully");
    });

    it("should handle empty collections array", async () => {
      const response = await makeRequest("POST", "/api/sync/collections", { collections: [] }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Collections synced successfully");
    });

    it("should handle empty collection-tabs array", async () => {
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
        tabs: [],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Collection tabs synced successfully");
    });

    it("should return empty arrays when no data exists", async () => {
      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.tabs).toEqual([]);
      expect(response.body.collections).toEqual([]);
      expect(response.body.config).toBe(null);
    });

    it("should handle empty incremental sync operations", async () => {
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
    });
  });

  describe("Large data tests", () => {
    it("should handle syncing many tabs", async () => {
      const tabs = Array.from({ length: 100 }, (_, i) => ({
        tabId: `tab-${i}`,
        title: `Tab ${i}`,
        url: `https://example.com/${i}`,
        favicon: `https://example.com/${i}/favicon.ico`,
      }));

      const response = await makeRequest("POST", "/api/sync/tabs", { tabs }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(getResponse.body.tabs.length).toBe(100);
    });

    it("should handle syncing many collections", async () => {
      const collections = Array.from({ length: 50 }, (_, i) => ({
        collectionId: `collection-${i}`,
        title: `Collection ${i}`,
      }));

      const response = await makeRequest("POST", "/api/sync/collections", { collections }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(getResponse.body.collections.length).toBe(50);
    });

    it("should handle many collection-tabs", async () => {
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

      const tabs = Array.from({ length: 50 }, (_, i) => ({
        tabId: `tab-${i}`,
        title: `Tab ${i}`,
        url: `https://example.com/${i}`,
        favicon: `https://example.com/${i}/favicon.ico`,
        sortOrder: i,
      }));

      const response = await makeRequest("POST", "/api/sync/collection-tabs", {
        collectionId: "collection-1",
        tabs,
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(getResponse.body.collectionTabs["collection-1"].length).toBe(50);
    });

    it("should handle large incremental sync operations batch", async () => {
      const operations = Array.from({ length: 50 }, (_, i) => ({
        type: "ADD" as const,
        entityType: "collection" as const,
        entityId: `collection-${i}`,
        data: {
          title: `Collection ${i}`,
          order: i,
        },
      }));

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations,
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.serverVersion).toBeGreaterThan(0);
    });
  });

  describe("Special characters and edge cases", () => {
    it("should handle URLs with special characters", async () => {
      const tabs = [
        {
          tabId: "tab-1",
          title: "Special URL",
          url: "https://example.com/path?query=value&param=123#anchor",
          favicon: "https://example.com/favicon.ico",
        },
      ];

      const response = await makeRequest("POST", "/api/sync/tabs", { tabs }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(getResponse.body.tabs[0].url).toBe("https://example.com/path?query=value&param=123#anchor");
    });

    it("should handle titles with unicode characters", async () => {
      const collections = [
        {
          collectionId: "collection-1",
          title: "工作 🚀 中文 Español 日本語",
        },
      ];

      const response = await makeRequest("POST", "/api/sync/collections", { collections }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(getResponse.body.collections[0].title).toBe("工作 🚀 中文 Español 日本語");
    });

    it("should handle very long titles", async () => {
      const longTitle = "A".repeat(1000);
      const collections = [
        {
          collectionId: "collection-1",
          title: longTitle,
        },
      ];

      const response = await makeRequest("POST", "/api/sync/collections", { collections }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(getResponse.body.collections[0].title).toBe(longTitle);
    });

    it("should handle empty collectionId and tabId after trim", async () => {
      const response = await makeRequest("POST", "/api/sync/collections", {
        collections: [
          {
            collectionId: "   ",
            title: "Work",
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
    });

    it("should handle complex config objects", async () => {
      const complexConfig = {
        theme: "dark",
        language: "en",
        nested: {
          level1: {
            level2: {
              value: "deep",
            },
          },
        },
        array: [1, 2, 3, { key: "value" }],
        boolean: true,
        null: null,
        number: 123.456,
      };

      const response = await makeRequest("POST", "/api/sync/config", { config: complexConfig }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);

      const getResponse = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(getResponse.body.config).toEqual(complexConfig);
    });
  });

  describe("Update and delete edge cases", () => {
    it("should handle updating non-existent entity", async () => {
      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "UPDATE" as const,
            entityType: "collection" as const,
            entityId: "non-existent",
            clientVersion: 1,
            data: {
              title: "Updated",
            },
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.operations.length).toBe(0);
    });

    it("should handle deleting non-existent entity", async () => {
      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId,
        lastSyncVersion: 0,
        operations: [
          {
            type: "DELETE" as const,
            entityType: "collection" as const,
            entityId: "non-existent",
            clientVersion: 1,
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.status).toBe(200);
    });

    it("should handle deleting collection twice", async () => {
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

      const deleteResponse1 = await makeRequest("DELETE", "/api/sync/collection", {
        collectionId: "collection-1",
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(deleteResponse1.status).toBe(200);

      const deleteResponse2 = await makeRequest("DELETE", "/api/sync/collection", {
        collectionId: "collection-1",
      }, {
        "Authorization": `Bearer ${token}`,
      });

      expect(deleteResponse2.status).toBe(404);
    });
  });

  describe("Data overwrites", () => {
    it("should overwrite existing tabs on sync", async () => {
      await makeRequest("POST", "/api/sync/tabs", {
        tabs: [
          {
            tabId: "tab-1",
            title: "Old Title",
            url: "https://old.com",
            favicon: "https://old.com/favicon.ico",
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      await makeRequest("POST", "/api/sync/tabs", {
        tabs: [
          {
            tabId: "tab-1",
            title: "New Title",
            url: "https://new.com",
            favicon: "https://new.com/favicon.ico",
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.body.tabs.length).toBe(1);
      expect(response.body.tabs[0].title).toBe("New Title");
      expect(response.body.tabs[0].url).toBe("https://new.com");
    });

    it("should overwrite existing collection-tabs on sync", async () => {
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
            title: "Old Tab",
            url: "https://old.com",
            favicon: "https://old.com/favicon.ico",
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
            title: "New Tab",
            url: "https://new.com",
            favicon: "https://new.com/favicon.ico",
            sortOrder: 1,
          },
        ],
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.body.collectionTabs["collection-1"].length).toBe(1);
      expect(response.body.collectionTabs["collection-1"][0].title).toBe("New Tab");
      expect(response.body.collectionTabs["collection-1"][0].sort_order).toBe(1);
    });

    it("should overwrite config on sync", async () => {
      await makeRequest("POST", "/api/sync/config", {
        config: {
          theme: "light",
          language: "en",
        },
      }, {
        "Authorization": `Bearer ${token}`,
      });

      await makeRequest("POST", "/api/sync/config", {
        config: {
          theme: "dark",
          language: "zh",
        },
      }, {
        "Authorization": `Bearer ${token}`,
      });

      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token}`,
      });

      expect(response.body.config.theme).toBe("dark");
      expect(response.body.config.language).toBe("zh");
    });
  });
});
