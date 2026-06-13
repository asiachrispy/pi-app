import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  calculatePreviewImageExportSize,
  copyPreviewPng,
  makePreviewImageFileName,
  savePreviewPng,
} from "./preview-image-export";

describe("makePreviewImageFileName", () => {
  it("uses the preview file basename with a png extension", () => {
    expect(makePreviewImageFileName("/tmp/report.md")).toBe("report.png");
    expect(makePreviewImageFileName("/tmp/nested/report.final.html")).toBe("report.final.png");
  });

  it("falls back for extensionless paths", () => {
    expect(makePreviewImageFileName("/tmp/README")).toBe("README.png");
  });
});

describe("calculatePreviewImageExportSize", () => {
  it("uses a capped retina scale for normal previews", () => {
    expect(calculatePreviewImageExportSize(400, 300, 3)).toEqual({
      width: 400,
      height: 300,
      scale: 2,
      outputWidth: 800,
      outputHeight: 600,
    });
  });

  it("downscales very tall previews so the canvas stays exportable", () => {
    const size = calculatePreviewImageExportSize(1000, 80_000, 2);

    expect(size.width).toBe(1000);
    expect(size.height).toBe(80_000);
    expect(size.outputWidth).toBe(200);
    expect(size.outputHeight).toBe(16_000);
    expect(size.outputHeight).toBeLessThanOrEqual(16_000);
  });

  it("normalizes empty dimensions to a drawable canvas", () => {
    expect(calculatePreviewImageExportSize(0, 0, 0)).toEqual({
      width: 1,
      height: 1,
      scale: 1,
      outputWidth: 1,
      outputHeight: 1,
    });
  });
});

// @vitest-environment jsdom
describe("copyPreviewPng / savePreviewPng", () => {
  // The piNative bridge is window-scoped, so we mock the global directly
  // and restore it after each test. We do not need a DOM because
  // copyPreviewPng / savePreviewPng short-circuit to piNative before
  // touching navigator.clipboard in the happy-path tests below.
  const w = globalThis as unknown as { window?: { piNative?: unknown } };
  const originalWindow = w.window;

  beforeEach(() => {
    w.window = { piNative: undefined };
  });

  afterEach(() => {
    w.window = originalWindow;
  });

  it("uses the piNative bridge when present (copy)", async () => {
    const copyImage = vi.fn().mockResolvedValue(undefined);
    if (w.window) w.window.piNative = { copyImage };

    const blob = new Blob(["fake-png"], { type: "image/png" });
    await copyPreviewPng(blob, "report.png");

    expect(copyImage).toHaveBeenCalledTimes(1);
    const arg = copyImage.mock.calls[0]?.[0];
    expect(typeof arg).toBe("string");
    expect(arg).toMatch(/^data:image\/png;base64,/);
  });

  it("uses the piNative bridge when present (save)", async () => {
    const saveImage = vi.fn().mockResolvedValue(undefined);
    if (w.window) w.window.piNative = { saveImage };

    const blob = new Blob(["fake-png"], { type: "image/png" });
    await savePreviewPng(blob, "report.png");

    expect(saveImage).toHaveBeenCalledTimes(1);
    const [dataUrl, fileName] = saveImage.mock.calls[0] ?? [];
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(fileName).toBe("report.png");
  });
});
