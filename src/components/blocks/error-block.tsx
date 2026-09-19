import { AlertTriangleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { SafeError } from "@/contracts";

export function ErrorBlockView({ error }: { error: SafeError }) {
  const traceId = typeof error.details?.traceId === "string" ? error.details.traceId : undefined;
  return (
    <Alert variant="destructive">
      <AlertTriangleIcon className="size-4" />
      <AlertTitle>{error.message}</AlertTitle>
      <AlertDescription>
        <span className="font-mono text-xs opacity-80">
          {error.code}
          {traceId ? ` · trace ${traceId}` : ""}
        </span>
      </AlertDescription>
    </Alert>
  );
}
