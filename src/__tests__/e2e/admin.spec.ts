import { test, expect } from '@playwright/test';
import { seed, login, ADMIN } from './helpers';

test.beforeEach(async ({ page }) => {
  await seed(page);
  await login(page, ADMIN.email, ADMIN.password);
});

// ── Dashboard ──────────────────────────────────────────────────────────────────

test('admin sees company dashboard with all orgs', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Acme Corp' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Northstar Labs' })).toBeVisible();
});

test('admin can navigate to any team OKR page', async ({ page }) => {
  await page.getByRole('link', { name: 'Product' }).first().click();
  await page.waitForURL(/\/teams\/[^/]+\/\d{4}/, { timeout: 60_000 });
  await expect(page.getByText('Ship a world-class onboarding experience')).toBeVisible({ timeout: 30_000 });
});

// ── Admin page ─────────────────────────────────────────────────────────────────

test.describe('/admin page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
  });

  test('shows Organizations section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible();
  });

  test('shows Teams section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible();
  });

  test('shows Users section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  });

  test('shows Add User to Workspace form', async ({ page }) => {
    await expect(page.getByText('Add User to Workspace')).toBeVisible();
    await expect(page.getByPlaceholder('Full name')).toBeVisible();
    await expect(page.getByPlaceholder('Email address')).toBeVisible();
  });

  test('shows seeded orgs in the org list', async ({ page }) => {
    await expect(page.getByText('Acme Corp')).toBeVisible();
  });

  test('shows seeded users in the user list', async ({ page }) => {
    await expect(page.getByText('admin@seed.dev')).toBeVisible();
  });

  test('can create a new org', async ({ page }) => {
    const uniqueName = `E2E Org ${Date.now()}`;
    await page.getByPlaceholder('New organization name').fill(uniqueName);
    await page.getByRole('button', { name: 'Create Org' }).click();
    await expect(page.locator('ul').filter({ hasText: uniqueName }).getByText(uniqueName).first()).toBeVisible();
  });

  test('shows Danger Zone section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Danger Zone' })).toBeVisible();
    await expect(page.getByText('Delete All OKR Data')).toBeVisible();
  });

  test('danger zone Delete all button opens credentials form', async ({ page }) => {
    await page.getByRole('button', { name: 'Delete all…' }).click();
    await expect(page.getByPlaceholder('Your email address')).toBeVisible();
    await expect(page.getByPlaceholder('Your password')).toBeVisible();
  });

});

// ── Non-admin access ───────────────────────────────────────────────────────────

test('non-admin is redirected away from /admin', async ({ page }) => {
  // Log out and log back in as a member
  await page.goto('/api/auth/logout');
  await page.goto('/login');
  await page.locator('#email').fill('bob@acme.com');
  await page.locator('#password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));

  await page.goto('/admin');
  // Should be redirected to home, not stay on /admin
  await expect(page).not.toHaveURL(/\/admin/);
});
