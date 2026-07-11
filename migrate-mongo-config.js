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

// Load .env variables before configuring migrate-mongo
loadEnv();

const config = {
  mongodb: {
    url: process.env.MONGODB_URI || "mongodb://localhost:27017",
    databaseName: process.env.MONGO_DB_NAME || "automation_app",
    options: {
      // Connect options if needed
    }
  },
  // The migrations directory, can be an absolute or relative path
  migrationsDir: "migrations-mongo",
  // The mongodb collection where the applied migrations are stored
  changelogCollectionName: "migration_history",
  // The file extension to use for migration files
  migrationFileExtension: ".js",
  // Enable the algorithm to calculate directory hashes in database to prevent changes
  useFileHash: false,
  // Specifies the system to load/import migrations ("commonjs" or "esm")
  moduleSystem: "esm"
};

export default config;
