import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LIMITS, type Attachment, type CreateAssemblyRequest } from "@/contracts";
import { attachmentsService } from "@/services/attachments";
import { useComposerStore } from "@/stores/composer";
import { useUploader } from "./useUploader";

type Handler = (...args: unknown[]) => void;
type MockUppyFile = {
  id: string;
  name: string;
  type: string;
  data: File;
  meta: { clientId: string };
  uploadURL?: string;
  response?: { uploadURL?: string };
};
type MockUppyFileInput = Omit<MockUppyFile, "id">;

/**
 * Real Uppy ignores any caller-supplied `id` on `addFile` and always regenerates one via
 * `getSafeFileId` (verified in @uppy/core/lib/utils/generateFileID.js) — `meta` survives untouched,
 * `id` does not. This mock reproduces that: it manufactures its own id and hands it back from
 * `addFile`, so a test that (incorrectly) assumed `id === clientId` would fail honestly.
 */
class MockUppy {
  static instances: MockUppy[] = [];
  static nextFileSeq = 0;
  handlers = new Map<string, Handler[]>();
  files = new Map<string, MockUppyFile>();
  pluginOpts: unknown;
  removeFile = vi.fn((id: string) => this.files.delete(id));
  retryUpload = vi.fn();
  cancelAll = vi.fn();
  destroy = vi.fn();
  upload = vi.fn(() => Promise.resolve(undefined));

  constructor(readonly opts: unknown) {
    MockUppy.instances.push(this);
  }
  on(event: string, cb: Handler) {
    const list = this.handlers.get(event) ?? [];
    list.push(cb);
    this.handlers.set(event, list);
    return this;
  }
  emit(event: string, ...args: unknown[]) {
    for (const cb of this.handlers.get(event) ?? []) cb(...args);
  }
  use(_plugin: unknown, opts: unknown) {
    this.pluginOpts = opts;
    return this;
  }
  addFile(file: MockUppyFileInput) {
    MockUppy.nextFileSeq += 1;
    const id = `uppy-generated-id-${MockUppy.nextFileSeq}`;
    this.files.set(id, { ...file, id });
    return id;
  }
  /** Test helper: production code correlates events by `meta.clientId`, never by the real id. */
  fileByClientId(clientId: string): MockUppyFile | undefined {
    return Array.from(this.files.values()).find((f) => f.meta.clientId === clientId);
  }
}

vi.mock("@uppy/core", () => ({ default: MockUppy }));
vi.mock("@uppy/transloadit", () => ({ default: class MockTransloadit {} }));

function latestUppy(): MockUppy {
  const instance = MockUppy.instances.at(-1);
  if (!instance) throw new Error("no Uppy instance was created");
  return instance;
}

function makeFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

function makeAttachment(clientId: string, position: number, overrides: Partial<Attachment> = {}): Attachment & { clientId: string } {
  return {
    id: `att_${clientId}`,
    kind: "image",
    source: "upload",
    status: "uploading",
    filename: "file.png",
    mimeType: "image/png",
    sizeBytes: 100,
    url: null,
    previewUrl: null,
    width: null,
    height: null,
    durationMs: null,
    position,
    assemblyId: null,
    expiresAt: null,
    createdAt: "2026-09-19T00:00:00.000Z",
    ...overrides,
    clientId,
  };
}

function mockCreateAssembly() {
  return vi.spyOn(attachmentsService, "createAssembly").mockImplementation(async (body: CreateAssemblyRequest) => ({
    assemblyOptions: { params: "{}", signature: "sig" },
    expiresAt: "2026-09-19T01:00:00.000Z",
    attachments: body.files.map((f) => makeAttachment(f.clientId, f.position, { filename: f.filename, mimeType: f.mimeType, sizeBytes: f.sizeBytes })),
  }));
}

