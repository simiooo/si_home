import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Application } from "@oak/oak";
import { setupTestDatabase, cleanupTestDatabase, setupTestApp, createTestUser, generateTestToken } from "./setup.js";

describe("Multi-Device Sync Integration Tests", () => {
  let app: Application;
  let user: any;
  let token1: string;
  let token2: string;
  let deviceId1: string;
  let deviceId2: string;
  let testCounter = 0;

  const generateTestEmail = () => `multidevice-${Date.now()}-${testCounter++}@example.com`;
  const generateDeviceId = () => `device-${Date.now()}-${Math.random()}`;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await setupTestApp();
  });

  beforeEach(async () => {
    deviceId1 = generateDeviceId();
    deviceId2 = generateDeviceId();
    user = await createTestUser(generateTestEmail(), "password123", deviceId1);
    token1 = generateTestToken(user.id, deviceId1);
    token2 = generateTestToken(user.id, deviceId2);
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

  describe("Data sync across multiple devices", () => {
    it("should sync tabs from device 1 and retrieve on device 2", async () => {
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

      await makeRequest("POST", "/api/sync/tabs", { tabs }, {
        "Authorization": `Bearer ${token1}`,
      });

      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token2}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.tabs.length).toBe(2);
      expect(response.body.tabs[0].title).toBe("Google");
      expect(response.body.tabs[1].title).toBe("GitHub");
    });

    it("should sync collections from device 1 and retrieve on device 2", async () => {
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

      await makeRequest("POST", "/api/sync/collections", { collections }, {
        "Authorization": `Bearer ${token1}`,
      });

      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token2}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.collections.length).toBe(2);
      expect(response.body.collections[0].title).toBe("Work");
      expect(response.body.collections[1].title).toBe("Personal");
    });

    it("should overwrite data from multiple devices", async () => {
      await makeRequest("POST", "/api/sync/tabs", {
        tabs: [
          {
            tabId: "tab-1",
            title: "Google",
            url: "https://www.google.com",
            favicon: "https://www.google.com/favicon.ico",
          },
        ],
      }, {
        "Authorization": `Bearer ${token1}`,
      });

      await makeRequest("POST", "/api/sync/tabs", {
        tabs: [
          {
            tabId: "tab-2",
            title: "GitHub",
            url: "https://github.com",
            favicon: "https://github.com/favicon.ico",
          },
        ],
      }, {
        "Authorization": `Bearer ${token2}`,
      });

      const response1 = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token1}`,
      });

      expect(response1.status).toBe(200);
      expect(response1.body.tabs.length).toBe(1);
      expect(["Google", "GitHub"]).toContain(response1.body.tabs[0].title);
    });

    it("should update collection-tabs from one device and sync to another", async () => {
      await makeRequest("POST", "/api/sync/collections", {
        collections: [
          {
            collectionId: "collection-1",
            title: "Work",
          },
        ],
      }, {
        "Authorization": `Bearer ${token1}`,
      });

      const tabs = [
        {
          tabId: "tab-1",
          title: "Google",
          url: "https://www.google.com",
          favicon: "https://www.google.com/favicon.ico",
          sortOrder: 0,
        },
      ];

      await makeRequest("POST", "/api/sync/collection-tabs", {
        collectionId: "collection-1",
        tabs,
      }, {
        "Authorization": `Bearer ${token1}`,
      });

      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token2}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.collectionTabs["collection-1"].length).toBe(1);
      expect(response.body.collectionTabs["collection-1"][0].title).toBe("Google");
    });

    it("should handle config sync across devices", async () => {
      const config = {
        theme: "dark",
        language: "en",
        fontSize: 14,
      };

      await makeRequest("POST", "/api/sync/config", { config }, {
        "Authorization": `Bearer ${token1}`,
      });

      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token2}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.config).toEqual(config);
    });

    it("should delete collection from one device and reflect on another", async () => {
      await makeRequest("POST", "/api/sync/collections", {
        collections: [
          {
            collectionId: "collection-1",
            title: "Work",
          },
        ],
      }, {
        "Authorization": `Bearer ${token1}`,
      });

      await makeRequest("DELETE", "/api/sync/collection", {
        collectionId: "collection-1",
      }, {
        "Authorization": `Bearer ${token1}`,
      });

      const response = await makeRequest("GET", "/api/sync", undefined, {
        "Authorization": `Bearer ${token2}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.collections.length).toBe(0);
    });
  });

  describe("Incremental sync across multiple devices", () => {
    it("should sync operations from device 1 to device 2", async () => {
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
        deviceId: deviceId1,
        lastSyncVersion: 0,
        operations,
      }, {
        "Authorization": `Bearer ${token1}`,
      });

      const response = await makeRequest("POST", "/api/sync/incremental", {
        deviceId: deviceId2,
        lastSyncVersion: 0,
        operations: [],
      }, {
        "Authorization": `Bearer ${token2}`,
      });

      expect(response.status).toBe(200);
      expect(response.body.operations.length).toBeGreaterThan(0);
      expect(response.body.operations[0].type).toBe("ADD");
    });

    it("should track last sync version per device", async () => {
      const operations1 = [
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

      const response1 = await makeRequest("POST", "/api/sync/incremental", {
        deviceId: deviceId1,
        lastSyncVersion: 0,
        operations: operations1,
      }, {
        "Authorization": `Bearer ${token1}`,
      });

      const version1 = response1.body.serverVersion;

      const operations2 = [
        {
          type: "ADD" as const,
          entityType: "collection" as const,
          entityId: "collection-2",
          data: {
            title: "Personal",
            order: 1,
          },
        },
      ];

      const response2Initial = await makeRequest("POST", "/api/sync/incremental", {
        deviceId: deviceId2,
        lastSyncVersion: 0,
        operations: operations2,
      }, {
        "Authorization": `Bearer ${token2}`,
      });

      expect(response2Initial.status).toBe(200);
      expect(response2Initial.body.serverVersion).toBeGreaterThan(0);

      const version2 = response2Initial.body.serverVersion;

      const response2Sync = await makeRequest("POST", "/api/sync/incremental", {
        deviceId: deviceId2,
        lastSyncVersion: 0,
        operations: [],
      }, {
        "Authorization": `Bearer ${token2}`,
      });

      expect(response2Sync.status).toBe(200);
      expect(response2Sync.body.operations.length).toBeGreaterThan(0);
      expect(["collection-1", "collection-2"]).toContain(response2Sync.body.operations[0].entityId);
    });
  });
});
