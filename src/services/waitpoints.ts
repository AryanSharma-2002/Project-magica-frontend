import { CompleteWaitpointRequest, CompleteWaitpointResponse } from "@/contracts";
import { apiFetch } from "./api-client";

export const waitpointsService = {
  complete: (waitpointId: string, body: CompleteWaitpointRequest) =>
    apiFetch({ path: `/waitpoints/${waitpointId}/complete`, method: "POST", body, schema: CompleteWaitpointResponse }),
};
