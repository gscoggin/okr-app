/**
 * Email module unit tests
 *
 * Covered:
 *   1.  sendInviteCodeEmail uses EMAIL_FROM env var as sender (not hardcoded)
 *   2.  sendInviteCodeEmail falls back to onboarding@resend.dev when EMAIL_FROM unset
 *   3.  sendInviteCodeEmail includes the code and register URL in the email body
 *   4.  sendInviteCodeEmail uses NEXT_PUBLIC_APP_URL for the register link
 *   5.  sendPasswordResetEmail uses EMAIL_FROM env var as sender (not hardcoded)
 *   6.  sendPasswordResetEmail uses NEXT_PUBLIC_APP_URL for the reset link
 *   7.  No email is sent when RESEND_API_KEY is not set (dev mode)
 *   8.  request-access notification uses EMAIL_FROM env var (not hardcoded)
 */

const mockSend = jest.fn().mockResolvedValue({ id: 'test-id' });

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { req } from '../helpers/request';
import AccessRequest from '@/models/AccessRequest';
import { POST as requestAccess } from '@/app/api/demo/request-access/route';

beforeAll(() => connectTestDB(), 30000);
afterAll(() => disconnectTestDB());
beforeEach(() => {
  clearTestDB();
  mockSend.mockClear();
  // Reset module between tests so email.ts re-reads env vars
  jest.resetModules();
});

// ── 1. sendInviteCodeEmail uses EMAIL_FROM ─────────────────────────────────

it('sendInviteCodeEmail uses EMAIL_FROM env var as sender', async () => {
  process.env.RESEND_API_KEY = 'test-key';
  process.env.EMAIL_FROM = 'My App <custom@example.com>';

  const { sendInviteCodeEmail } = await import('@/lib/email');
  await sendInviteCodeEmail('user@example.com', 'Jane', 'ABCD1234');

  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({ from: 'My App <custom@example.com>' })
  );

  delete process.env.EMAIL_FROM;
  delete process.env.RESEND_API_KEY;
});

// ── 2. Falls back to onboarding@resend.dev ────────────────────────────────

it('sendInviteCodeEmail falls back to onboarding@resend.dev when EMAIL_FROM unset', async () => {
  process.env.RESEND_API_KEY = 'test-key';
  delete process.env.EMAIL_FROM;

  const { sendInviteCodeEmail } = await import('@/lib/email');
  await sendInviteCodeEmail('user@example.com', 'Jane', 'ABCD1234');

  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({ from: expect.stringContaining('onboarding@resend.dev') })
  );

  delete process.env.RESEND_API_KEY;
});

// ── 3. Email body contains the code ──────────────────────────────────────────

it('sendInviteCodeEmail includes the invite code in the email body', async () => {
  process.env.RESEND_API_KEY = 'test-key';

  const { sendInviteCodeEmail } = await import('@/lib/email');
  await sendInviteCodeEmail('user@example.com', 'Jane', 'XK4T9WPQ');

  const call = mockSend.mock.calls[0][0];
  expect(call.html).toContain('XK4T9WPQ');

  delete process.env.RESEND_API_KEY;
});

// ── 4. Register link uses NEXT_PUBLIC_APP_URL ─────────────────────────────────

it('sendInviteCodeEmail uses NEXT_PUBLIC_APP_URL for the register link', async () => {
  process.env.RESEND_API_KEY = 'test-key';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';

  const { sendInviteCodeEmail } = await import('@/lib/email');
  await sendInviteCodeEmail('user@example.com', 'Jane', 'ABCD1234');

  const call = mockSend.mock.calls[0][0];
  expect(call.html).toContain('https://app.example.com/register');

  delete process.env.RESEND_API_KEY;
  delete process.env.NEXT_PUBLIC_APP_URL;
});

// ── 5. sendPasswordResetEmail uses EMAIL_FROM ─────────────────────────────────

it('sendPasswordResetEmail uses EMAIL_FROM env var as sender', async () => {
  process.env.RESEND_API_KEY = 'test-key';
  process.env.EMAIL_FROM = 'My App <custom@example.com>';

  const { sendPasswordResetEmail } = await import('@/lib/email');
  await sendPasswordResetEmail('user@example.com', 'reset-token-123');

  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({ from: 'My App <custom@example.com>' })
  );

  delete process.env.EMAIL_FROM;
  delete process.env.RESEND_API_KEY;
});

// ── 6. Reset link uses NEXT_PUBLIC_APP_URL ────────────────────────────────────

it('sendPasswordResetEmail uses NEXT_PUBLIC_APP_URL for the reset link', async () => {
  process.env.RESEND_API_KEY = 'test-key';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';

  const { sendPasswordResetEmail } = await import('@/lib/email');
  await sendPasswordResetEmail('user@example.com', 'reset-token-123');

  const call = mockSend.mock.calls[0][0];
  expect(call.html).toContain('https://app.example.com/reset-password');

  delete process.env.RESEND_API_KEY;
  delete process.env.NEXT_PUBLIC_APP_URL;
});

// ── 7. No email sent without RESEND_API_KEY ───────────────────────────────────

it('does not call Resend when RESEND_API_KEY is not set', async () => {
  delete process.env.RESEND_API_KEY;

  const { sendInviteCodeEmail } = await import('@/lib/email');
  await sendInviteCodeEmail('user@example.com', 'Jane', 'ABCD1234');

  expect(mockSend).not.toHaveBeenCalled();
});

// ── 8. request-access notification uses EMAIL_FROM ───────────────────────────

it('request-access notification uses EMAIL_FROM env var as sender', async () => {
  process.env.RESEND_API_KEY = 'test-key';
  process.env.EMAIL_FROM = 'My App <custom@example.com>';
  process.env.ADMIN_NOTIFICATION_EMAIL = 'admin@example.com';

  const res = await requestAccess(req('POST', '/api/demo/request-access', {
    body: { name: 'Jane', email: 'jane@example.com', useCase: 'Testing' },
  }));
  expect(res.status).toBe(201);

  // Wait briefly for fire-and-forget
  await new Promise((r) => setTimeout(r, 50));

  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({ from: 'My App <custom@example.com>' })
  );

  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.ADMIN_NOTIFICATION_EMAIL;
});
