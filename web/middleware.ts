import type { NextRequest } from "next/server";
import { auth0 } from "./lib/auth0";

// Mounts /auth/login, /auth/logout, /auth/callback, /auth/profile, /auth/access-token, /auth/backchannel-logout.
// TODO: when we upgrade to Next.js 16, rename this file to proxy.ts and the export to `proxy`.
export async function middleware(request: NextRequest) {
  return auth0.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"
  ]
};
