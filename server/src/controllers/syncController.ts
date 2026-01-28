import { db } from "../db.js";
import type { RouterContext } from "@oak/oak";
import type { AuthState } from "../middleware/authMiddleware.js";

export const getAllData = async (ctx: RouterContext<string, AuthState>) => {
  const userId = ctx.state.userId;

  if (!userId) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Unauthorized" };
    return;
  }

  try {
    const tabsResult = await db.query("SELECT tab_id, title, url, favicon, updated_at FROM tabs WHERE user_id = $1", [userId]);
    const collectionsResult = await db.query(
      "SELECT collection_id, title, updated_at FROM collections WHERE user_id = $1",
      [userId]
    );
    const configResult = await db.query("SELECT config, updated_at FROM configs WHERE user_id = $1", [userId]);

    const collectionTabs: Record<string, { tab_id: string; title: string; url: string; favicon: string; sort_order: number }[]> = {};

    for (const collection of collectionsResult.rows) {
      const tabs = await db.query(
        "SELECT tab_id, title, url, favicon, sort_order FROM collection_tabs WHERE collection_id = (SELECT id FROM collections WHERE collection_id = $1 AND user_id = $2) ORDER BY sort_order",
        [collection.collection_id, userId]
      );
      collectionTabs[collection.collection_id] = tabs.rows;
    }

    ctx.response.body = {
      tabs: tabsResult.rows,
      collections: collectionsResult.rows,
      collectionTabs,
      config: configResult.rows[0]?.config || null,
      lastSync: Date.now(),
    };
  } catch (error) {
    console.error("Error fetching all data:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
};

export const syncConfig = async (ctx: RouterContext<string, AuthState>) => {
  const userId = ctx.state.userId;

  if (!userId) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Unauthorized" };
    return;
  }

  try {
    const { config } = await ctx.request.body.json() as { config: unknown };

    if (!config) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Config is required" };
      return;
    }

    await db.query(
      "INSERT INTO configs (user_id, config) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET config = EXCLUDED.config, updated_at = CURRENT_TIMESTAMP",
      [userId, JSON.stringify(config)]
    );

    ctx.response.body = { message: "Config synced successfully" };
  } catch (error) {
    console.error("Error syncing config:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
};


