/**
 * Helpers for building NextRequest objects to call route handlers in tests.
 */
import { NextRequest } from 'next/server';
import { AUTH_COOKIE } from '@/lib/auth';

interface RequestOptions {
  body?: unknown;
  /** Raw JWT string (from signToken or a fixture helper) */
  token?: string;
  searchParams?: Record<string, string>;
}

/**
 * Build a NextRequest for calling an API route handler directly.
 *
 * @example
 * const req = req('POST', '/api/orgs', { body: { name: 'Acme' }, token: adminToken });
 * const res = await POST(req);
 */
export function req(
  method: string,
  path: string,
  options: RequestOptions = {}
): NextRequest {
  const url = new URL(path, 'http://localhost:3000');
  if (options.searchParams) {
    for (const [k, v] of Object.entries(options.searchParams)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (options.token) {
    headers['cookie'] = `${AUTH_COOKIE}=${options.token}`;
  }

  return new NextRequest(url, {
    method: method.toUpperCase(),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

/** Read a NextResponse body as parsed JSON */
export async function json<T = Record<string, unknown>>(
  res: Response
): Promise<T> {
  return res.json() as Promise<T>;
}

/** Shorthand for common HTTP verbs */
export const get = (path: string, opts?: RequestOptions) => req('GET', path, opts);
export const post = (path: string, opts?: RequestOptions) => req('POST', path, opts);
export const patch = (path: string, opts?: RequestOptions) => req('PATCH', path, opts);
export const del = (path: string, opts?: RequestOptions) => req('DELETE', path, opts);
