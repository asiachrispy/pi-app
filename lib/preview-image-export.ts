import { getFileName } from "@/lib/file-paths";

const MAX_CANVAS_DIMENSION = 16_000;

export function calculatePreviewImageExportSize(
  width: number,
  height: number,
  devicePixelRatio = 1,
): { width: number; height: number; scale: number; outputWidth: number; outputHeight: number } {
  const normalizedWidth = Math.ceil(Math.max(width, 1));
  const normalizedHeight = Math.ceil(Math.max(height, 1));
  const preferredScale = Math.min(Math.max(devicePixelRatio || 1, 1), 2);
  const maxScale = Math.min(
    preferredScale,
    MAX_CANVAS_DIMENSION / normalizedWidth,
    MAX_CANVAS_DIMENSION / normalizedHeight,
  );
  const scale = Math.max(maxScale, Number.EPSILON);
  return {
    width: normalizedWidth,
    height: normalizedHeight,
    scale,
    outputWidth: Math.max(1, Math.ceil(normalizedWidth * scale)),
    outputHeight: Math.max(1, Math.ceil(normalizedHeight * scale)),
  };
}

function inlineComputedStyles(source: Element, target: Element): void {
  if (target instanceof HTMLElement || target instanceof SVGElement) {
    const computed = window.getComputedStyle(source);
    for (const property of computed) {
      target.style.setProperty(
        property,
        computed.getPropertyValue(property),
        computed.getPropertyPriority(property),
      );
    }
  }

  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);
  sourceChildren.forEach((child, index) => {
    const targetChild = targetChildren[index];
    if (targetChild) inlineComputedStyles(child, targetChild);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to render preview image"));
    image.src = src;
  });
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function getExportSize(element: HTMLElement): ReturnType<typeof calculatePreviewImageExportSize> {
  const rect = element.getBoundingClientRect();
  const width = Math.ceil(Math.max(rect.width, element.scrollWidth, 1));
  const height = Math.ceil(Math.max(rect.height, element.scrollHeight, 1));
  return calculatePreviewImageExportSize(width, height, window.devicePixelRatio || 1);
}

function backgroundColorFor(element: HTMLElement): string {
  const color = window.getComputedStyle(element).backgroundColor;
  if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return "#fff";
  return color;
}

function cloneElementForExport(element: HTMLElement): HTMLElement {
  const clone = document.createElement("div");
  clone.innerHTML = element.innerHTML;
  inlineComputedStyles(element, clone);
  return clone;
}

export function makePreviewImageFileName(filePath: string): string {
  const name = getFileName(filePath).replace(/\.[^.]+$/, "") || "preview";
  return `${name}.png`;
}

export async function renderElementToPngBlob(element: HTMLElement): Promise<Blob> {
  const { width, height, scale, outputWidth, outputHeight } = getExportSize(element);
  const clone = cloneElementForExport(element);
  clone.style.width = `${width}px`;
  clone.style.minHeight = `${height}px`;
  clone.style.boxSizing = "border-box";
  clone.style.background = backgroundColorFor(element);

  const wrapper = document.createElement("div");
  wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrapper.style.width = `${width}px`;
  wrapper.style.minHeight = `${height}px`;
  wrapper.style.background = clone.style.background;
  wrapper.appendChild(clone);

  const serialized = new XMLSerializer().serializeToString(wrapper);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${outputWidth} ${outputHeight}">`,
    `<foreignObject width="${width}" height="${height}" transform="scale(${scale})">${serialized}</foreignObject>`,
    "</svg>",
  ].join("");
  const image = await loadImage(svgToDataUrl(svg));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.drawImage(image, 0, 0, outputWidth, outputHeight);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to create preview image"));
    }, "image/png");
  });
}

export async function copyPngBlobToClipboard(blob: Blob): Promise<void> {
  const clipboard = navigator.clipboard as Clipboard & {
    write?: (items: ClipboardItem[]) => Promise<void>;
  };
  if (!clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Image clipboard is not supported in this browser");
  }
  await clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export function downloadPngBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
