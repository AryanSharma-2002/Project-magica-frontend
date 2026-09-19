import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { z } from "zod";
import { server } from "@/test/msw/server";
import { API } from "@/test/msw/handlers";
import { ApiError, apiFetch } from "./api-client";
import { configService } from "./config";

describe("apiFetch", () => {
  it("parses a valid response with its contract", async () => {
    const cfg = await configService.get();
    expect(cfg.models[0]?.id).toBe("openrouter/free");
  });
  it("throws a typed ApiError from the error envelope", async () => {
    server.use(http.get(`${API}/boom`, () => HttpResponse.json({ error: { code: "run_active", message: "busy", retryable: false, traceId: "t1" } }, { status: 409 })));
    await expect(apiFetch({ path: "/boom", schema: z.unknown() })).rejects.toMatchObject({ code: "run_active", status: 409, traceId: "t1" } satisfies Partial<ApiError>);
  });
  it("rejects responses that violate the contract", async () => {
    server.use(http.get(`${API}/config`, () => HttpResponse.json({ nope: true })));
    await expect(configService.get()).rejects.toMatchObject({ code: "internal" });
  });
});
