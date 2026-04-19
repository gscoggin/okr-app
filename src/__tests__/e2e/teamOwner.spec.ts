import { test, expect } from '@playwright/test';
import { seed, login, OWNER } from './helpers';

const CURRENT_YEAR = new Date().getFullYear();

test.beforeEach(async ({ page }) => {
  await seed(page);
  await login(page, OWNER.email, OWNER.password);
  // Navigate to the Product team's current year annual page
  await page.getByRole('link', { name: 'Product' }).click();
  await page.getByRole('link', { name: String(CURRENT_YEAR) }).first().click();
});

test('team owner sees edit controls on a draft page', async ({ page }) => {
  await expect(page.getByRole('button', { name: '+ Add Objective' })).toBeVisible();
});

test('team owner sees publish button on a draft page', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();
});

test('published page shows no edit controls', async ({ page }) => {
  // Navigate to 2024 (published) via sidebar
  await page.getByRole('link', { name: '2024' }).click();
  await expect(page).toHaveURL(/\/2024$/);
  await expect(page.getByRole('button', { name: '+ Add Objective' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish' })).not.toBeVisible();
});
