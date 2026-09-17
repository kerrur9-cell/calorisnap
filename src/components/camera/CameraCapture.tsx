"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, RefreshCcw, X } from "lucide-react";
import { cameraSupported, processImageFile, processVideoFrame } from "@/lib/image";

/**
 * Живая камера с fallback на выбор файла.
 * - Приоритет: фронтальная (та, что смотрит на еду) → environment.
 * - Если getUserMedia недоступен (не-HTTPS/отказ) → стикер «выбрать фото».
 */
export function CameraCapture({
  onCapture,
}: {
  onCapture: (data: { dataBase64: string; mimeType: string }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [streamError, setStreamError] = useState(false);
  const [starting, setStarting] = useState(true);
  const [captured, setCaptured] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!cameraSupported()) {
        setStreamError(true);
        setStarting(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) setStreamError(true);
      } finally {
        if (!cancelled) setStarting(false);
      }
    }

    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const img = await processVideoFrame(video);
    setCaptured(true);
    onCapture({ dataBase64: img.dataBase64, mimeType: "image/jpeg" });
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const img = await processImageFile(file);
      setCaptured(true);
      onCapture({ dataBase64: img.dataBase64, mimeType: img.mimeType });
    } catch {
      alert("Не удалось открыть фото. Попробуйте другое изображение (JPEG/PNG).");
    }
    e.target.value = "";
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-black">
      <div className="relative aspect-[4/3] w-full">
        {!streamError ? (
          <video
            ref={videoRef}
            playsInline
            muted
            className={`h-full w-full object-cover transition-opacity ${
              starting ? "opacity-0" : "opacity-100"
            }`}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-muted p-6 text-center">
            <Camera className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Камера недоступна.<br />Выберите фото из галереи:
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              <ImagePlus className="h-4 w-4" /> Выбрать фото
            </button>
          </div>
        )}

        {/* Прячем видео после снятия кадра */}
        {captured && !streamError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <p className="text-sm font-medium text-white">Фото снято!</p>
          </div>
        )}
      </div>

      {/* Панель управления */}
      {!streamError && !captured && (
        <div className="flex items-center justify-center gap-8 bg-black py-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label="Выбрать фото из галереи"
            className="rounded-full p-2 text-white/80 transition-colors hover:text-white"
          >
            <ImagePlus className="h-7 w-7" />
          </button>

          <button
            onClick={capture}
            aria-label="Сфотографировать"
            className="flex h-18 w-18 items-center justify-center rounded-full border-4 border-white p-1 transition-transform active:scale-95"
          >
            <span className="h-14 w-14 rounded-full bg-white" />
          </button>

          <button
            onClick={async () => {
              if (fileInputRef.current) fileInputRef.current.click();
            }}
            aria-label="Выбрать другое фото"
            className="rounded-full p-2 text-white/50 transition-colors hover:text-white"
          >
            <RefreshCcw className="h-6 w-6" />
          </button>
        </div>
      )}

      {captured && (
        <div className="flex items-center justify-center gap-4 bg-black py-4">
          <button
            onClick={() => {
              setCaptured(false);
              onCapture({ dataBase64: "", mimeType: "" });
            }}
            className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm text-white"
          >
            <X className="h-4 w-4" /> Переснять
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />
    </div>
  );
}
