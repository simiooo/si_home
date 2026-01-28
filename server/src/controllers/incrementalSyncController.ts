import { db } from "../db.js";
import type { RouterContext } from "@oak/oak";
import type { AuthState } from "../middleware/authMiddleware.js";

interface IncrementalSyncRequest {
  deviceId: string;
  lastSyncVersion?: number;
  operations?: Array<{
    type: "ADD" | "UPDATE" | "DELETE";
    entityType: "collection" | "tab";
    entityId?: string;
    collectionId?: string;
    data?: Record<string, unknown>;
    clientVersion?: number;
  }>;
}

interface IncrementalSyncResponse {
  serverVersion: number;
  operations: Array<{
    id: number;
    type: "ADD" | "UPDATE" | "DELETE";
    entityType: "collection" | "tab";
    entityId: string;
    collectionId?: string;
    data: Record<string, unknown>;
    version: number;
    timestamp: string;
  }>;
  conflicts?: Array<{
    entityType: string;
    entityId: string;
    serverData: Record<string, unknown>;
    clientData: Record<string, unknown>;
  }>;
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

export const incrementalSync = async (ctx: RouterContext<string, AuthState>) => {
  const userId = ctx.state.userId;

  if (!userId) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Unauthorized" };
    return;
  }

  try {
    const body = await ctx.request.body.json() as IncrementalSyncRequest;
    const { deviceId, lastSyncVersion = 0, operations = [] } = body;

    const response: IncrementalSyncResponse = {
      serverVersion: 0,
      operations: [],
    };

    const clientSyncResult = await db.query(
      "SELECT last_sync_version FROM client_sync WHERE user_id = $1 AND device_id = $2",
      [userId, deviceId]
    );
    const clientLastSync = clientSyncResult.rows[0]?.last_sync_version || 0;
    const effectiveLastSync = Math.max(lastSyncVersion, clientLastSync);

    const conflicts: Array<{
      entityType: string;
      entityId: string;
      serverData: Record<string, unknown>;
      clientData: Record<string, unknown>;
    }> = [];

    const versionBatch = await db.query(
      "SELECT get_sync_version($1) as version FROM generate_series(1, $2)",
      [userId, operations.length]
    );
    const versionQueue = versionBatch.rows.map((row, index) => ({
      index,
      version: row.version,
    })).sort((a, b) => a.version - b.version);

    let versionIndex = 0;

    const getNextVersion = (): number => {
      return versionQueue[versionIndex++].version;
    };

    for (const op of operations) {
      const currentVersion = getNextVersion();

      if (op.type === "DELETE") {
        if (op.entityType === "collection") {
          const collectionResult = await db.query(
            "SELECT id, title, order_num, version FROM collections WHERE collection_id = $1 AND user_id = $2",
            [op.entityId, userId]
          );

          if (collectionResult.rows.length > 0) {
            const serverVersion = collectionResult.rows[0].version;

            if (op.clientVersion && op.clientVersion !== serverVersion) {
              conflicts.push({
                entityType: "collection",
                entityId: op.entityId!,
                serverData: {
                  version: serverVersion,
                  title: collectionResult.rows[0].title,
                  order_num: collectionResult.rows[0].order_num,
                },
                clientData: { version: op.clientVersion },
              });
              continue;
            }

            const deleteResult = await db.query(
              "DELETE FROM collections WHERE collection_id = $1 AND user_id = $2 RETURNING id",
              [op.entityId, userId]
            );

            if (deleteResult.rows.length === 0) {
              conflicts.push({
                entityType: "collection",
                entityId: op.entityId!,
                serverData: { version: serverVersion },
                clientData: { version: op.clientVersion },
              });
              continue;
            }

            await db.query(
              "DELETE FROM collection_tabs WHERE collection_id = $1",
              [deleteResult.rows[0].id]
            );
            await logOperation(userId, "DELETE", "collection", op.entityId!, undefined, {}, currentVersion);
          }
        } else if (op.entityType === "tab") {
          const tabResult = await db.query(
            `SELECT ct.id, ct.title, ct.url, ct.favicon, ct.sort_order, ct.version FROM collection_tabs ct
             JOIN collections c ON ct.collection_id = c.id
             WHERE ct.tab_id = $1 AND c.user_id = $2`,
            [op.entityId, userId]
          );

          if (tabResult.rows.length > 0) {
            const serverVersion = tabResult.rows[0].version;

            if (op.clientVersion && op.clientVersion !== serverVersion) {
              conflicts.push({
                entityType: "tab",
                entityId: op.entityId!,
                serverData: {
                  version: serverVersion,
                  title: tabResult.rows[0].title,
                  url: tabResult.rows[0].url,
                  favicon: tabResult.rows[0].favicon,
                  sort_order: tabResult.rows[0].sort_order,
                },
                clientData: { version: op.clientVersion },
              });
              continue;
            }

            const deleteResult = await db.query(
              `DELETE FROM collection_tabs
               WHERE tab_id = $1 AND collection_id = (SELECT id FROM collections WHERE collection_id = $2 AND user_id = $3)
               RETURNING id`,
              [op.entityId, op.collectionId, userId]
            );

            if (deleteResult.rows.length === 0) {
              conflicts.push({
                entityType: "tab",
                entityId: op.entityId!,
                serverData: { version: serverVersion },
                clientData: { version: op.clientVersion },
              });
              continue;
            }
            await logOperation(userId, "DELETE", "tab", op.entityId!, op.collectionId, {}, currentVersion);
          }
        }
      } else if (op.type === "ADD" || op.type === "UPDATE") {
        if (op.entityType === "collection" && op.data) {
          const existingResult = await db.query(
            "SELECT id, title, order_num, version FROM collections WHERE collection_id = $1 AND user_id = $2",
            [op.entityId, userId]
          );

          if (op.type === "ADD") {
            if (existingResult.rows.length > 0) {
              continue;
            }

            await db.query(
              `INSERT INTO collections (user_id, collection_id, title, order_num, version)
               VALUES ($1, $2, $3, $4, $5)`,
              [userId, op.entityId, op.data.title as string, (op.data.order as number) || 0, currentVersion]
            );
            await logOperation(userId, "ADD", "collection", op.entityId!, undefined, op.data, currentVersion);
          } else {
            if (existingResult.rows.length === 0) {
              continue;
            }

            const serverVersion = existingResult.rows[0].version;

            if (op.clientVersion && op.clientVersion !== serverVersion) {
              conflicts.push({
                entityType: "collection",
                entityId: op.entityId!,
                serverData: {
                  version: serverVersion,
                  title: existingResult.rows[0].title,
                  order_num: existingResult.rows[0].order_num,
                },
                clientData: { ...op.data, version: op.clientVersion },
              });
              continue;
            }

            const updateResult = await db.query(
              `UPDATE collections
               SET title = $1, order_num = $2, version = $3, updated_at = CURRENT_TIMESTAMP
               WHERE id = $4 AND version = $5
               RETURNING id, version`,
              [op.data.title as string, (op.data.order as number) || 0, currentVersion, existingResult.rows[0].id, serverVersion]
            );

            if (updateResult.rows.length === 0) {
              conflicts.push({
                entityType: "collection",
                entityId: op.entityId!,
                serverData: { version: serverVersion },
                clientData: { ...op.data, version: op.clientVersion },
              });
              continue;
            }
            await logOperation(userId, "UPDATE", "collection", op.entityId!, undefined, op.data, currentVersion);
          }
        } else if (op.entityType === "tab" && op.data && op.collectionId) {
          const collectionResult = await db.query(
            "SELECT id FROM collections WHERE collection_id = $1 AND user_id = $2",
            [op.collectionId, userId]
          );

          if (collectionResult.rows.length === 0) {
            continue;
          }

          const collectionId = collectionResult.rows[0].id;

          const existingResult = await db.query(
            "SELECT id, title, url, favicon, sort_order, version FROM collection_tabs WHERE tab_id = $1 AND collection_id = $2",
            [op.entityId, collectionId]
          );

          if (op.type === "ADD") {
            if (existingResult.rows.length > 0) {
              continue;
            }

            await db.query(
              `INSERT INTO collection_tabs (collection_id, tab_id, title, url, favicon, sort_order, version)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                collectionId,
                op.entityId,
                op.data.title as string,
                op.data.url as string,
                op.data.favicon as string,
                (op.data.sort_order as number) || 0,
                currentVersion,
              ]
            );
            await logOperation(userId, "ADD", "tab", op.entityId!, op.collectionId, op.data, currentVersion);
          } else {
            if (existingResult.rows.length === 0) {
              continue;
            }

            const serverVersion = existingResult.rows[0].version;

            if (op.clientVersion && op.clientVersion !== serverVersion) {
              conflicts.push({
                entityType: "tab",
                entityId: op.entityId!,
                serverData: {
                  version: serverVersion,
                  title: existingResult.rows[0].title,
                  url: existingResult.rows[0].url,
                  favicon: existingResult.rows[0].favicon,
                  sort_order: existingResult.rows[0].sort_order,
                },
                clientData: { ...op.data, version: op.clientVersion },
              });
              continue;
            }

            const updateResult = await db.query(
              `UPDATE collection_tabs
               SET title = $1, url = $2, favicon = $3, sort_order = $4, version = $5
               WHERE id = $6 AND version = $7
               RETURNING id, version`,
              [
                op.data.title as string,
                op.data.url as string,
                op.data.favicon as string,
                (op.data.sort_order as number) || 0,
                currentVersion,
                existingResult.rows[0].id,
                serverVersion,
              ]
            );

            if (updateResult.rows.length === 0) {
              conflicts.push({
                entityType: "tab",
                entityId: op.entityId!,
                serverData: { version: serverVersion },
                clientData: { ...op.data, version: op.clientVersion },
              });
              continue;
            }
            await logOperation(userId, "UPDATE", "tab", op.entityId!, op.collectionId, op.data, currentVersion);
          }
        }
      }

      response.serverVersion = currentVersion;
    }

    const serverOperationsResult = await db.query(
      `SELECT id, action, entity_type, entity_id, collection_id, data, version, created_at
       FROM sync_log
       WHERE user_id = $1 AND id > $2
       ORDER BY id ASC`,
      [userId, effectiveLastSync]
    );

    response.operations = serverOperationsResult.rows.map((row) => ({
      id: row.id,
      type: row.action as "ADD" | "UPDATE" | "DELETE",
      entityType: row.entity_type as "collection" | "tab",
      entityId: row.entity_id,
      collectionId: row.collection_id || undefined,
      data: row.data as Record<string, unknown>,
      version: row.version,
      timestamp: row.created_at,
    }));

    if (response.operations.length > 0) {
      response.serverVersion = response.operations[response.operations.length - 1].version;
    }

    await db.query(
      `INSERT INTO client_sync (user_id, device_id, last_sync_version, last_sync_time)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, device_id)
       DO UPDATE SET last_sync_version = $3, last_sync_time = CURRENT_TIMESTAMP`,
      [userId, deviceId, response.serverVersion]
    );

    if (conflicts.length > 0) {
      response.conflicts = conflicts;
    }

    ctx.response.body = response;
  } catch (error) {
    console.error("Error in incremental sync:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
};
