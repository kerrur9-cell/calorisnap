/**
 * Сжатие фото на клиенте. Это критично: меньше payload → быстрее ответ Gemini
 * и дешевле. Формат должен поддерживаться декодером браузера (HEIC не везде доступен).
 */

export interface ProcessedImage {
  dataBase64: string; // без data: префикса
  mimeType: string;
  width: number;
  height: number;
}

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.8;

function resizeCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function processImageFile(file: File): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file);
  const canvas = resizeCanvas(bitmap, bitmap.width, bitmap.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return {
    dataBase64: dataUrl.split(",")[1],
    mimeType: "image/jpeg",
    width: canvas.width,
    height: canvas.height,
  };
}

export async function processVideoFrame(
  video: HTMLVideoElement,
): Promise<ProcessedImage> {
  const canvas = resizeCanvas(video, video.videoWidth, video.videoHeight);
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return {
    dataBase64: dataUrl.split(",")[1],
    mimeType: "image/jpeg",
    width: canvas.width,
    height: canvas.height,
  };
}

/** Возможность использования камеры */
export function cameraSupported(): boolean {
  return typeof navigator !== "undefined" && "mediaDevices" in navigator;
}
