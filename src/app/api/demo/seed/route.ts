import { NextRequest } from 'next/server';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin } from '@/lib/auth';
import { seedDemo } from '@/lib/demoSeed';

export async function POST(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return err('Unauthorized', 401);
  if (!isAdmin(user)) return err('Forbidden', 403);

  const result = await seedDemo();
  return ok(result);
}
