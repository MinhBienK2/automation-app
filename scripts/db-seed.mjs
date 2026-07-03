import { getDbConnection } from "./lib/db-cli-helper.mjs";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

async function main() {
  let dbInfo;
  try {
    dbInfo = await getDbConnection();
    const conn = dbInfo.connection;

    if (conn.type === "postgres") {
      console.log("[db-seed] Seeding Postgres database...");
      const result = await conn.query("SELECT COUNT(*) FROM users WHERE email = $1", ["admin@gmail.com"]);
      const count = parseInt(result[0].count, 10);
      
      if (count === 0) {
        const passwordHash = bcrypt.hashSync("admin", 10);
        const id = crypto.randomUUID();
        await conn.query(
          `INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)`,
          [id, "admin@gmail.com", passwordHash, "admin"]
        );
        console.log("[db-seed] Seeded default admin user: admin@gmail.com / admin");
      } else {
        console.log("[db-seed] Admin user admin@gmail.com already exists. Skipping.");
      }
    } else {
      console.log("[db-seed] SQLite database does not require authentication seeding (single-user mode). Skipping.");
    }
    
    console.log("[db-seed] Seeding completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("[db-seed] Seeding failed:", error);
    process.exit(1);
  } finally {
    if (dbInfo && dbInfo.close) {
      await dbInfo.close();
    }
  }
}

main();
