import { clerkSetup } from "@clerk/testing/playwright";

/** Fetches a Clerk testing token for the dev instance so the sign-in helper bypasses bot protection. */
export default async function globalSetup(): Promise<void> {
  if (!process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY) {
    throw new Error("Playwright needs CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (see .env.local) to sign the reviewer account in.");
  }
  await clerkSetup();
}
