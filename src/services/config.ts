import { AppConfig } from "@/contracts";
import { apiFetch } from "./api-client";

export const configService = {
  get: (signal?: AbortSignal) => apiFetch({ path: "/config", schema: AppConfig, signal }),
};
