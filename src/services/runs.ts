import { CancelRunResponse, GetRunResponse, RealtimeTokenResponse } from "@/contracts";
import { apiFetch } from "./api-client";

export const runsService = {
  get: (runId: string, signal?: AbortSignal) => apiFetch({ path: `/runs/${runId}`, schema: GetRunResponse, signal }),
  cancel: (runId: string) => apiFetch({ path: `/runs/${runId}/cancel`, method: "POST", schema: CancelRunResponse }),
  realtimeToken: (runId: string) => apiFetch({ path: `/runs/${runId}/realtime-token`, method: "POST", schema: RealtimeTokenResponse }),
};
