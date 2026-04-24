import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { signDemoToken, AUTH_COOKIE } from '@/lib/auth';
import { err } from '@/lib/apiUtils';
import { seedDemo } from '@/lib/demoSeed';
import Tenant from '@/models/Tenant';
import User from '@/models/User';

const DEMO_SLUG  = 'demo-workspace';
const DEMO_EMAIL = 'demo@demo.local';
const RATE_LIMIT = 60;
const WINDOW_MS  = 60 * 60 * 1000; // 1 hour

// In-memory rate limiter — resets on cold start, fine for demo use
const ipHits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function GET(req: NextRequest) {
  if (process.env.IS_DEMO_DEPLOYMENT !== 'true') {
    return err('Not available', 404);
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!checkRateLimit(ip)) return err('Too many requests', 429);

  await connectDB();

  let tenant = await Tenant.findOne({ slug: DEMO_SLUG, isDemo: true }).lean();
  if (!tenant) {
    await seedDemo();
    tenant = await Tenant.findOne({ slug: DEMO_SLUG, isDemo: true }).lean();
  }
  if (!tenant) return err('Demo seed failed', 503);

  const user = await User.findOne({ email: DEMO_EMAIL, tenantId: tenant._id }).lean();
  if (!user) return err('Demo seed failed', 503);

  const token = signDemoToken({
    userId: user._id.toString(),
    tenantId: tenant._id.toString(),
    name: 'Demo User',
    email: DEMO_EMAIL,
    role: 'member',
    teamMemberships: [],
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 2 * 60 * 60, // 2 hours
    path: '/',
  });
  return res;
}
