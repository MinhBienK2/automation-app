import { MongoClient, type Collection, type Document } from "mongodb";

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
  return client.db().collection<T>(collectionName);
}

export async function closeMongoClient(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    console.log("[mongo] MongoDB connection closed.");
  }
}
