import pg from "pg";
import { DatabaseSync } from "node:sqlite";
import type { AppConfig } from "./config.js";

export class PostgresSyncService {
  private client: pg.Client | null = null;

  constructor(private readonly config: AppConfig) {
    if (config.dbMode === "publish" && config.postgresUrl) {
      this.client = new pg.Client({ connectionString: config.postgresUrl });
    }
  }

  isEnabled(): boolean {
    return this.config.dbMode === "publish" && !!this.config.postgresUrl;
  }

  async connect(): Promise<void> {
    if (!this.client) return;
    await this.client.connect();
    await this.ensureTablesExist();
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  private async ensureTablesExist(): Promise<void> {
    if (!this.client) return;

    // Create Postgres schemas
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS browser_profiles (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        is_default INTEGER NOT NULL DEFAULT 0,
        browser_launch_json TEXT NOT NULL,
        environment_json TEXT NOT NULL DEFAULT '{"variables":[]}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        browser_profile_id TEXT,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        settings_json TEXT,
        graph_version INTEGER,
        viewport_json TEXT,
        migration_notes_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS subflows (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        graph_version INTEGER,
        viewport_json TEXT,
        migration_notes_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        settings_snapshot_json TEXT,
        graph_snapshot_json TEXT,
        outputs_json TEXT,
        error_json TEXT
      );

      CREATE TABLE IF NOT EXISTS run_steps (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        node_id TEXT,
        step_number INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        trace_json TEXT,
        error_json TEXT
      );

      CREATE TABLE IF NOT EXISTS workflow_schedules (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        name TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        kind_json TEXT NOT NULL,
        next_run_at TEXT,
        last_event_at TEXT,
        last_status TEXT,
        last_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workflow_schedule_events (
        id TEXT PRIMARY KEY,
        schedule_id TEXT NOT NULL,
        workflow_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        run_id TEXT,
        scheduled_for TEXT NOT NULL,
        created_at TEXT NOT NULL,
        reason TEXT,
        details_json TEXT
      );

      CREATE TABLE IF NOT EXISTS operational_attention_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        source TEXT NOT NULL,
        workflow_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        severity TEXT NOT NULL,
        summary TEXT NOT NULL,
        details_json TEXT
      );

      CREATE TABLE IF NOT EXISTS workflow_nodes (
        id TEXT NOT NULL,
        workflow_id TEXT NOT NULL,
        node_type TEXT NOT NULL,
        action_type TEXT,
        config_version INTEGER NOT NULL DEFAULT 1,
        config_json TEXT NOT NULL,
        position_x REAL NOT NULL DEFAULT 0,
        position_y REAL NOT NULL DEFAULT 0,
        label TEXT,
        notes TEXT,
        subflow_ref TEXT,
        ports_json TEXT NOT NULL DEFAULT '[]',
        ordinal INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (workflow_id, id)
      );

      CREATE TABLE IF NOT EXISTS workflow_edges (
        id TEXT NOT NULL,
        workflow_id TEXT NOT NULL,
        source_node_id TEXT NOT NULL,
        source_handle TEXT,
        target_node_id TEXT NOT NULL,
        target_handle TEXT,
        edge_kind TEXT NOT NULL DEFAULT 'flow',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        ordinal INTEGER NOT NULL,
        PRIMARY KEY (workflow_id, id)
      );

      CREATE TABLE IF NOT EXISTS subflow_nodes (
        id TEXT NOT NULL,
        subflow_id TEXT NOT NULL,
        node_type TEXT NOT NULL,
        action_type TEXT,
        config_version INTEGER NOT NULL DEFAULT 1,
        config_json TEXT NOT NULL,
        position_x REAL NOT NULL DEFAULT 0,
        position_y REAL NOT NULL DEFAULT 0,
        label TEXT,
        notes TEXT,
        subflow_ref TEXT,
        ports_json TEXT NOT NULL DEFAULT '[]',
        ordinal INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (subflow_id, id)
      );

      CREATE TABLE IF NOT EXISTS subflow_edges (
        id TEXT NOT NULL,
        subflow_id TEXT NOT NULL,
        source_node_id TEXT NOT NULL,
        source_handle TEXT,
        target_node_id TEXT NOT NULL,
        target_handle TEXT,
        edge_kind TEXT NOT NULL DEFAULT 'flow',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        ordinal INTEGER NOT NULL,
        PRIMARY KEY (subflow_id, id)
      );

      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workflow_revisions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        revision_number INTEGER NOT NULL,
        graph_snapshot_json TEXT NOT NULL,
        settings_snapshot_json TEXT,
        created_at TEXT NOT NULL,
        created_by TEXT,
        comment TEXT,
        tag TEXT,
        size_bytes INTEGER NOT NULL,
        UNIQUE(workflow_id, revision_number)
      );

      CREATE TABLE IF NOT EXISTS subflow_revisions (
        id TEXT PRIMARY KEY,
        subflow_id TEXT NOT NULL,
        revision_number INTEGER NOT NULL,
        graph_snapshot_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_by TEXT,
        comment TEXT,
        tag TEXT,
        size_bytes INTEGER NOT NULL,
        UNIQUE(subflow_id, revision_number)
      );
    `);
  }

  async syncFromLocal(db: DatabaseSync): Promise<void> {
    if (!this.client) return;

    // Push local data into Postgres
    const tables = [
      { name: "projects", pkey: ["id"] },
      { name: "browser_profiles", pkey: ["id"] },
      { name: "workflows", pkey: ["id"] },
      { name: "subflows", pkey: ["id"] },
      { name: "runs", pkey: ["id"] },
      { name: "run_steps", pkey: ["id"] },
      { name: "workflow_schedules", pkey: ["id"] },
      { name: "workflow_schedule_events", pkey: ["id"] },
      { name: "operational_attention_events", pkey: ["id"] },
      { name: "workflow_nodes", pkey: ["workflow_id", "id"] },
      { name: "workflow_edges", pkey: ["workflow_id", "id"] },
      { name: "subflow_nodes", pkey: ["subflow_id", "id"] },
      { name: "subflow_edges", pkey: ["subflow_id", "id"] },
      { name: "app_meta", pkey: ["key"] },
      { name: "workflow_revisions", pkey: ["id"] },
      { name: "subflow_revisions", pkey: ["id"] },
    ];

    for (const table of tables) {
      // Get all columns from table info
      const columns = db
        .prepare(`PRAGMA table_info(${table.name})`)
        .all()
        .map((row) => (row as { name: string }).name);

      const rows = db.prepare(`SELECT * FROM ${table.name}`).all() as any[];

      for (const row of rows) {
        const colList = columns.join(", ");
        const valList = columns.map((_, i) => `$${i + 1}`).join(", ");
        const updateList = columns
          .filter((col) => !table.pkey.includes(col))
          .map((col) => `${col} = $${columns.indexOf(col) + 1}`)
          .join(", ");


        const values = columns.map((col) => {
          const val = row[col];
          // Handle object type mapping
          return val === null ? null : val;
        });

        let query = `INSERT INTO ${table.name} (${colList}) VALUES (${valList})`;
        if (updateList) {
          query += ` ON CONFLICT (${table.pkey.join(", ")}) DO UPDATE SET ${updateList}`;
        } else {
          query += ` ON CONFLICT (${table.pkey.join(", ")}) DO NOTHING`;
        }

        await this.client.query(query, values);
      }
    }
  }

  async syncToLocal(db: DatabaseSync): Promise<void> {
    if (!this.client) return;

    // Pull from PostgreSQL into SQLite
    const tables = [
      { name: "projects", pkey: ["id"] },
      { name: "browser_profiles", pkey: ["id"] },
      { name: "workflows", pkey: ["id"] },
      { name: "subflows", pkey: ["id"] },
      { name: "runs", pkey: ["id"] },
      { name: "run_steps", pkey: ["id"] },
      { name: "workflow_schedules", pkey: ["id"] },
      { name: "workflow_schedule_events", pkey: ["id"] },
      { name: "operational_attention_events", pkey: ["id"] },
      { name: "workflow_nodes", pkey: ["workflow_id", "id"] },
      { name: "workflow_edges", pkey: ["workflow_id", "id"] },
      { name: "subflow_nodes", pkey: ["subflow_id", "id"] },
      { name: "subflow_edges", pkey: ["subflow_id", "id"] },
      { name: "app_meta", pkey: ["key"] },
      { name: "workflow_revisions", pkey: ["id"] },
      { name: "subflow_revisions", pkey: ["id"] },
    ];

    for (const table of tables) {
      const res = await this.client.query(`SELECT * FROM ${table.name}`);
      const columns = db
        .prepare(`PRAGMA table_info(${table.name})`)
        .all()
        .map((row) => (row as { name: string }).name);

      for (const row of res.rows) {
        const colList = columns.join(", ");
        const valList = columns.map(() => "?").join(", ");
        const values = columns.map((col) => row[col]);

        db.prepare(`INSERT OR REPLACE INTO ${table.name} (${colList}) VALUES (${valList})`).run(...values);
      }
    }
  }

  // Hook functions to execute async replication for single entities
  async publishEntity(table: string, pkeys: string[], row: any): Promise<void> {
    if (!this.client) return;
    const columns = Object.keys(row);
    const colList = columns.join(", ");
    const valList = columns.map((_, i) => `$${i + 1}`).join(", ");
    const updateList = columns
      .filter((col) => !pkeys.includes(col))
      .map((col) => `${col} = $${columns.indexOf(col) + 1}`)
      .join(", ");


    let query = `INSERT INTO ${table} (${colList}) VALUES (${valList})`;
    if (updateList) {
      query += ` ON CONFLICT (${pkeys.join(", ")}) DO UPDATE SET ${updateList}`;
    } else {
      query += ` ON CONFLICT (${pkeys.join(", ")}) DO NOTHING`;
    }

    const values = columns.map((col) => row[col]);
    await this.client.query(query, values);
  }

  async deleteEntity(table: string, pkeyNames: string[], values: any[]): Promise<void> {
    if (!this.client) return;
    const matchClause = pkeyNames.map((col, i) => `${col} = $${i + 1}`).join(" AND ");
    const query = `DELETE FROM ${table} WHERE ${matchClause}`;
    await this.client.query(query, values);
  }

  async exec(sql: string): Promise<void> {
    if (!this.client) return;
    const translated = translatePostgresSql(sql);
    await this.client.query(translated);
  }

  async query(sql: string, params: any[] = []): Promise<{ rows: any[]; changes?: number }> {
    if (!this.client) return { rows: [] };
    const translated = translatePostgresSql(sql);
    const res = await this.client.query(translated, params);
    return {
      rows: res.rows,
      changes: res.rowCount ?? undefined,
    };
  }
}

import { StatementSync } from "node:sqlite";
import { translatePostgresSql } from "./dbClient.js";

export function createSyncInterceptor(db: DatabaseSync, syncService: PostgresSyncService): DatabaseSync {
  if (!syncService.isEnabled()) return db;

  const isWriteQuery = (sql: string): boolean => {
    const s = sql.trim().toUpperCase();
    return s.startsWith("INSERT") ||
           s.startsWith("UPDATE") ||
           s.startsWith("DELETE") ||
           s.startsWith("REPLACE") ||
           s.startsWith("BEGIN") ||
           s.startsWith("COMMIT") ||
           s.startsWith("ROLLBACK") ||
           s.startsWith("ALTER") ||
           s.startsWith("DROP");
  };

  const interceptedPrepare = (sql: string): StatementSync => {
    const originalStmt = db.prepare(sql);
    const write = isWriteQuery(sql);

    return {
      run(...args: any[]) {
        const res = originalStmt.run(...args);
        if (write) {
          syncService.query(sql, args).catch((err) => {
            console.error("[PostgresSyncService] Sync write error:", err);
          });
        }
        return res;
      },
      get(...args: any[]) {
        return originalStmt.get(...args);
      },
      all(...args: any[]) {
        return originalStmt.all(...args);
      },
    } as unknown as StatementSync;
  };

  return new Proxy(db, {
    get(target, prop, receiver) {
      if (prop === "prepare") {
        return interceptedPrepare;
      }
      if (prop === "exec") {
        return (sql: string) => {
          db.exec(sql);
          if (isWriteQuery(sql)) {
            syncService.exec(sql).catch((err) => {
              console.error("[PostgresSyncService] Sync exec error:", err);
            });
          }
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
