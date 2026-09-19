import { z } from "zod";

/** Public (browser-safe) config only. Secrets never enter the frontend bundle. */
const PublicEnv = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_TRIGGER_API_URL: z.string().url().default("https://api.trigger.dev"),
});

export const env = PublicEnv.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_TRIGGER_API_URL: process.env.NEXT_PUBLIC_TRIGGER_API_URL,
});