describe("useUploader", () => {
  beforeEach(() => {
    MockUppy.instances = [];
    useComposerStore.setState({ drafts: {}, attachments: {}, planMode: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("rejects unsupported mime types and oversized files with specific messages, and still uploads the valid one", async () => {
    const limits = { ...DEFAULT_LIMITS, allowedMimeTypes: ["image/png"], maxFileBytes: 1000, maxAttachmentsPerMessage: 10 };
    const createAssembly = mockCreateAssembly();
    const { result } = renderHook(() => useUploader(null, limits));

    const goodFile = makeFile("good.png", "image/png", 10);
    const wrongType = makeFile("doc.txt", "text/plain", 10);
    const oversized = makeFile("big.png", "image/png", 5000);

    await act(async () => {
      await result.current.addFiles([goodFile, wrongType, oversized]);
    });

    expect(result.current.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fileName: "doc.txt", message: expect.stringContaining("isn't supported") }),
        expect.objectContaining({ fileName: "big.png", message: expect.stringContaining("over the") }),
      ]),
    );
    expect(result.current.issues).toHaveLength(2);
    expect(createAssembly).toHaveBeenCalledTimes(1);
    expect(createAssembly.mock.calls[0]?.[0]?.files).toHaveLength(1);
    expect(result.current.attachments.map((a) => a.filename)).toEqual(["good.png"]);
  });

  it("rejects files beyond maxAttachmentsPerMessage with a specific message", async () => {
    const limits = { ...DEFAULT_LIMITS, allowedMimeTypes: ["image/png"], maxAttachmentsPerMessage: 1 };
    mockCreateAssembly();
    const { result } = renderHook(() => useUploader(null, limits));

    await act(async () => {
      await result.current.addFiles([makeFile("one.png", "image/png", 10), makeFile("two.png", "image/png", 10)]);
    });

    expect(result.current.issues).toEqual([expect.objectContaining({ fileName: "two.png", message: expect.stringContaining("up to 1 files") })]);
    expect(result.current.attachments.map((a) => a.filename)).toEqual(["one.png"]);
  });

  it("creates the assembly with sequential, gap-continuing positions and forwards assemblyOptions to Transloadit", async () => {
    const createAssembly = mockCreateAssembly();
    const { result } = renderHook(() => useUploader("chat_1", DEFAULT_LIMITS));

    await act(async () => {
      await result.current.addFiles([makeFile("a.png", "image/png", 10), makeFile("b.png", "image/png", 10)]);
    });

    const firstCallFiles = createAssembly.mock.calls[0]?.[0]?.files ?? [];
    expect(firstCallFiles.map((f) => f.position)).toEqual([0, 1]);
    expect(result.current.attachments.every((a) => a.status === "uploading" && a.attachmentId)).toBe(true);

    const uppy = latestUppy();
    expect(uppy.pluginOpts).toMatchObject({ assemblyOptions: { params: "{}", signature: "sig" }, waitForEncoding: false, waitForMetadata: true });

    await act(async () => {
      await result.current.addFiles([makeFile("c.png", "image/png", 10)]);
    });
    const secondCallFiles = createAssembly.mock.calls[1]?.[0]?.files ?? [];
    expect(secondCallFiles.map((f) => f.position)).toEqual([2]);
  });

  it("updates progress from Uppy events and cancelFile removes the upload and marks it cancelled", async () => {
    mockCreateAssembly();
    const { result } = renderHook(() => useUploader(null, DEFAULT_LIMITS));

    await act(async () => {
      await result.current.addFiles([makeFile("a.png", "image/png", 10)]);
    });
    const clientId = result.current.attachments[0]?.clientId;
    if (!clientId) throw new Error("expected a pending attachment");
    const uppy = latestUppy();
    const uppyFile = uppy.fileByClientId(clientId);
    if (!uppyFile) throw new Error("expected uppy to have the file");

    act(() => {
      uppy.emit("upload-progress", uppyFile, { bytesTotal: 200, bytesUploaded: 50 });
    });
    expect(result.current.attachments.find((a) => a.clientId === clientId)?.progress).toBe(25);

    act(() => {
      result.current.cancelFile(clientId);
    });
    // Uppy regenerates its own file id (never the clientId — see the MockUppy doc comment above),
    // so cancelFile must remove by that real id, not by clientId, or the removal is a silent no-op.
    expect(uppyFile.id).not.toBe(clientId);
    expect(uppy.removeFile).toHaveBeenCalledWith(uppyFile.id);
    expect(uppy.removeFile).not.toHaveBeenCalledWith(clientId);
    expect(result.current.attachments.find((a) => a.clientId === clientId)?.status).toBe("cancelled");
  });

  it("calls attachmentsService.uploaded once per assembly and polls attachmentsService.list until ready", async () => {
    mockCreateAssembly();
    const uploaded = vi.spyOn(attachmentsService, "uploaded").mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useUploader(null, DEFAULT_LIMITS));

    await act(async () => {
      await result.current.addFiles([makeFile("a.png", "image/png", 10)]);
    });
    const attachment = result.current.attachments[0];
    if (!attachment?.clientId || !attachment.attachmentId) throw new Error("expected an uploading attachment");
    const { clientId, attachmentId } = attachment;
    const uppy = latestUppy();
    const uppyFile = uppy.fileByClientId(clientId);
    if (!uppyFile) throw new Error("expected uppy to have the file");
    const successFile = { ...uppyFile, uploadURL: "https://transloadit.example/up1" };

    const list = vi.spyOn(attachmentsService, "list").mockResolvedValue({
      items: [makeAttachment(clientId, 0, { id: attachmentId, status: "ready", previewUrl: "https://cdn.example/a.png" })],
      nextCursor: null,
    });

    vi.useFakeTimers();
    await act(async () => {
      uppy.emit("transloadit:assembly-created", { assembly_id: "asm_1" });
      uppy.emit("upload-success", successFile);
      uppy.emit("complete", { successful: [successFile] });
      await vi.runAllTimersAsync();
    });

    expect(uploaded).toHaveBeenCalledTimes(1);
    expect(uploaded).toHaveBeenCalledWith({ assemblyId: "asm_1", files: [{ attachmentId, uploadUrl: "https://transloadit.example/up1" }] });
    expect(list).toHaveBeenCalled();
    expect(result.current.attachments.find((a) => a.clientId === clientId)?.status).toBe("ready");
  });

  it("keeps attachments ordered by pick position even when uploads complete out of order", async () => {
    mockCreateAssembly();
    const { result } = renderHook(() => useUploader(null, DEFAULT_LIMITS));

    await act(async () => {
      await result.current.addFiles([makeFile("a.png", "image/png", 10), makeFile("b.png", "image/png", 10)]);
    });
    const [first, second] = result.current.attachments;
    if (!first || !second) throw new Error("expected two pending attachments");
    const uppy = latestUppy();
    const fileA = uppy.fileByClientId(first.clientId);
    const fileB = uppy.fileByClientId(second.clientId);
    if (!fileA || !fileB) throw new Error("expected uppy to have both files");

    // B finishes before A.
    act(() => {
      uppy.emit("upload-success", fileB);
      uppy.emit("upload-success", fileA);
    });

    const byPosition = [...result.current.attachments].sort((a, b) => a.position - b.position);
    expect(byPosition.map((a) => a.filename)).toEqual(["a.png", "b.png"]);
    expect(byPosition.every((a) => a.status === "processing")).toBe(true);
  });

  it("fails the whole batch when the assembly itself is rejected (bad signature, expired, over plan limits)", async () => {
    mockCreateAssembly();
    const { result } = renderHook(() => useUploader(null, DEFAULT_LIMITS));

    await act(async () => {
      await result.current.addFiles([makeFile("a.png", "image/png", 10), makeFile("b.png", "image/png", 10)]);
    });
    const uppy = latestUppy();

    act(() => {
      uppy.emit("transloadit:assembly-error", {}, new Error("INVALID_SIGNATURE"));
    });

    expect(result.current.attachments.every((a) => a.status === "failed" && a.error === "INVALID_SIGNATURE")).toBe(true);
    expect(uppy.destroy).toHaveBeenCalled();
    // Never got a real upload id, so cancel/retry must not throw trying to look one up.
    expect(() => result.current.cancelFile(result.current.attachments[0]?.clientId ?? "")).not.toThrow();
  });
});
