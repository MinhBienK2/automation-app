import type { DbConnection } from "../electron/backend/persistence/migrationRunner.js";

async function tableInfo(db: DbConnection, table: string): Promise<Set<string>> {
  const rows = await db.query(`PRAGMA table_info(${table})`);
  return new Set(rows.map((row: any) => row.name));
}

async function tableExists(db: DbConnection, table: string): Promise<boolean> {
  const rows = await db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table]);
  return rows.length > 0;
}

export async function up(db: DbConnection): Promise<void> {
  if (db.type === "postgres") {
    // Postgres schema (fresh installation is assumed, no legacy Postgres upgrades exist)
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at VARCHAR(255) NOT NULL,
        updated_at VARCHAR(255) NOT NULL,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS browser_profiles (
        id VARCHAR(255) PRIMARY KEY,
        project_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        is_default INTEGER NOT NULL DEFAULT 0,
        browser_launch_json TEXT NOT NULL,
        environment_json TEXT NOT NULL DEFAULT '{"variables":[]}',
        created_at VARCHAR(255) NOT NULL,
        updated_at VARCHAR(255) NOT NULL,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS workflows (
        id VARCHAR(255) PRIMARY KEY,
        project_id VARCHAR(255),
        browser_profile_id VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        settings_json TEXT,
        graph_version INTEGER,
        viewport_json TEXT,
        migration_notes_json TEXT NOT NULL DEFAULT '[]',
        created_at VARCHAR(255) NOT NULL,
        updated_at VARCHAR(255) NOT NULL,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS subflows (
        id VARCHAR(255) PRIMARY KEY,
        project_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        graph_version INTEGER,
        viewport_json TEXT,
        migration_notes_json TEXT NOT NULL DEFAULT '[]',
        created_at VARCHAR(255) NOT NULL,
        updated_at VARCHAR(255) NOT NULL,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS workflow_nodes (
        id VARCHAR(255) NOT NULL,
        workflow_id VARCHAR(255) NOT NULL,
        node_type VARCHAR(255) NOT NULL,
        action_type VARCHAR(255),
        config_version INTEGER NOT NULL DEFAULT 1,
        config_json TEXT NOT NULL,
        position_x DOUBLE PRECISION NOT NULL DEFAULT 0,
        position_y DOUBLE PRECISION NOT NULL DEFAULT 0,
        label VARCHAR(255),
        notes TEXT,
        subflow_ref VARCHAR(255),
        ports_json TEXT NOT NULL DEFAULT '[]',
        ordinal INTEGER NOT NULL,
        created_at VARCHAR(255) NOT NULL,
        updated_at VARCHAR(255) NOT NULL,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (workflow_id, id)
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS workflow_edges (
        id VARCHAR(255) NOT NULL,
        workflow_id VARCHAR(255) NOT NULL,
        source_node_id VARCHAR(255) NOT NULL,
        source_handle VARCHAR(255),
        target_node_id VARCHAR(255) NOT NULL,
        target_handle VARCHAR(255),
        edge_kind VARCHAR(255) NOT NULL DEFAULT 'flow',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        ordinal INTEGER NOT NULL,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (workflow_id, id)
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS subflow_nodes (
        id VARCHAR(255) NOT NULL,
        subflow_id VARCHAR(255) NOT NULL,
        node_type VARCHAR(255) NOT NULL,
        action_type VARCHAR(255),
        config_version INTEGER NOT NULL DEFAULT 1,
        config_json TEXT NOT NULL,
        position_x DOUBLE PRECISION NOT NULL DEFAULT 0,
        position_y DOUBLE PRECISION NOT NULL DEFAULT 0,
        label VARCHAR(255),
        notes TEXT,
        subflow_ref VARCHAR(255),
        ports_json TEXT NOT NULL DEFAULT '[]',
        ordinal INTEGER NOT NULL,
        created_at VARCHAR(255) NOT NULL,
        updated_at VARCHAR(255) NOT NULL,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (subflow_id, id)
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS subflow_edges (
        id VARCHAR(255) NOT NULL,
        subflow_id VARCHAR(255) NOT NULL,
        source_node_id VARCHAR(255) NOT NULL,
        source_handle VARCHAR(255),
        target_node_id VARCHAR(255) NOT NULL,
        target_handle VARCHAR(255),
        edge_kind VARCHAR(255) NOT NULL DEFAULT 'flow',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        ordinal INTEGER NOT NULL,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (subflow_id, id)
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS runs (
        id VARCHAR(255) PRIMARY KEY,
        workflow_id VARCHAR(255) NOT NULL,
        source VARCHAR(50) NOT NULL DEFAULT 'manual',
        status VARCHAR(50) NOT NULL,
        started_at VARCHAR(255) NOT NULL,
        finished_at VARCHAR(255),
        settings_snapshot_json TEXT,
        graph_snapshot_json TEXT,
        outputs_json TEXT,
        error_json TEXT,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS run_steps (
        id VARCHAR(255) PRIMARY KEY,
        run_id VARCHAR(255) NOT NULL,
        node_id VARCHAR(255),
        step_number INTEGER NOT NULL,
        action_type VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        started_at VARCHAR(255),
        finished_at VARCHAR(255),
        trace_json TEXT,
        error_json TEXT,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS workflow_schedules (
        id VARCHAR(255) PRIMARY KEY,
        workflow_id VARCHAR(255) NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        enabled INTEGER NOT NULL,
        kind_json TEXT NOT NULL,
        next_run_at VARCHAR(255),
        last_event_at VARCHAR(255),
        last_status VARCHAR(255),
        last_reason TEXT,
        created_at VARCHAR(255) NOT NULL,
        updated_at VARCHAR(255) NOT NULL,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS workflow_schedule_events (
        id VARCHAR(255) PRIMARY KEY,
        schedule_id VARCHAR(255) NOT NULL REFERENCES workflow_schedules(id) ON DELETE CASCADE,
        workflow_id VARCHAR(255) NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        event_type VARCHAR(255) NOT NULL,
        run_id VARCHAR(255),
        scheduled_for VARCHAR(255) NOT NULL,
        created_at VARCHAR(255) NOT NULL,
        reason TEXT,
        details_json TEXT,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS operational_attention_events (
        id VARCHAR(255) PRIMARY KEY,
        event_type VARCHAR(255) NOT NULL,
        source VARCHAR(255) NOT NULL,
        workflow_id VARCHAR(255) NOT NULL,
        created_at VARCHAR(255) NOT NULL,
        severity VARCHAR(50) NOT NULL,
        summary TEXT NOT NULL,
        details_json TEXT,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS workflow_revisions (
        id VARCHAR(255) PRIMARY KEY,
        workflow_id VARCHAR(255) NOT NULL,
        revision_number INTEGER NOT NULL,
        graph_snapshot_json TEXT NOT NULL,
        settings_snapshot_json TEXT,
        created_at VARCHAR(255) NOT NULL,
        created_by VARCHAR(255),
        comment TEXT,
        tag VARCHAR(255),
        size_bytes INTEGER NOT NULL,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS subflow_revisions (
        id VARCHAR(255) PRIMARY KEY,
        subflow_id VARCHAR(255) NOT NULL,
        revision_number INTEGER NOT NULL,
        graph_snapshot_json TEXT NOT NULL,
        created_at VARCHAR(255) NOT NULL,
        created_by VARCHAR(255),
        comment TEXT,
        tag VARCHAR(255),
        size_bytes INTEGER NOT NULL,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS migration_log (
        id VARCHAR(255) PRIMARY KEY,
        target_table VARCHAR(255) NOT NULL,
        target_id VARCHAR(255) NOT NULL,
        started_at VARCHAR(255) NOT NULL,
        finished_at VARCHAR(255),
        from_version INTEGER,
        to_version INTEGER,
        applied_json TEXT,
        failure_json TEXT
      );
    `);
  } else {
    // SQLite schema
    await db.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS browser_profiles (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        is_default INTEGER NOT NULL DEFAULT 0,
        browser_launch_json TEXT NOT NULL,
        environment_json TEXT NOT NULL DEFAULT '{"variables":[]}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS subflows (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        settings_snapshot_json TEXT,
        graph_snapshot_json TEXT,
        outputs_json TEXT,
        error_json TEXT,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
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
        error_json TEXT,
        FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
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
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS workflow_schedule_events (
        id TEXT PRIMARY KEY,
        schedule_id TEXT NOT NULL,
        workflow_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        run_id TEXT,
        scheduled_for TEXT NOT NULL,
        created_at TEXT NOT NULL,
        reason TEXT,
        details_json TEXT,
        FOREIGN KEY (schedule_id) REFERENCES workflow_schedules(id) ON DELETE CASCADE,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS operational_attention_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        source TEXT NOT NULL,
        workflow_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        severity TEXT NOT NULL,
        summary TEXT NOT NULL,
        details_json TEXT,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS migration_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_table TEXT NOT NULL,
        target_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        from_version INTEGER,
        to_version INTEGER,
        applied_json TEXT NOT NULL,
        failure_json TEXT
      );
    `);

    await db.query(`
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
        PRIMARY KEY (workflow_id, id),
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
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
        PRIMARY KEY (workflow_id, id),
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
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
        PRIMARY KEY (subflow_id, id),
        FOREIGN KEY (subflow_id) REFERENCES subflows(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
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
        PRIMARY KEY (subflow_id, id),
        FOREIGN KEY (subflow_id) REFERENCES subflows(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    await db.query(`
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
        UNIQUE(workflow_id, revision_number),
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
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
        UNIQUE(subflow_id, revision_number),
        FOREIGN KEY (subflow_id) REFERENCES subflows(id) ON DELETE CASCADE
      );
    `);

    // Perform SQLite dynamic legacy migrations if tables already existed
    const workflowCols = await tableInfo(db, "workflows");
    if (!workflowCols.has("description")) {
      await db.query("ALTER TABLE workflows ADD COLUMN description TEXT NOT NULL DEFAULT ''");
    }
    if (!workflowCols.has("tags_json")) {
      await db.query("ALTER TABLE workflows ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'");
    }
    if (!workflowCols.has("settings_json")) {
      await db.query("ALTER TABLE workflows ADD COLUMN settings_json TEXT");
    }
    if (!workflowCols.has("project_id")) {
      await db.query("ALTER TABLE workflows ADD COLUMN project_id TEXT");
    }
    if (!workflowCols.has("graph_version")) {
      await db.query("ALTER TABLE workflows ADD COLUMN graph_version INTEGER");
    }
    if (!workflowCols.has("viewport_json")) {
      await db.query("ALTER TABLE workflows ADD COLUMN viewport_json TEXT");
    }
    if (!workflowCols.has("migration_notes_json")) {
      await db.query("ALTER TABLE workflows ADD COLUMN migration_notes_json TEXT NOT NULL DEFAULT '[]'");
    }
    if (!workflowCols.has("browser_profile_id")) {
      await db.query("ALTER TABLE workflows ADD COLUMN browser_profile_id TEXT");
    }

    const subflowCols = await tableInfo(db, "subflows");
    if (!subflowCols.has("graph_version")) {
      await db.query("ALTER TABLE subflows ADD COLUMN graph_version INTEGER");
    }
    if (!subflowCols.has("viewport_json")) {
      await db.query("ALTER TABLE subflows ADD COLUMN viewport_json TEXT");
    }
    if (!subflowCols.has("migration_notes_json")) {
      await db.query("ALTER TABLE subflows ADD COLUMN migration_notes_json TEXT NOT NULL DEFAULT '[]'");
    }

    const runCols = await tableInfo(db, "runs");
    if (!runCols.has("source")) {
      await db.query("ALTER TABLE runs ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");
      await db.query(`
        UPDATE runs
        SET source = 'schedule'
        WHERE id IN (
          SELECT DISTINCT run_id
          FROM workflow_schedule_events
          WHERE event_type = 'started'
            AND run_id IS NOT NULL
        )
      `);
    }

    const profileCols = await tableInfo(db, "browser_profiles");
    if (profileCols.size > 0 && !profileCols.has("environment_json")) {
      await db.query("ALTER TABLE browser_profiles ADD COLUMN environment_json TEXT NOT NULL DEFAULT '{\"variables\":[]}'");
    }

    if (await tableExists(db, "project_environments")) {
      await db.query(`
        INSERT OR IGNORE INTO browser_profiles (id, project_id, name, description, is_default, browser_launch_json, created_at, updated_at)
        SELECT id, project_id, name, description, is_default, browser_launch_json, created_at, updated_at
        FROM project_environments;
      `);
      await db.query("DROP TABLE project_environments;");
    }

    if (workflowCols.has("environment_id")) {
      await db.query(`
        UPDATE workflows
        SET browser_profile_id = environment_id
        WHERE browser_profile_id IS NULL AND environment_id IS NOT NULL;
      `);
    }

    // Create Indexes
    await db.query("CREATE INDEX IF NOT EXISTS idx_runs_workflow_started_at ON runs(workflow_id, started_at DESC)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_run_steps_run_step_number ON run_steps(run_id, step_number)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_workflow_schedules_enabled_next_run_at ON workflow_schedules(enabled, next_run_at)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_workflow_schedule_events_schedule_created_at ON workflow_schedule_events(schedule_id, created_at DESC)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_workflow_schedule_events_workflow_created_at ON workflow_schedule_events(workflow_id, created_at DESC)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_operational_attention_events_created_at ON operational_attention_events(created_at DESC)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_operational_attention_events_workflow_created_at ON operational_attention_events(workflow_id, created_at DESC)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_browser_profiles_project_default ON browser_profiles(project_id, is_default)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_subflows_project_updated_at ON subflows(project_id, updated_at DESC)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_workflows_project_updated_at ON workflows(project_id, updated_at DESC)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_runs_source_started_at ON runs(source, started_at DESC)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_workflow_revisions_workflow_created ON workflow_revisions(workflow_id, created_at DESC)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_workflow_revisions_tag ON workflow_revisions(workflow_id, tag) WHERE tag IS NOT NULL");
    await db.query("CREATE INDEX IF NOT EXISTS idx_subflow_revisions_subflow_created ON subflow_revisions(subflow_id, created_at DESC)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_subflow_revisions_tag ON subflow_revisions(subflow_id, tag) WHERE tag IS NOT NULL");
    await db.query("CREATE INDEX IF NOT EXISTS idx_workflow_nodes_workflow ON workflow_nodes(workflow_id, ordinal)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_workflow_nodes_action_type ON workflow_nodes(action_type)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_workflow_nodes_subflow_ref ON workflow_nodes(subflow_ref)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_workflow_edges_workflow ON workflow_edges(workflow_id, ordinal)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_workflow_edges_source ON workflow_edges(source_node_id)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_workflow_edges_target ON workflow_edges(target_node_id)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_subflow_nodes_subflow ON subflow_nodes(subflow_id, ordinal)");
    await db.query("CREATE INDEX IF NOT EXISTS idx_subflow_edges_subflow ON subflow_edges(subflow_id, ordinal)");
  }
}

export async function down(db: DbConnection): Promise<void> {
  const tables = [
    "subflow_revisions",
    "workflow_revisions",
    "app_meta",
    "subflow_edges",
    "subflow_nodes",
    "workflow_edges",
    "workflow_nodes",
    "migration_log",
    "operational_attention_events",
    "workflow_schedule_events",
    "workflow_schedules",
    "run_steps",
    "runs",
    "subflows",
    "workflows",
    "browser_profiles",
    "projects",
    "users"
  ];

  for (const table of tables) {
    if (db.type === "postgres") {
      await db.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    } else {
      await db.query(`DROP TABLE IF EXISTS ${table}`);
    }
  }
}
