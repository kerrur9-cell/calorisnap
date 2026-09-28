/**
 * Менеджер сессии камеры CaloriSnap.
 *
 * Проблема:
 * По умолчанию вызов getUserMedia при каждом монтировании компонента и завершение
 * потока через track.stop() заставляет мобильные браузеры (особенно Safari на iOS
 * и PWA) повторно запрашивать системное разрешение на доступ к камере при каждой съёмке.
 *
 * Решение:
 * 1. Сохранение активной сессии потока (MediaStream) между кадрами и переходами.
 * 2. При уходе со страницы или после съемки кадра треки переводятся в спящий режим
 *    (track.enabled = false), сохраняя выданное браузером разрешение без повторного диалога.
 * 3. При повторном открытии видоискателя треки мгновенно активируются (track.enabled = true)
 *    БЕЗ вызова getUserMedia и без повторных запросов разрешений.
 * 4. Сохранение deviceId проверенной задней камеры в localStorage для ускоренного подключения.
 * 5. Автоматическое освобождение ресурсов по таймеру простоя (3 минуты) или закрытию вкладки.
 */

let activeStream: MediaStream | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

const DEVICE_ID_KEY = "calorisnap_camera_device_id";
const GRANTED_KEY = "calorisnap_camera_granted";
const IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 минуты удержания в тёплом состоянии

/**
 * Проверяет, поддерживается ли getUserMedia в текущем окружении.
 */
export function isCameraSupported(): boolean {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    return false;
  }
  return typeof navigator.mediaDevices.getUserMedia === "function";
}

/**
 * Возвращает сохраненный deviceId камеры, если ранее было получено разрешение.
 */
export function getSavedCameraDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(DEVICE_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Проверяет, было ли ранее подтверждено разрешение на камеру.
 */
export function wasCameraPermissionGranted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(GRANTED_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Проверяет статус Permissions API для камеры, если поддерживается браузером.
 */
export async function queryCameraPermissionStatus(): Promise<"granted" | "denied" | "prompt" | "unknown"> {
  if (typeof navigator === "undefined" || !navigator.permissions) {
    return "unknown";
  }
  try {
    const status = await navigator.permissions.query({ name: "camera" as PermissionName });
    return status.state;
  } catch {
    return "unknown";
  }
}

/**
 * Проверяет, активен ли уже кешированный поток камеры.
 */
export function hasLiveCameraStream(): boolean {
  if (!activeStream) return false;
  const tracks = activeStream.getVideoTracks();
  return tracks.length > 0 && tracks.some((t) => t.readyState === "live");
}

/**
 * Получает поток камеры. Если поток уже был открыт и жив,
 * активирует его треки без повторного запроса к пользователю.
 */
export async function getCameraStream(forceFresh = false): Promise<MediaStream> {
  if (!isCameraSupported()) {
    throw new Error("Камера не поддерживается вашим браузером или контекст не безопасен (HTTPS)");
  }

  // 1. Отменяем таймер сброса потока
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  // 2. Если есть тёплый живой поток и не запрошен принудительный перезапуск
  if (!forceFresh && activeStream) {
    const tracks = activeStream.getVideoTracks();
    const liveTracks = tracks.filter((t) => t.readyState === "live");
    if (liveTracks.length > 0) {
      liveTracks.forEach((track) => {
        track.enabled = true;
      });
      return activeStream;
    }
  }

  // 3. Закрываем старый завершенный поток перед запросом нового
  if (activeStream) {
    activeStream.getTracks().forEach((t) => t.stop());
    activeStream = null;
  }

  // 4. Формируем мягкие (ideal) ограничения с учётом ранее сохранённого deviceId
  const savedDeviceId = getSavedCameraDeviceId();

  const constraints: MediaStreamConstraints = {
    audio: false,
    video: savedDeviceId
      ? {
          deviceId: { ideal: savedDeviceId },
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }
      : {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    activeStream = stream;

    // Сохраняем deviceId полученного трека
    const track = stream.getVideoTracks()[0];
    if (track) {
      const settings = track.getSettings();
      if (settings.deviceId && typeof window !== "undefined") {
        try {
          localStorage.setItem(DEVICE_ID_KEY, settings.deviceId);
          localStorage.setItem(GRANTED_KEY, "true");
        } catch {}
      }

      // Отслеживаем завершение трека со стороны системы
      track.onended = () => {
        if (activeStream === stream) {
          activeStream = null;
        }
      };
    }

    // Слушатели закрытия вкладки для освобождения ресурсов
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", stopCameraStream, { once: true });
      window.addEventListener("pagehide", stopCameraStream, { once: true });
    }

    return stream;
  } catch (err) {
    // Если запрос с savedDeviceId завершился ошибкой OverconstrainedError,
    // пробуем запасной вариант с базовым facingMode: ideal
    if (savedDeviceId) {
      try {
        localStorage.removeItem(DEVICE_ID_KEY);
      } catch {}
      const fallbackStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      activeStream = fallbackStream;
      return fallbackStream;
    }
    throw err;
  }
}

/**
 * Переводит камеру в спящий режим без уничтожения разрешения браузера.
 * Треки остаются зарегистрированными (enabled = false), сенсор не потребляет ресурсы,
 * а при возврате диалог подтверждения не появляется повторно.
 */
export function pauseCameraStream(): void {
  if (activeStream) {
    activeStream.getVideoTracks().forEach((track) => {
      track.enabled = false;
    });
  }

  // Запускаем таймер простоя: если камера не понадобилась в течение 3 минут, освобождаем
  if (idleTimer) {
    clearTimeout(idleTimer);
  }
  idleTimer = setTimeout(() => {
    stopCameraStream();
  }, IDLE_TIMEOUT_MS);
}

/**
 * Полностью останавливает поток и освобождает устройство.
 */
export function stopCameraStream(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (activeStream) {
    activeStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {}
    });
    activeStream = null;
  }
}

/**
 * Только для тестов: сбросить внутреннее состояние синглтона.
 */
export function _resetStreamManagerForTesting(): void {
  stopCameraStream();
}
