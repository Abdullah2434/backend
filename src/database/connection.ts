import mongoose from "mongoose";

let cached: typeof mongoose | null = null;

export async function connectMongo() {
  if (cached) return cached;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  mongoose.set("strictQuery", true);
  cached = await mongoose.connect(uri, {
    bufferCommands: true,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  return cached;
}

// Default export for compatibility
export default connectMongo;
