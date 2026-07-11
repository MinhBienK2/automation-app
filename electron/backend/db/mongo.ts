import { MongoClient, type Collection, type Document } from "mongodb";
import fs from "node:fs";
import path from "node:path";

export interface MongoRunStep extends Document {
  id: string;
  run_id: string;
  node_id: string;
  step_number: number;
  action_type: string;
  status: "success" | "failed" | "stopped" | "skipped";
  started_at: string | null;
  finished_at: string | null;
  trace: Record<string, any> | null;
  error: Record<string, any> | null;
  owner_id: string | null;
  created_at: string;
}

let mongoClient: MongoClient | null = null;

export async function getMongoClient(): Promise<MongoClient | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return null;
  }
  if (mongoClient) {
    return mongoClient;
  }
  try {
    console.log("[mongo] Connecting to MongoDB...");
    mongoClient = new MongoClient(uri, {
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    await mongoClient.connect();
    console.log("[mongo] Connected to MongoDB successfully.");
    return mongoClient;
  } catch (error) {
    console.error("[mongo] Failed to connect to MongoDB:", error);
    mongoClient = null;
    return null;
  }
}

export async function getMongoCollection<T extends Document = any>(
  collectionName: string,
): Promise<Collection<T> | null> {
  const client = await getMongoClient();
  if (!client) {
    return null;
  }
  const dbName = process.env.MONGO_DB_NAME || "automation_app";
  return client.db(dbName).collection<T>(collectionName);
}

export async function closeMongoClient(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    console.log("[mongo] MongoDB connection closed.");
  }
}

export async function checkMongoMigrationsPending(appPath: string): Promise<string[]> {
  // If MONGODB_URI is not set in env, skip MongoDB migration checks
  if (!process.env.MONGODB_URI) {
    return [];
  }

  const client = await getMongoClient();
  if (!client) {
    throw new Error("Failed to connect to MongoDB");
  }

  const dbName = process.env.MONGO_DB_NAME || "automation_app";
  const db = client.db(dbName);
  const collection = db.collection("migration_history");

  // Get all applied migrations
  const appliedDocs = await collection.find({}, { projection: { fileName: 1 } }).toArray();
  const applied = new Set<string>(appliedDocs.map((doc: any) => doc.fileName));

  // Read local migration files from migrations-mongo directory
  const migrationsDir = path.join(appPath, "migrations-mongo");
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const localFiles = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".js"))
    .sort();

  // Find files that are in the directory but not in migration_history
  const pending = localFiles.filter((file) => !applied.has(file));
  return pending;
}

