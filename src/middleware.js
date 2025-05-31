import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  
  // Refresh session if expired - required for Server Components
  await supabase.auth.getSession();
  
  // Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Define protected routes
  const protectedRoutes = ['/dashboard'];
  const isProtectedRoute = protectedRoutes.some(route => 
    req.nextUrl.pathname.startsWith(route)
  );
  
  // Define auth routes
  const authRoutes = ['/(auth)/login', '/(auth)/signup'];
  const isAuthRoute = authRoutes.some(route => 
    req.nextUrl.pathname === route ||
    req.nextUrl.pathname.startsWith(route)
  );
  
  // Redirect logic
  if (isProtectedRoute && !user) {
    // Redirect to login if trying to access protected route without auth
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/(auth)/login';
    redirectUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }
  
  if (isAuthRoute && user) {
    // Redirect to dashboard if already logged in and trying to access auth routes
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }
  
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\.svg).*)'],
};
