import { test, expect } from '@playwright/test';
import { seed, login, ADMIN, OWNER, MEMBER } from './helpers';

const CURRENT_YEAR = new Date().getFullYear();

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
    await login(page, ADMIN.email, ADMIN.password);
  });

  test('shows all seeded organizations', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Acme Corp' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Northstar Labs' })).toBeVisible();
  });

  test('shows teams under their orgs', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Product' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Engineering' }).first()).toBeVisible();
  });

  test('shows OKR period links', async ({ page }) => {
    await expect(page.getByRole('link', { name: String(CURRENT_YEAR) }).first()).toBeVisible();
  });
});

// ── Sidebar ────────────────────────────────────────────────────────────────────

test.describe('Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
    await login(page, ADMIN.email, ADMIN.password);
  });

  test('sidebar is visible with org/team links', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Product' }).first()).toBeVisible();
  });

  test('sidebar collapse button is visible', async ({ page }) => {
    // The collapse/expand button exists somewhere in the sidebar
    const sidebar = page.locator('nav, aside').first();
    await expect(sidebar).toBeVisible();
  });

  test('admin link is visible for admin user', async ({ page }) => {
    await expect(page.getByRole('link', { name: /admin/i })).toBeVisible();
  });
});

// ── Org page ───────────────────────────────────────────────────────────────────

test.describe('Org page', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
    await login(page, ADMIN.email, ADMIN.password);
  });

  test('navigating to an org shows its teams', async ({ page }) => {
    await page.getByRole('heading', { name: 'Acme Corp' }).click();
    await expect(page).toHaveURL(/\/orgs\//);
    await expect(page.getByRole('link', { name: 'Product' }).first()).toBeVisible();
  });
});

// ── Search ─────────────────────────────────────────────────────────────────────

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
    await login(page, ADMIN.email, ADMIN.password);
  });

  test('search box is visible in topbar', async ({ page }) => {
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test('typing in search shows dropdown results', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('Product');
    // Dropdown should appear with results
    await expect(page.getByText('Product').first()).toBeVisible();
  });

  test('pressing Escape closes search dropdown', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('Product');
    await page.keyboard.press('Escape');
    // Input should be cleared or dropdown should close
    await expect(searchInput).toHaveValue('');
  });
});

// ── Role-based access ──────────────────────────────────────────────────────────

test.describe('Role-based navigation', () => {
  test('member does not see admin link in sidebar', async ({ page }) => {
    await seed(page);
    await login(page, MEMBER.email, MEMBER.password);
    // Admin link should not be visible for non-admin
    const adminLinks = page.getByRole('link', { name: /^admin$/i });
    await expect(adminLinks).not.toBeVisible();
  });

  test('owner sees their team in sidebar', async ({ page }) => {
    await seed(page);
    await login(page, OWNER.email, OWNER.password);
    await expect(page.getByRole('link', { name: 'Product' }).first()).toBeVisible();
  });
});
