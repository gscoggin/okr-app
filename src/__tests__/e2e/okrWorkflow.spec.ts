import { test, expect } from '@playwright/test';
import { seed, login, OWNER, MEMBER } from './helpers';

const CURRENT_YEAR = new Date().getFullYear();

async function goToProductPage(page: import('@playwright/test').Page) {
  await page.getByRole('link', { name: 'Product' }).first().click();
  await page.waitForURL(/\/teams\/[^/]+\/\d{4}/, { timeout: 60_000 });
  await page.waitForLoadState('networkidle');
}

// ── Team owner edit controls ───────────────────────────────────────────────────

test.describe('Team owner on draft OKR page', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
    await login(page, OWNER.email, OWNER.password);
    await goToProductPage(page);
  });

  test('sees Add Objective button', async ({ page }) => {
    await expect(page.getByRole('button', { name: '+ Add Objective' })).toBeVisible();
  });

  test('sees Publish button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();
  });

  test('can add a new objective', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add Objective' }).click();
    // A new empty objective input should appear
    const newInput = page.locator('input[placeholder*="objective" i]').last();
    await expect(newInput).toBeVisible();
    await newInput.fill('New E2E Test Objective');
    await page.keyboard.press('Enter');
    await expect(page.locator('input[value="New E2E Test Objective"]')).toBeVisible();
  });

  test('can edit an existing objective title', async ({ page }) => {
    const input = page.locator('input[value="Ship a world-class onboarding experience"]');
    await expect(input).toBeVisible();
    await input.fill('Updated onboarding objective');
    await page.keyboard.press('Tab');
    await expect(page.locator('input[value="Updated onboarding objective"]')).toBeVisible();
  });
});

// ── Published page is read-only ────────────────────────────────────────────────

test.describe('Published OKR page', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
    await login(page, OWNER.email, OWNER.password);
    await page.goto('/');
    await page.getByRole('link', { name: 'Engineering' }).first().click();
    await page.getByRole('link', { name: '2024' }).first().click();
    await expect(page).toHaveURL(/\/2024$/);
  });

  test('does not show Add Objective button', async ({ page }) => {
    await expect(page.getByRole('button', { name: '+ Add Objective' })).not.toBeVisible();
  });

  test('does not show Publish button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Publish' })).not.toBeVisible();
  });

  test('shows objective titles as plain text not inputs', async ({ page }) => {
    await expect(page.getByText('Achieve 99.9% uptime across all production services')).toBeVisible();
  });
});

// ── Member read-only ───────────────────────────────────────────────────────────

test.describe('Member on OKR page', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
    await login(page, MEMBER.email, MEMBER.password);
    await goToProductPage(page);
  });

  test('cannot see Add Objective button', async ({ page }) => {
    await expect(page.getByRole('button', { name: '+ Add Objective' })).not.toBeVisible();
  });

  test('cannot see Publish button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Publish' })).not.toBeVisible();
  });

  test('can still see objective titles', async ({ page }) => {
    await expect(page.getByText('Ship a world-class onboarding experience')).toBeVisible();
  });
});

// ── Period navigation ──────────────────────────────────────────────────────────

test.describe('Period navigation', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
    await login(page, OWNER.email, OWNER.password);
  });

  test('can navigate from annual to quarterly page', async ({ page }) => {
    await page.goto('/');
    const q1Link = page.locator('a', { hasText: `Q1 ${CURRENT_YEAR}` }).first();
    await q1Link.click();
    await expect(page).toHaveURL(new RegExp(`${CURRENT_YEAR}/q1`));
  });

  test('Annual link appears on quarterly page and navigates back', async ({ page }) => {
    await page.goto('/');
    await page.locator('a', { hasText: `Q1 ${CURRENT_YEAR}` }).first().click();
    await expect(page).toHaveURL(new RegExp(`${CURRENT_YEAR}/q1`));
    await page.getByRole('link', { name: 'Annual' }).click();
    await expect(page).toHaveURL(new RegExp(`/${CURRENT_YEAR}$`));
  });
});

// ── Score badges ───────────────────────────────────────────────────────────────

test('score badges are visible on OKR pages', async ({ page }) => {
  await seed(page);
  await login(page, MEMBER.email, MEMBER.password);
  await goToProductPage(page);
  await expect(page.locator('[data-testid="score-badge"]').first()).toBeVisible();
});
