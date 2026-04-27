import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import mongoose from 'mongoose';

export async function GET() {
  const start = Date.now();

  try {
    await connectDB();
    await mongoose.connection.db!.admin().ping();

    return NextResponse.json({
      status: 'ok',
      db: 'connected',
      latencyMs: Date.now() - start,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: 'error', db: 'unreachable', error: message },
      { status: 503 }
    );
  }
}
