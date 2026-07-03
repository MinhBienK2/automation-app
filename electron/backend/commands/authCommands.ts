import { commandError } from "../commandHelpers.js";
import {
  authenticateUser,
  verifyToken,
  listUsers,
  createUser,
  deleteUser,
  syncPullAll,
  getPgPool
} from "../persistence/pgSync.js";
import type { DatabaseSyncWrapper } from "../persistence/database.js";
import { PostgresDbConnection, runMigrations } from "../persistence/migrationRunner.js";
import { migrations } from "../persistence/migrations.js";

export function createAuthCommands(database: any) {
  const dbWrapper = database as DatabaseSyncWrapper;

  async function login(input: any) {
    const { email, password } = input;
    if (!email || !password) {
      throw commandError("Email and password are required", "email");
    }
    const result = await authenticateUser(email, password);
    if (!result) {
      throw commandError("Invalid email or password", "password");
    }
    
    // Set the owner ID on the database wrapper so that subsequent writes are replicated
    dbWrapper.ownerId = result.user.id;

    // Run Postgres migrations on login
    const pool = getPgPool();
    if (pool) {
      const conn = new PostgresDbConnection(pool);
      await runMigrations(conn, migrations);
    }
    
    // Pull all data for this user from PG to local SQLite
    await syncPullAll(dbWrapper, result.user.id);

    return result;
  }

  async function logout() {
    dbWrapper.ownerId = null;
    // Clear user tables in SQLite on logout to prevent data remnants
    dbWrapper.exec("PRAGMA foreign_keys = OFF");
    try {
      const tables = [
        "projects", "browser_profiles", "workflows", "subflows",
        "workflow_nodes", "workflow_edges", "subflow_nodes", "subflow_edges",
        "runs", "run_steps", "workflow_schedules", "workflow_schedule_events",
        "operational_attention_events", "workflow_revisions", "subflow_revisions"
      ];
      for (const table of tables) {
        dbWrapper.exec(`DELETE FROM ${table}`);
      }
    } finally {
      dbWrapper.exec("PRAGMA foreign_keys = ON");
    }
    return { ok: true };
  }

  async function me(input: { token: string }) {
    if (!input.token) return null;
    const user = await verifyToken(input.token);
    if (user) {
      dbWrapper.ownerId = user.id;

      // Run Postgres migrations on validation
      const pool = getPgPool();
      if (pool) {
        const conn = new PostgresDbConnection(pool);
        await runMigrations(conn, migrations);
      }
      
      // Sync on app startup / validation
      await syncPullAll(dbWrapper, user.id);
      return user;
    }
    return null;
  }

  async function listAllUsers() {
    return listUsers();
  }

  async function createNewUser(input: any) {
    const { email, password, role } = input;
    if (!email || !password || !role) {
      throw commandError("Email, password and role are required", "email");
    }
    return createUser(email, password, role);
  }

  async function removeUser(input: { id: string }) {
    if (!input.id) throw commandError("User ID is required", "id");
    await deleteUser(input.id);
    return { ok: true };
  }

  return {
    login,
    logout,
    me,
    listUsers: listAllUsers,
    createUser: createNewUser,
    deleteUser: removeUser,
  };
}
