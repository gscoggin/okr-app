import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/demo',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/demo/session',
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow public paths, static assets, and Next internals
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Skip API routes — they handle their own auth via requireAuth()
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users — to /demo on demo deployment, /login otherwise
  const token = req.cookies.get('okr_token');
  if (!token) {
    const target = req.nextUrl.clone();
    target.pathname = process.env.IS_DEMO_DEPLOYMENT === 'true' ? '/demo' : '/login';
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
