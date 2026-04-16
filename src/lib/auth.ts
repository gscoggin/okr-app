/**
 * Simple JWT auth layer.
 * Designed to be replaced/extended with OIDC (Okta, Auth0, etc.)
 * by swapping out verifyToken() and the login route.
 *
 * Roles:
 *   admin       – full access to all orgs, teams, OKRs
 *   member      – read access + edit within their own teams (per teamMemberships)
 *   team_owner  – stored in teamMemberships[].role, grants edit rights for that team
 */

import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import type { AuthPayload } from '@/types';

const JWT_EXPIRES_IN = '7d';
export const AUTH_COOKIE = 'okr_token';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Please define JWT_SECRET in your .env.local file');
  return secret;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthPayload;
  } catch {
    return null;
  }
}

/** Read the auth token from the request cookie header string */
export function tokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(';').find((c) => c.trim().startsWith(`${AUTH_COOKIE}=`));
  return match ? match.trim().split('=')[1] : null;
}

/** Server-side: get the current user from cookies (App Router) */
export async function getCurrentUser(): Promise<AuthPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ─── Permission helpers ───────────────────────────────────────────────────────

export function isAdmin(user: AuthPayload): boolean {
  return user.role === 'admin';
}

export function isTeamOwner(user: AuthPayload, teamId: string): boolean {
  if (isAdmin(user)) return true;
  return user.teamMemberships.some(
    (m) => m.teamId === teamId && m.role === 'owner'
  );
}

export function isTeamMember(user: AuthPayload, teamId: string): boolean {
  if (isAdmin(user)) return true;
  return user.teamMemberships.some((m) => m.teamId === teamId);
}

export function canEditTeamOKR(user: AuthPayload, teamId: string): boolean {
  return isTeamOwner(user, teamId);
}

export function canPublishOKR(user: AuthPayload, teamId: string): boolean {
  return isTeamOwner(user, teamId);
}
