/**
 * Dark mode regression tests.
 *
 * Each test navigates to a page with the system color scheme set to dark,
 * waits for next-themes to apply the `dark` class to <html>, then checks
 * that key interactive elements (inputs, cards, list items) have dark
 * backgrounds — not the white-on-dark bug we've fixed several times.
 */
import { test, expect, type Page } from '@playwright/test';
import { seed, login, ADMIN, OWNER } from './helpers';

test.use({ colorScheme: 'dark' });

// Wait for next-themes to add the `dark` class to <html>
async function waitForDarkClass(page: Page) {
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'), {
    timeout: 5000,
  });
}

// Assert an element has a non-white background color
async function expectDarkBackground(page: Page, selector: string) {
  const bg = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return window.getComputedStyle(el).backgroundColor;
  }, selector);
  expect(bg).not.toBeNull();
  // Pure white = rgb(255, 255, 255) — fail if we see it
  expect(bg).not.toBe('rgb(255, 255, 255)');
}

// ── Auth pages ─────────────────────────────────────────────────────────────────

test('login page applies dark theme', async ({ page }) => {
  await page.goto('/login');
  await waitForDarkClass(page);
  await expectDarkBackground(page, '#email');
  await expectDarkBackground(page, '#password');
});

test('register page applies dark theme to all inputs', async ({ page }) => {
  await page.goto('/register');
  await waitForDarkClass(page);
  await expectDarkBackground(page, '#companyName');
  await expectDarkBackground(page, '#email');
  await expectDarkBackground(page, '#password');
  await expectDarkBackground(page, '#inviteCode');
});

test('forgot password page applies dark theme', async ({ page }) => {
  await page.goto('/forgot-password');
  await waitForDarkClass(page);
  await expectDarkBackground(page, '#email');
});

test('reset password page applies dark theme', async ({ page }) => {
  await page.goto('/reset-password?token=fake-token');
  await waitForDarkClass(page);
  await expectDarkBackground(page, '#password');
  await expectDarkBackground(page, '#confirm');
});

// ── Dashboard ──────────────────────────────────────────────────────────────────

test('dashboard applies dark theme', async ({ page }) => {
  await seed(page);
  await login(page, ADMIN.email, ADMIN.password);
  await waitForDarkClass(page);
  // Main content area should be dark, not white
  await expectDarkBackground(page, 'main');
});

// ── Admin page ─────────────────────────────────────────────────────────────────

test('admin page list items have dark backgrounds', async ({ page }) => {
  await seed(page);
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto('/admin');
  await waitForDarkClass(page);

  // User list items should NOT be white
  const userListItem = page.locator('ul li').first();
  await expect(userListItem).toBeVisible();
  const bg = await userListItem.evaluate((el) =>
    window.getComputedStyle(el).backgroundColor
  );
  expect(bg).not.toBe('rgb(255, 255, 255)');
});

test('admin page form inputs have dark backgrounds', async ({ page }) => {
  await seed(page);
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto('/admin');
  await waitForDarkClass(page);

  // "Add User to Workspace" form inputs should be dark
  const inputs = page.locator('input[type="text"], input[type="email"], input[type="password"]');
  const count = await inputs.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const bg = await inputs.nth(i).evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bg).not.toBe('rgb(255, 255, 255)');
  }
});

test('admin page selects have dark backgrounds', async ({ page }) => {
  await seed(page);
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto('/admin');
  await waitForDarkClass(page);

  const selects = page.locator('select');
  const count = await selects.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const bg = await selects.nth(i).evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bg).not.toBe('rgb(255, 255, 255)');
  }
});

// ── OKR page ───────────────────────────────────────────────────────────────────

test('team OKR page applies dark theme', async ({ page }) => {
  await seed(page);
  await login(page, OWNER.email, OWNER.password);
  await page.getByRole('link', { name: 'Product' }).first().click();
  await page.waitForURL(/\/teams\/[^/]+\/\d{4}/);
  await waitForDarkClass(page);
  await expectDarkBackground(page, 'main');
});

// ── Settings page ──────────────────────────────────────────────────────────────

test('settings page applies dark theme to inputs', async ({ page }) => {
  await seed(page);
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto('/settings');
  await waitForDarkClass(page);
  const inputs = page.locator('input[type="text"]');
  if (await inputs.count() > 0) {
    const bg = await inputs.first().evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bg).not.toBe('rgb(255, 255, 255)');
  }
});
