"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, ImagePlus, RefreshCw, X, Loader2 } from "lucide-react";
import { processImageFile, processVideoFrame } from "@/lib/image";
import {
  getCameraStream,
  pauseCameraStream,
  isCameraSupported,
} from "@/lib/camera/streamManager";

/**
 * Умная живая камера CaloriSnap с сохранением сессии разрешения:
 * - Запрашивает доступ к камере один раз, сохраняет сессию и deviceId.
 * - При переходах и между снимками держит поток в тёплом режиме, предотвращая
 *   повторные системные диалоги Safari/Chrome.
 * - При сбоях или отказе плавно предлагает выбор из галереи и подсказку по настройке.
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

  const handleRetryCamera = useCallback(async (forceFresh = true) => {
    if (!isCameraSupported()) {
      setStreamError(true);
      setStarting(false);
      return;
    }
    setStarting(true);
    setStreamError(false);

    try {
      const stream = await getCameraStream(forceFresh);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStarting(false);
    } catch (err) {
      console.warn("Не удалось инициализировать камеру:", err);
      setStreamError(true);
      setStarting(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!isCameraSupported()) {
        if (!cancelled) {
          setStreamError(true);
          setStarting(false);
        }
        return;
      }

      try {
        const stream = await getCameraStream(false);
        if (cancelled) return;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        if (!cancelled) {
          setStarting(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("Не удалось инициализировать камеру:", err);
          setStreamError(true);
          setStarting(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      // При уходе со страницы переводим поток в спящий режим
      // вместо уничтожения, сохраняя разрешение браузера
      pauseCameraStream();
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
    <div className="overflow-hidden rounded-3xl bg-black shadow-lg border border-border/40">
      <div className="relative aspect-[4/3] w-full bg-black/90">
        {!streamError ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`h-full w-full object-cover transition-opacity duration-300 ${
                starting ? "opacity-0" : "opacity-100"
              }`}
            />
            {starting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-xs font-medium text-white/80">Подключение камеры…</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-card p-6 text-center">
            <div className="rounded-full bg-warning/15 p-3 text-warning">
              <Camera className="h-8 w-8" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Камера недоступна или доступ запрещён</h3>
            <p className="text-xs text-muted-foreground max-w-xs">
              Разрешите доступ к камере в браузере или загрузите фото еды из галереи.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
              <button
                onClick={() => handleRetryCamera(true)}
                className="btn-glossy spring-press flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Повторить запрос
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-glossy spring-press flex items-center gap-1.5 rounded-full bg-muted border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted/80"
              >
                <ImagePlus className="h-3.5 w-3.5 text-primary" /> Выбрать из галереи
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground/80 mt-1 max-w-xs leading-tight">
              В Safari на iPhone: нажмите «АА» в строке адреса → «Настройки веб-сайта» → «Камера: Разрешить».
            </p>
          </div>
        )}

        {/* Прячем видео после снятия кадра */}
        {captured && !streamError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-xs">
            <p className="text-sm font-semibold text-white">Фото готово к анализу!</p>
          </div>
        )}
      </div>

      {/* Панель управления */}
      {!streamError && !captured && (
        <div className="flex items-center justify-center gap-8 bg-black py-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label="Выбрать фото из галереи"
            title="Выбрать фото из галереи"
            className="rounded-full p-2.5 text-white/80 transition-colors hover:text-white hover:bg-white/10 active:scale-95"
          >
            <ImagePlus className="h-6 w-6" />
          </button>

          <button
            onClick={capture}
            disabled={starting}
            aria-label="Сфотографировать"
            className="flex h-18 w-18 items-center justify-center rounded-full border-4 border-white p-1 transition-transform active:scale-90 hover:scale-105 disabled:opacity-50"
          >
            <span className="h-14 w-14 rounded-full bg-white transition-opacity active:opacity-80" />
          </button>

          <button
            onClick={() => handleRetryCamera(true)}
            aria-label="Обновить камеру"
            title="Обновить камеру"
            className="rounded-full p-2.5 text-white/60 transition-colors hover:text-white hover:bg-white/10 active:scale-95"
          >
            <RefreshCw className="h-5 w-5" />
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
            className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm text-white hover:bg-white/20 transition-colors"
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
