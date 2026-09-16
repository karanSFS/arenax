import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "arenax";

if (!MONGODB_URI) {
  throw new Error(
    "❌ MONGODB_URI is not defined. Please set it in your .env.local file."
  );
}

// ─── Cached connection for Next.js HMR ───────────────────────────────────────
// In Next.js dev mode, hot reloads can create multiple connections.
// This singleton pattern prevents connection leaks.

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongoose ?? { conn: null, promise: null };
if (!global.mongoose) {
  global.mongoose = cached;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      dbName: MONGODB_DB_NAME,
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => {
      console.log("✅ MongoDB connected to:", MONGODB_DB_NAME);
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;
