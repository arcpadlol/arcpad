import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Kept in sync with APP_URL in app/lib/arcpad.ts. It is duplicated here so the
// proxy stays a tiny standalone module instead of pulling the app's chain
// config into the middleware bundle.
const APP_HOST = "https://app.citizenpad.lol";

// Product routes live on the app subdomain. The root domain only ever serves
// the marketing landing, so these paths redirect across instead of rendering
// the same page under two different URLs.
const PRODUCT = ["/app", "/create", "/activity", "/portfolio", "/docs", "/token"];

// Split the marketing landing from the product. The heavy animated landing
// lives on the root domain (citizenpad.lol); the app subdomain
// (app.citizenpad.lol) opens straight onto the coin board, which carries no
// landing shader and stays light.
export function proxy(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();
  const { pathname, search } = req.nextUrl;
  const onAppHost = host.startsWith("app.");

  if (onAppHost && pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.rewrite(url);
  }

  if (!onAppHost && PRODUCT.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    // The subdomain already serves the board at its root, so /app lands there.
    const target = pathname === "/app" ? "/" : pathname;
    return NextResponse.redirect(`${APP_HOST}${target}${search}`, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/app",
    "/app/:path*",
    "/create",
    "/create/:path*",
    "/activity",
    "/activity/:path*",
    "/portfolio",
    "/portfolio/:path*",
    "/docs",
    "/docs/:path*",
    "/token/:path*",
  ],
};
