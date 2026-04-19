import { test, expect } from '@playwright/test';
import { seed, login, MEMBER } from './helpers';

const CURRENT_YEAR = new Date().getFullYear();

test.beforeEach(async ({ page }) => {
  await seed(page);
  await login(page, MEMBER.email, MEMBER.password);
  // Navigate to the Product team's current year annual page
  await page.getByRole('link', { name: 'Product' }).click();
  await page.getByRole('link', { name: String(CURRENT_YEAR) }).first().click();
});

test('member sees their team OKR page in read-only mode', async ({ page }) => {
  await expect(page).toHaveURL(/\/teams\//);
  await expect(page.getByRole('button', { name: '+ Add Objective' })).not.toBeVisible();
});

test('member cannot see publish button', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Publish' })).not.toBeVisible();
});

test('member can navigate to a quarterly page and back to annual', async ({ page }) => {
  // Go to homepage and click the Q1 link for the Product team
  await page.goto('/');
  await page.locator('a', { hasText: `Q1 ${CURRENT_YEAR}` }).first().click();
  await expect(page).toHaveURL(new RegExp(`${CURRENT_YEAR}/q1`));
  // "Annual" link only appears on quarterly pages
  await page.getByRole('link', { name: 'Annual' }).click();
  await expect(page).toHaveURL(new RegExp(`/${CURRENT_YEAR}$`));
});

test('member can view another team published page without edit controls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Engineering' }).click();
  await page.getByRole('link', { name: '2024' }).first().click();
  // Published pages render titles as plain text, not inputs
  await expect(page.getByText('Achieve 99.9% uptime across all production services')).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Add Objective' })).not.toBeVisible();
});

test('score badges are visible on the page', async ({ page }) => {
  await expect(page.locator('[data-testid="score-badge"]').first()).toBeVisible();
});
