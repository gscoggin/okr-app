import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/apiUtils';
import { ok, err } from '@/lib/apiUtils';

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);
  return ok(user);
}
