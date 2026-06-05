import { describe, expect, it } from "vitest";
import { calculatePreviewImageExportSize, makePreviewImageFileName } from "./preview-image-export";

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
