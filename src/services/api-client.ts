import type { z } from "zod";
import { ApiErrorEnvelope, API_PREFIX, IDEMPOTENCY_HEADER, type SafeError } from "@/contracts";
import { env } from "@/lib/env";

/**
 * The ONLY place the frontend calls fetch() against the backend.
 * Every response is parsed with its contract schema; every failure is a typed ApiError.
 */

export class ApiError extends Error {
  readonly code: SafeError["code"];
  readonly retryable: boolean;
  readonly details: Record<string, unknown> | undefined;
  readonly traceId: string | undefined;
  readonly status: number;
  constructor(status: number, safe: SafeError, traceId?: string) {
    super(safe.message);
    this.name = "ApiError";
    this.status = status;
    this.code = safe.code;
    this.retryable = safe.retryable;
    this.details = safe.details;
    this.traceId = traceId;
  }
}

type TokenGetter = () => Promise<string | null>;
let getToken: TokenGetter = async () => null;

/** Installed once by <ApiAuthBridge/> (Clerk useAuth().getToken). */
export function setTokenGetter(fn: TokenGetter): void {
  getToken = fn;
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export type ApiRequest<S extends z.ZodType> = {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: QueryParams;
  body?: unknown;
  schema: S;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

function buildUrl(path: string, query?: QueryParams): string {
  const url = new URL(`${API_PREFIX}${path}`, env.NEXT_PUBLIC_API_URL);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  return url.toString();
}

export async function apiFetch<S extends z.ZodType>(req: ApiRequest<S>): Promise<z.output<S>> {
  const token = await getToken();
  const headers: Record<string, string> = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (req.body !== undefined) headers["content-type"] = "application/json";
  if (req.idempotencyKey) headers[IDEMPOTENCY_HEADER] = req.idempotencyKey;

  const res = await fetch(buildUrl(req.path, req.query), {
    method: req.method ?? "GET",
    headers,
    body: req.body === undefined ? null : JSON.stringify(req.body),
    signal: req.signal ?? null,
    credentials: "omit",
  });

  const traceId = res.headers.get("x-trace-id") ?? undefined;
  if (res.status === 204) return req.schema.parse(undefined);

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(res.status, { code: "internal", message: "Invalid response from server", retryable: true }, traceId);
  }

  if (!res.ok) {
    const parsed = ApiErrorEnvelope.safeParse(json);
    const safe: SafeError = parsed.success ? parsed.data.error : { code: "internal", message: "Request failed", retryable: res.status >= 500 };
    throw new ApiError(res.status, safe, parsed.success ? parsed.data.error.traceId : traceId);
  }

  const parsed = req.schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(res.status, { code: "internal", message: "Response failed contract validation", retryable: false, details: { issues: parsed.error.issues.slice(0, 5) } }, traceId);
  }
  return parsed.data;
}
