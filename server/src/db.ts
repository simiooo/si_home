import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = {
  query: (text: string, params?: unknown[]) => pool.query(text, params),
  connect: () => pool.connect(),
};

export const initDatabase = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE,
      password_hash TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS tabs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      tab_id VARCHAR(255) NOT NULL,
      title TEXT,
      url TEXT,
      favicon TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, tab_id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS collections (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      collection_id VARCHAR(255) NOT NULL,
      title TEXT NOT NULL,
      order_num INTEGER DEFAULT 0,
      version BIGINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, collection_id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS collection_tabs (
      id SERIAL PRIMARY KEY,
      collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
      tab_id VARCHAR(255) NOT NULL,
      title TEXT,
      url TEXT,
      favicon TEXT,
      sort_order INTEGER DEFAULT 0,
      version BIGINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(collection_id, tab_id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS configs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      config JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS sync_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      action VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(255),
      collection_id VARCHAR(255),
      data JSONB,
      version BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS client_sync (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      device_id VARCHAR(255) NOT NULL,
      last_sync_version BIGINT DEFAULT 0,
      last_sync_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, device_id)
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tabs_user_id ON tabs(user_id)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_sync_log_user_id ON sync_log(user_id)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_sync_log_user_version ON sync_log(user_id, id)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_client_sync_user_device ON client_sync(user_id, device_id)
  `);

  await runMigrations();

  await initSyncVersionFunction();

  console.log("Database initialized successfully");
};

async function runMigrations() {
  const columnExists = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'collections' AND column_name = 'order_num'
  `);

  if (columnExists.rows.length === 0) {
    await db.query(`
      ALTER TABLE collections ADD COLUMN IF NOT EXISTS order_num INTEGER DEFAULT 0
    `);
    await db.query(`
      ALTER TABLE collections ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0
    `);
    await db.query(`
      ALTER TABLE collection_tabs ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0
    `);

    const collections = await db.query(`SELECT id FROM collections`);
    for (const collection of collections.rows) {
      await db.query(`UPDATE collections SET version = 1, order_num = id WHERE id = $1`, [collection.id]);
    }

    const tabs = await db.query(`SELECT id FROM collection_tabs`);
    for (const tab of tabs.rows) {
      await db.query(`UPDATE collection_tabs SET version = 1 WHERE id = $1`, [tab.id]);
    }

    console.log("Migrations applied successfully");
  }

  const constraintExists = await db.query(`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'sync_log' AND constraint_name = 'sync_log_user_version_unique'
  `);

  if (constraintExists.rows.length === 0) {
    await db.query(`
      ALTER TABLE sync_log ADD CONSTRAINT sync_log_user_version_unique
      UNIQUE (user_id, version)
    `);
  }
}

async function initSyncVersionFunction(): Promise<void> {
  await db.query(`
    CREATE OR REPLACE FUNCTION get_sync_version(user_id_param INTEGER)
    RETURNS BIGINT AS $$
    DECLARE
      seq_name TEXT;
      next_version BIGINT;
    BEGIN
      seq_name := 'sync_version_' || user_id_param;

      EXECUTE format(
        'CREATE SEQUENCE IF NOT EXISTS %I',
        seq_name
      );

      EXECUTE format(
        'SELECT nextval(%L) FROM (SELECT 1) AS dummy',
        seq_name
      ) INTO next_version;

      RETURN next_version;
    END;
    $$ LANGUAGE plpgsql
  `);
}
