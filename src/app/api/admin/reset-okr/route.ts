import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, ok, err } from '@/lib/apiUtils';
import { isAdmin } from '@/lib/auth';
import User from '@/models/User';
import OKRPage from '@/models/OKRPage';
import Objective from '@/models/Objective';
import KeyResult from '@/models/KeyResult';

export async function POST(req: NextRequest) {
  const user = requireAuth(req);
  if (!user || !isAdmin(user)) return err('Forbidden', 403);

  const { email, password } = await req.json();
  if (!email || !password) return err('Email and password are required', 400);

  await connectDB();

  // Verify the requester's credentials
  const dbUser = await User.findOne({ email: email.toLowerCase() });
  if (!dbUser) return err('Invalid credentials', 401);

  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) return err('Invalid credentials', 401);

  if (dbUser._id.toString() !== user.userId) {
    return err('Credentials do not match your account', 401);
  }

  // Delete all OKR data scoped to this tenant
  const pages = await OKRPage.find({ tenantId: user.tenantId }).select('_id').lean();
  const pageIds = pages.map((p) => p._id);
  const objectives = await Objective.find({ okrPageId: { $in: pageIds } }).select('_id').lean();
  const objectiveIds = objectives.map((o) => o._id);

  const [krResult, objResult, pageResult] = await Promise.all([
    KeyResult.deleteMany({ objectiveId: { $in: objectiveIds } }),
    Objective.deleteMany({ okrPageId: { $in: pageIds } }),
    OKRPage.deleteMany({ tenantId: user.tenantId }),
  ]);

  return ok({
    deleted: {
      pages: pageResult.deletedCount,
      objectives: objResult.deletedCount,
      keyResults: krResult.deletedCount,
    },
  });
}
