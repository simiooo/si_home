import { RouterContext } from "@oak/oak";
import { db } from "../db.js";
import { broadcastOperation } from "../websocket.js";
import type { AuthState } from "../middleware/authMiddleware.js";

interface SingleOperationRequest {
  deviceId: string;
  operation: {
    type: "ADD" | "UPDATE" | "DELETE";
    entityType: "collection" | "tab";
    entityId: string;
    collectionId?: string;
    data: Record<string, unknown>;
    isOfflineCreated?: boolean;
  };
  lastSyncVersion: number;
}

interface SingleOperationResponse {
  serverVersion: number;
  operation?: {
    id: number;
    type: "ADD" | "UPDATE" | "DELETE";
    entityType: "collection" | "tab";
    entityId: string;
    collectionId?: string;
    data: Record<string, unknown>;
    version: number;
  };
  conflict?: {
    entityType: string;
    entityId: string;
    serverData: Record<string, unknown>;
    clientData: Record<string, unknown>;
  };
  idMapping?: {
    clientId: string;
    serverId: string;
  };
}

export const processSingleOperation = async (ctx: RouterContext<string, AuthState>) => {
  const userId = ctx.state.userId;

  if (!userId) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Unauthorized" };
    return;
  }

  try {
    const body = await ctx.request.body.json() as SingleOperationRequest;
    const { deviceId, operation, lastSyncVersion } = body;

    const response: SingleOperationResponse = {
      serverVersion: lastSyncVersion,
    };

    const versionResult = await db.query(
      "SELECT get_sync_version($1) as version",
      [userId]
    );
    const newVersion = versionResult.rows[0].version;

    const conflict = await processOperation(userId, operation, newVersion);

    if (conflict) {
      ctx.response.status = 409;
      ctx.response.body = {
        serverVersion: lastSyncVersion,
        conflict,
      };
      return;
    }

    response.serverVersion = newVersion;
    response.operation = {
      id: newVersion,
      type: operation.type,
      entityType: operation.entityType,
      entityId: operation.entityId,
      collectionId: operation.collectionId,
      data: operation.data,
      version: newVersion,
    };

    if (operation.isOfflineCreated) {
      const serverId = await handleOfflineCreatedId(userId, operation);
      if (serverId && serverId !== operation.entityId) {
        response.idMapping = {
          clientId: operation.entityId,
          serverId,
        };
        response.operation.entityId = serverId;
      }
    }

    await db.query(
      `INSERT INTO client_sync (user_id, device_id, last_sync_version, last_sync_time)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, device_id)
       DO UPDATE SET last_sync_version = $3, last_sync_time = CURRENT_TIMESTAMP`,
      [userId, deviceId, newVersion]
    );

    broadcastOperation(userId, {
      type: operation.type,
      entityType: operation.entityType,
      entityId: response.operation.entityId,
      collectionId: operation.collectionId,
      data: operation.data,
      version: newVersion,
    }, deviceId);

    ctx.response.body = response;
  } catch (error) {
    console.error("Error processing single operation:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
};

async function processOperation(
  userId: number,
  operation: SingleOperationRequest["operation"],
  version: number
): Promise<SingleOperationResponse["conflict"] | null> {
  const { type, entityType, entityId, collectionId, data } = operation;

  if (type === "DELETE") {
    if (entityType === "collection") {
      const result = await db.query(
        "DELETE FROM collections WHERE collection_id = $1 AND user_id = $2 RETURNING id",
        [entityId, userId]
      );

      if (result.rows.length > 0) {
        await db.query(
          "DELETE FROM collection_tabs WHERE collection_id = $1",
          [result.rows[0].id]
        );
        await logOperation(userId, "DELETE", "collection", entityId, undefined, {}, version);
      }
    } else if (entityType === "tab" && collectionId) {
      await db.query(
        `DELETE FROM collection_tabs
         WHERE tab_id = $1 AND collection_id = (SELECT id FROM collections WHERE collection_id = $2 AND user_id = $3)`,
        [entityId, collectionId, userId]
      );
      await logOperation(userId, "DELETE", "tab", entityId, collectionId, {}, version);
    }
  } else if (type === "ADD") {
    if (entityType === "collection") {
      const existing = await db.query(
        "SELECT id FROM collections WHERE collection_id = $1 AND user_id = $2",
        [entityId, userId]
      );

      if (existing.rows.length === 0) {
        await db.query(
          `INSERT INTO collections (user_id, collection_id, title, order_num, version)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, entityId, data.title as string, (data.order as number) || 0, version]
        );
        await logOperation(userId, "ADD", "collection", entityId, undefined, data, version);
      }
    } else if (entityType === "tab" && collectionId) {
      const collectionResult = await db.query(
        "SELECT id FROM collections WHERE collection_id = $1 AND user_id = $2",
        [collectionId, userId]
      );

      if (collectionResult.rows.length > 0) {
        const existing = await db.query(
          "SELECT id FROM collection_tabs WHERE tab_id = $1 AND collection_id = $2",
          [entityId, collectionResult.rows[0].id]
        );

        if (existing.rows.length === 0) {
          await db.query(
            `INSERT INTO collection_tabs (collection_id, tab_id, title, url, favicon, sort_order, version)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              collectionResult.rows[0].id,
              entityId,
              data.title as string,
              data.url as string,
              data.favicon as string,
              (data.sort_order as number) || 0,
              version,
            ]
          );
          await logOperation(userId, "ADD", "tab", entityId, collectionId, data, version);
        }
      }
    }
  } else if (type === "UPDATE") {
    if (entityType === "collection") {
      const existing = await db.query(
        "SELECT id, version FROM collections WHERE collection_id = $1 AND user_id = $2",
        [entityId, userId]
      );

      if (existing.rows.length > 0) {
        // Server version check can be added here for conflict detection

        await db.query(
          `UPDATE collections
           SET title = $1, order_num = $2, version = $3, updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [data.title as string, (data.order as number) || 0, version, existing.rows[0].id]
        );
        await logOperation(userId, "UPDATE", "collection", entityId, undefined, data, version);
      }
    } else if (entityType === "tab" && collectionId) {
      const collectionResult = await db.query(
        "SELECT id FROM collections WHERE collection_id = $1 AND user_id = $2",
        [collectionId, userId]
      );

      if (collectionResult.rows.length > 0) {
        const existing = await db.query(
          "SELECT id FROM collection_tabs WHERE tab_id = $1 AND collection_id = $2",
          [entityId, collectionResult.rows[0].id]
        );

        if (existing.rows.length > 0) {
          await db.query(
            `UPDATE collection_tabs
             SET title = $1, url = $2, favicon = $3, sort_order = $4, version = $5
             WHERE id = $6`,
            [
              data.title as string,
              data.url as string,
              data.favicon as string,
              (data.sort_order as number) || 0,
              version,
              existing.rows[0].id,
            ]
          );
          await logOperation(userId, "UPDATE", "tab", entityId, collectionId, data, version);
        }
      }
    }
  }

  return null;
}

async function handleOfflineCreatedId(
  userId: number,
  operation: SingleOperationRequest["operation"]
): Promise<string | null> {
  return operation.entityId;
}

async function logOperation(
  userId: number,
  action: "ADD" | "UPDATE" | "DELETE",
  entityType: "collection" | "tab",
  entityId: string,
  collectionId: string | undefined,
  data: Record<string, unknown>,
  version: number
): Promise<void> {
  await db.query(
    `INSERT INTO sync_log (user_id, action, entity_type, entity_id, collection_id, data, version)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, action, entityType, entityId, collectionId, JSON.stringify(data), version]
  );
}
