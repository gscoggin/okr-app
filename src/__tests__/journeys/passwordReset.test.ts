/**
 * Password reset journey tests
 *
 * Covered:
 *   1. Requesting a reset stores a token on the user and returns 200
 *   2. Unknown email still returns 200 (no enumeration)
 *   3. Valid token + new password resets successfully
 *   4. Old password no longer works after reset; new password does
 *   5. Expired token is rejected with 400
 *   6. Invalid / non-existent token is rejected with 400
 *   7. Password shorter than 8 characters is rejected
 *   8. Missing token or password returns error
 *   9. Token is cleared after successful reset (cannot reuse)
 */

// Mock email so tests never hit the Resend API
jest.mock('@/lib/email', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req, json } from '../helpers/request';
import { createUser } from '../helpers/fixtures';
import User from '@/models/User';

import { POST as forgotPassword } from '@/app/api/auth/forgot-password/route';
import { POST as resetPassword } from '@/app/api/auth/reset-password/route';
import { POST as login } from '@/app/api/auth/login/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => clearTestDB());

// ── 1. Reset request stores token ─────────────────────────────────────────────

it('requesting a reset stores a token and expiry on the user', async () => {
  await createUser({ email: 'alice@test.com' });

  const res = await forgotPassword(
    req('POST', '/api/auth/forgot-password', { body: { email: 'alice@test.com' } })
  );
  expect(res.status).toBe(200);
  expect((await json(res)).data.sent).toBe(true);

  const user = await User.findOne({ email: 'alice@test.com' }).lean();
  expect(user!.resetToken).toBeTruthy();
  expect(user!.resetTokenExpiry!.getTime()).toBeGreaterThan(Date.now());
});

// ── 2. Unknown email returns 200 (no enumeration) ─────────────────────────────

it('requesting a reset for an unknown email still returns 200', async () => {
  const res = await forgotPassword(
    req('POST', '/api/auth/forgot-password', { body: { email: 'nobody@test.com' } })
  );
  expect(res.status).toBe(200);
  expect((await json(res)).data.sent).toBe(true);
});

// ── 3. Valid token resets password ────────────────────────────────────────────

it('valid token successfully resets the password', async () => {
  await createUser({ email: 'bob@test.com' });

  await forgotPassword(
    req('POST', '/api/auth/forgot-password', { body: { email: 'bob@test.com' } })
  );
  const { resetToken } = (await User.findOne({ email: 'bob@test.com' }).lean())!;

  const res = await resetPassword(
    req('POST', '/api/auth/reset-password', {
      body: { token: resetToken, password: 'newPassword99' },
    })
  );
  expect(res.status).toBe(200);
  expect((await json(res)).data.reset).toBe(true);
});

// ── 4. New password works; old password does not ──────────────────────────────

it('user can log in with new password but not old password after reset', async () => {
  await createUser({ email: 'carol@test.com', password: 'oldPass123' });

  await forgotPassword(
    req('POST', '/api/auth/forgot-password', { body: { email: 'carol@test.com' } })
  );
  const { resetToken } = (await User.findOne({ email: 'carol@test.com' }).lean())!;

  await resetPassword(
    req('POST', '/api/auth/reset-password', {
      body: { token: resetToken, password: 'brandNewPass99' },
    })
  );

  const loginOld = await login(
    req('POST', '/api/auth/login', { body: { email: 'carol@test.com', password: 'oldPass123' } })
  );
  expect(loginOld.status).toBe(401);

  const loginNew = await login(
    req('POST', '/api/auth/login', { body: { email: 'carol@test.com', password: 'brandNewPass99' } })
  );
  expect(loginNew.status).toBe(200);
});

// ── 5. Expired token is rejected ──────────────────────────────────────────────

it('an expired reset token is rejected with 400', async () => {
  await createUser({ email: 'dave@test.com' });

  await forgotPassword(
    req('POST', '/api/auth/forgot-password', { body: { email: 'dave@test.com' } })
  );

  // Backdate the expiry to the past
  await User.findOneAndUpdate(
    { email: 'dave@test.com' },
    { resetTokenExpiry: new Date(Date.now() - 1000) }
  );

  const { resetToken } = (await User.findOne({ email: 'dave@test.com' }).lean())!;
  const res = await resetPassword(
    req('POST', '/api/auth/reset-password', {
      body: { token: resetToken, password: 'newPassword99' },
    })
  );
  expect(res.status).toBe(400);
});

// ── 6. Invalid token is rejected ──────────────────────────────────────────────

it('a non-existent reset token is rejected with 400', async () => {
  const res = await resetPassword(
    req('POST', '/api/auth/reset-password', {
      body: { token: 'completely-made-up-token', password: 'newPassword99' },
    })
  );
  expect(res.status).toBe(400);
});

// ── 7. Short password rejected ────────────────────────────────────────────────

it('password shorter than 8 characters is rejected', async () => {
  await createUser({ email: 'eve@test.com' });

  await forgotPassword(
    req('POST', '/api/auth/forgot-password', { body: { email: 'eve@test.com' } })
  );
  const { resetToken } = (await User.findOne({ email: 'eve@test.com' }).lean())!;

  const res = await resetPassword(
    req('POST', '/api/auth/reset-password', {
      body: { token: resetToken, password: 'short' },
    })
  );
  expect(res.status).toBe(400);
});

// ── 8. Missing fields ─────────────────────────────────────────────────────────

it('reset-password with missing token returns an error', async () => {
  const res = await resetPassword(
    req('POST', '/api/auth/reset-password', { body: { password: 'newPassword99' } })
  );
  expect(res.status).toBe(400);
});

it('reset-password with missing password returns an error', async () => {
  const res = await resetPassword(
    req('POST', '/api/auth/reset-password', { body: { token: 'sometoken' } })
  );
  expect(res.status).toBe(400);
});

// ── 9. Token is cleared after use (no reuse) ──────────────────────────────────

it('a reset token cannot be reused after a successful reset', async () => {
  await createUser({ email: 'frank@test.com' });

  await forgotPassword(
    req('POST', '/api/auth/forgot-password', { body: { email: 'frank@test.com' } })
  );
  const { resetToken } = (await User.findOne({ email: 'frank@test.com' }).lean())!;

  await resetPassword(
    req('POST', '/api/auth/reset-password', {
      body: { token: resetToken, password: 'firstNewPass99' },
    })
  );

  // Attempt to reuse the same token
  const res = await resetPassword(
    req('POST', '/api/auth/reset-password', {
      body: { token: resetToken, password: 'secondNewPass99' },
    })
  );
  expect(res.status).toBe(400);

  // Verify token fields are cleared
  const user = await User.findOne({ email: 'frank@test.com' }).lean();
  expect(user!.resetToken).toBeUndefined();
  expect(user!.resetTokenExpiry).toBeUndefined();
});
