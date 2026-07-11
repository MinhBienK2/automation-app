import { MongoClient } from "mongodb";
import pg from "pg";
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  }
}

async function check() {
  loadEnv();
  
  // 1. Check PostgreSQL runs
  const pgUrl = process.env.DATABASE_URL;
  console.log("--- PG Database Status ---");
  if (pgUrl) {
    const pool = new pg.Pool({ connectionString: pgUrl });
    try {
      const res = await pool.query("SELECT id, status, started_at, finished_at FROM runs ORDER BY started_at DESC LIMIT 5");
      console.log("Recent runs in PG (latest first):");
      if (res.rows.length === 0) {
        console.log("No runs found in PostgreSQL.");
      } else {
        res.rows.forEach(row => {
          console.log(`Run ID: ${row.id} | Status: ${row.status} | Started: ${row.started_at} | Finished: ${row.finished_at}`);
        });
      }
    } catch (err) {
      console.error("PG Query failed:", err);
    } finally {
      await pool.end();
    }
  } else {
    console.log("No DATABASE_URL set");
  }

  // 2. Check MongoDB run_steps
  const mongoUri = process.env.MONGODB_URI;
  console.log("\n--- MongoDB Database Status ---");
  if (mongoUri) {
    const client = new MongoClient(mongoUri);
    try {
      await client.connect();
      const db = client.db(process.env.MONGO_DB_NAME || "automation_app");
      const collection = db.collection("run_steps");
      
      const count = await collection.countDocuments();
      console.log(`Total documents in run_steps collection: ${count}`);
      
      if (count > 0) {
        console.log("\nSample run_steps documents (latest 5):");
        const steps = await collection.find({}).sort({ created_at: -1 }).limit(5).toArray();
        steps.forEach(step => {
          console.log(`Step ID: ${step.id || step._id} | Run ID: ${step.run_id} | Node: ${step.node_id} | Step#: ${step.step_number} | Action: ${step.action_type} | Status: ${step.status} | Created: ${step.created_at}`);
        });
      }
    } catch (err) {
      console.error("MongoDB operation failed:", err);
    } finally {
      await client.close();
    }
  } else {
    console.log("No MONGODB_URI set");
  }
}

check();
