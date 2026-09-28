import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isCameraSupported,
  getSavedCameraDeviceId,
  wasCameraPermissionGranted,
  hasLiveCameraStream,
  getCameraStream,
  pauseCameraStream,
  stopCameraStream,
  _resetStreamManagerForTesting,
} from "@/lib/camera/streamManager";

describe("CameraStreamManager - persistent camera permission session", () => {
  let mockTrack: {
    readyState: "live" | "ended";
    enabled: boolean;
    stop: ReturnType<typeof vi.fn>;
    getSettings: () => { deviceId: string };
    onended: (() => void) | null;
  };

  let mockStream: {
    getVideoTracks: () => typeof mockTrack[];
    getTracks: () => typeof mockTrack[];
  };

  let getUserMediaMock: ReturnType<typeof vi.fn>;
  let storageStore: Record<string, string> = {};

  const mockLocalStorage = {
    getItem: vi.fn((key: string) => storageStore[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storageStore[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete storageStore[key];
    }),
    clear: vi.fn(() => {
      storageStore = {};
    }),
  };

  beforeEach(() => {
    _resetStreamManagerForTesting();
    storageStore = {};
    vi.stubGlobal("localStorage", mockLocalStorage);

    mockTrack = {
      readyState: "live",
      enabled: true,
      stop: vi.fn(() => {
        mockTrack.readyState = "ended";
      }),
      getSettings: () => ({ deviceId: "mock-camera-back-123" }),
      onended: null,
    };

    mockStream = {
      getVideoTracks: () => [mockTrack],
      getTracks: () => [mockTrack],
    };

    getUserMediaMock = vi.fn().mockResolvedValue(mockStream as unknown as MediaStream);

    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: getUserMediaMock,
      },
    });

    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    _resetStreamManagerForTesting();
    vi.restoreAllMocks();
  });

  it("detects camera support correctly", () => {
    expect(isCameraSupported()).toBe(true);

    vi.stubGlobal("navigator", {});
    expect(isCameraSupported()).toBe(false);
  });

  it("requests camera stream and saves device ID and granted flag to localStorage", async () => {
    const stream = await getCameraStream();

    expect(getUserMediaMock).toHaveBeenCalledTimes(1);
    expect(stream).toBe(mockStream);
    expect(getSavedCameraDeviceId()).toBe("mock-camera-back-123");
    expect(wasCameraPermissionGranted()).toBe(true);
    expect(hasLiveCameraStream()).toBe(true);
  });

  it("reuses existing warm stream without calling getUserMedia again (single permission prompt)", async () => {
    // Первый вызов - запрашивает у браузера
    const stream1 = await getCameraStream();
    expect(getUserMediaMock).toHaveBeenCalledTimes(1);

    // Пауза камеры (например, после съемки кадра или ухода со страницы)
    pauseCameraStream();
    expect(mockTrack.enabled).toBe(false);
    expect(mockTrack.stop).not.toHaveBeenCalled(); // Поток НЕ уничтожен!

    // Второй вызов (возврат к камере для следующего блюда) - восстанавливает треки БЕЗ getUserMedia
    const stream2 = await getCameraStream();
    expect(getUserMediaMock).toHaveBeenCalledTimes(1); // Всё ещё только 1 вызов!
    expect(stream2).toBe(stream1);
    expect(mockTrack.enabled).toBe(true); // Трек снова активен
  });

  it("requests a fresh stream if previous stream track ended", async () => {
    await getCameraStream();
    expect(getUserMediaMock).toHaveBeenCalledTimes(1);

    // Имитируем, что ОС или браузер завершил трек
    mockTrack.readyState = "ended";

    const freshTrack = {
      readyState: "live" as const,
      enabled: true,
      stop: vi.fn(),
      getSettings: () => ({ deviceId: "mock-camera-back-123" }),
      onended: null,
    };
    const freshStream = {
      getVideoTracks: () => [freshTrack],
      getTracks: () => [freshTrack],
    };
    getUserMediaMock.mockResolvedValueOnce(freshStream as unknown as MediaStream);

    const stream2 = await getCameraStream();
    expect(getUserMediaMock).toHaveBeenCalledTimes(2);
    expect(stream2).toBe(freshStream);
  });

  it("stops all tracks when stopCameraStream is called", async () => {
    await getCameraStream();
    expect(hasLiveCameraStream()).toBe(true);

    stopCameraStream();

    expect(mockTrack.stop).toHaveBeenCalledTimes(1);
    expect(hasLiveCameraStream()).toBe(false);
  });

  it("uses saved deviceId in constraints on subsequent fresh requests", async () => {
    storageStore["calorisnap_camera_device_id"] = "saved-lens-xyz";

    await getCameraStream();

    expect(getUserMediaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({
          deviceId: { ideal: "saved-lens-xyz" },
          facingMode: { ideal: "environment" },
        }),
      })
    );
  });
});
