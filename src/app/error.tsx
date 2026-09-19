"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Next.js 16 error boundary: `retry()` re-renders the segment; `reset()` (legacy) still works. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{error.message || "An unexpected error occurred."}</p>
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
