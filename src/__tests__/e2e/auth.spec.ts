import { test, expect } from '@playwright/test';
import { seed, login, ADMIN } from './helpers';

// ── Login page ─────────────────────────────────────────────────────────────────

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders email and password fields', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('shows forgot password link', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
  });

  test('shows create workspace link', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Create a workspace' })).toBeVisible();
  });

  test('shows error for wrong credentials', async ({ page }) => {
    await seed(page);
    await page.locator('#email').fill(ADMIN.email);
    await page.locator('#password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible();
  });

  test('redirects to dashboard on successful login', async ({ page }) => {
    await seed(page);
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });
});

// ── Forgot password page ───────────────────────────────────────────────────────

test.describe('Forgot password page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password');
  });

  test('renders email field and submit button', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
  });

  test('shows back to sign in link', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();
  });

  test('shows confirmation message after submission', async ({ page }) => {
    await page.locator('#email').fill('anyone@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText(/check your inbox/i)).toBeVisible();
  });
});

// ── Reset password page ────────────────────────────────────────────────────────

test.describe('Reset password page', () => {
  test('shows error when no token is present', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByText(/invalid reset link/i)).toBeVisible();
  });

  test('renders new password form when token is present', async ({ page }) => {
    await page.goto('/reset-password?token=fake-token-for-ui-test');
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirm')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update password' })).toBeVisible();
  });
});

// ── Register page ──────────────────────────────────────────────────────────────

test.describe('Register page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('renders all required fields including invite code', async ({ page }) => {
    await expect(page.locator('#companyName')).toBeVisible();
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#inviteCode')).toBeVisible();
  });

  test('shows create workspace button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Create workspace' })).toBeVisible();
  });

  test('shows sign in link', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  test('shows error when invite code is wrong', async ({ page }) => {
    await page.locator('#companyName').fill('Test Co');
    await page.locator('#name').fill('Test User');
    await page.locator('#email').fill(`test-${Date.now()}@example.com`);
    await page.locator('#password').fill('password123');
    await page.locator('#inviteCode').fill('WRONG_CODE');
    await page.getByRole('button', { name: 'Create workspace' }).click();
    await expect(page.getByText(/invite code/i)).toBeVisible();
  });
});
