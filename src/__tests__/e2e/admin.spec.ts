import { test, expect } from '@playwright/test';
import { seed, login, ADMIN } from './helpers';

test.beforeEach(async ({ page }) => {
  await seed(page);
  await login(page, ADMIN.email, ADMIN.password);
});

test('admin sees company dashboard with all orgs', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Acme Corp' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Northstar Labs' })).toBeVisible();
});

test('admin can navigate to any team OKR page', async ({ page }) => {
  await page.getByRole('link', { name: 'Product' }).first().click();
  // Wait for redirect to settle on a year/period page
  await page.waitForURL(/\/teams\/[^/]+\/\d{4}/);
  // Objective titles are rendered as inputs — check one is present
  await expect(page.locator('input[value="Ship a world-class onboarding experience"]')).toBeVisible();
});
