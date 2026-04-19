import { type Page } from '@playwright/test';

export const BASE = 'http://localhost:3000';

export async function seed(page: Page) {
  const res = await page.request.get(`${BASE}/api/dev/seed`);
  if (!res.ok()) throw new Error(`Seed failed: ${res.status()}`);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 10000 });
}

export const ADMIN    = { email: 'admin@seed.dev',      password: 'admin123'    };
export const OWNER    = { email: 'alice@acme.com',      password: 'password123' };
export const MEMBER   = { email: 'bob@acme.com',        password: 'password123' };
