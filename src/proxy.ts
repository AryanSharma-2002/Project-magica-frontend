import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * `createRouteMatcher` is deprecated in @clerk/nextjs 7.9 in favor of per-route `auth.protect()`
 * calls, but the brief calls for protecting everything except sign-in/up from one place, which is
 * exactly what it's for; see the final report for the deprecation note.
 */
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

// Next.js 16 renamed `middleware.ts` -> `proxy.ts` (same runtime contract); `clerkMiddleware`
// still returns a `(request, event) => Response` compatible with the new `proxy` export.
export const proxy = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
