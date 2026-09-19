import { z } from "zod";
import { AttachmentUploadedRequest, CreateAssemblyRequest, CreateAssemblyResponse, ListAttachmentsQuery, ListAttachmentsResponse } from "@/contracts";
import { apiFetch } from "./api-client";

export const attachmentsService = {
  createAssembly: (body: CreateAssemblyRequest) => apiFetch({ path: "/attachments/assembly", method: "POST", body, schema: CreateAssemblyResponse }),
  uploaded: (body: AttachmentUploadedRequest) => apiFetch({ path: "/attachments/uploaded", method: "POST", body, schema: z.object({ ok: z.literal(true) }) }),
  list: (query: ListAttachmentsQuery, signal?: AbortSignal) => apiFetch({ path: "/attachments", query, schema: ListAttachmentsResponse, signal }),
};
