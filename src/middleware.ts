import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  if (process.env.IS_DEMO_DEPLOYMENT !== 'true') {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Let these through unconditionally
  if (
    pathname === '/demo' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // On the demo deployment, unauthenticated visitors always go to /demo
  const token = request.cookies.get('okr_token')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/demo', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
