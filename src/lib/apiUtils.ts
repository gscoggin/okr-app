import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, tokenFromCookieHeader } from './auth';
import type { AuthPayload, ApiResponse } from '@/types';

export function ok<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data }, { status });
}

export function err(message: string, status = 400): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ error: message }, { status });
}

/** Returns a 403 response if the user is a demo session, otherwise null */
export function rejectIfDemo(user: AuthPayload | null): NextResponse<ApiResponse<never>> | null {
  if (user?.isDemo) return NextResponse.json({ error: 'Not available in demo mode' }, { status: 403 });
  return null;
}

/** Extract and verify the JWT from the incoming request */
export function requireAuth(req: NextRequest): AuthPayload | null {
  const cookieHeader = req.headers.get('cookie');
  const token = tokenFromCookieHeader(cookieHeader);
  if (!token) return null;
  return verifyToken(token);
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
