/**
 * Story 8.8 — сканер чистоты логов (NFR9): ловит утечку секретов в захваченном
 * выводе логгера по СОДЕРЖИМОМУ значения. Дополняет 8.7 (key-based маскирование +
 * ESLint): ловит секрет под несекретным ключом и интерполяцию в message-строку.
 * Переиспользуем в CI-гейте по общему test-run stdout.
 */

/**
 * Регэкспы тест-секретов из фикстур. Соглашение именования: тест-секрет всегда с
 * суффиксом-разделителем (`test-password-…`), чтобы общий скан не зажигался на
 * легитимных production-логах (реальные секреты так не выглядят).
 */
export const SENSITIVE_TEST_PATTERNS: readonly RegExp[] = [
  /test-password-[\w-]+/i,
  /secret-[\w-]+/i,
  /private-key-[\w-]+/i,
  /wif-[\w-]+/i,
  /mnemonic-[\w-]+/i,
  /seed-[\w-]+/i,
];

export interface SensitiveLeak {
  /** Номер строки в захваченном выводе (1-based) — для сообщения «at line N». */
  line: number;
  /** Источник срабатывания: regex-паттерн или 'exact-fixture'. */
  pattern: string;
  /** Найденная подстрока (само утёкшее значение). */
  match: string;
}

/**
 * Построчно сканирует output на тест-секрет-паттерны и на точные значения фикстур
 * (`exactValues`). Возвращает все утечки с номерами строк.
 */
export function findSensitiveLeaks(output: string, exactValues: string[] = []): SensitiveLeak[] {
  const leaks: SensitiveLeak[] = [];
  const lines = output.split('\n');
  lines.forEach((text, index) => {
    for (const re of SENSITIVE_TEST_PATTERNS) {
      const m = text.match(re);
      if (m) leaks.push({ line: index + 1, pattern: re.source, match: m[0] });
    }
    for (const value of exactValues) {
      if (value && text.includes(value)) leaks.push({ line: index + 1, pattern: 'exact-fixture', match: value });
    }
  });
  return leaks;
}

/**
 * Бросает на первой утечке с сообщением «Sensitive value leaked to logs at line N»
 * (формат из AC 8.8). Чисто → no-op.
 */
export function assertNoSensitiveLeaks(output: string, exactValues: string[] = []): void {
  const leaks = findSensitiveLeaks(output, exactValues);
  if (leaks.length) {
    const first = leaks[0];
    throw new Error(`Sensitive value leaked to logs at line ${first.line}: ${first.match} (pattern ${first.pattern})`);
  }
}
