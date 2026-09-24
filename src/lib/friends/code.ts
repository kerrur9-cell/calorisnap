/**
 * Утилиты для работы с персональными кодами друзей формата CAL-XXXX-XXXX
 */

const FRIEND_CODE_REGEX = /^CAL-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;

/**
 * Проверяет соответствие строки формату CAL-XXXX-XXXX
 * Исключены символы 0, O, 1, I для исключения опечаток.
 */
export function isValidFriendCode(code: string): boolean {
  if (!code) return false;
  return FRIEND_CODE_REGEX.test(code.trim().toUpperCase());
}

/**
 * Нормализует введенный код (верхний регистр, обрезка пробелов).
 */
export function normalizeFriendCode(input: string): string {
  if (!input) return "";
  return input.trim().toUpperCase();
}

/**
 * Форматирует частичный или полный ввод пользователя:
 * Удаляет спецсимволы, приводит к верхнему регистру, добавляет префикс CAL- при необходимости.
 */
export function formatFriendCodeInput(raw: string): string {
  if (!raw) return "";
  let clean = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");

  // Если пользователь начал вводить без CAL, но вводит буквы/цифры
  if (clean.startsWith("CAL")) {
    clean = clean.slice(3);
  }

  // Очищаем от недопустимых символов (0, O, 1, I)
  clean = clean.replace(/[0O1I]/g, "");

  let result = "CAL";
  if (clean.length > 0) {
    result += "-" + clean.slice(0, 4);
  }
  if (clean.length > 4) {
    result += "-" + clean.slice(4, 8);
  }
  return result;
}
