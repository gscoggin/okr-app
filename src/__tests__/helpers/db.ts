/**
 * Test database helpers.
 * Each test file calls connectTestDB / disconnectTestDB in beforeAll / afterAll.
 * clearTestDB runs between tests to reset state.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer;

export async function connectTestDB(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  process.env.MONGODB_URI = uri;
  // A deterministic secret long enough for HS256
  process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-chars-key!';

  // Pre-warm the global connection cache used by connectDB()
  (global as Record<string, unknown>)._mongooseCache = { conn: null, promise: null };
  const conn = await mongoose.connect(uri, { bufferCommands: false });
  (global as Record<string, unknown>)._mongooseCache = {
    conn,
    promise: Promise.resolve(conn),
  };
}

export async function disconnectTestDB(): Promise<void> {
  await mongoose.disconnect();
  await mongod.stop();
}

export async function clearTestDB(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}
