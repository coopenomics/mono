// Токен доступа к внешней службе и общий ключ кооператива берутся из ядра
// напрямую. Это последнее место в capital, зависящее от `~/config`, и оно
// уедет вместе с ключами интеграций: им нужен собственный порт под
// capability-гейтом, а не общая расшифровка и не настройки контура.
import config from '~/config/config';
import { decrypt } from '~/utils/aes';

const HEX = /^[0-9a-fA-F]+$/;

/**
 * Строка похожа на payload `encrypt()` из `~/utils/aes` (iv hex + ':' + ciphertext hex).
 */
export function looksLikeAesEncryptedPayload(value: string): boolean {
  const idx = value.indexOf(':');
  if (idx <= 0 || idx === value.length - 1) {
    return false;
  }
  const ivPart = value.slice(0, idx);
  const encPart = value.slice(idx + 1);
  return ivPart.length === IV_LENGTH_HEX && HEX.test(ivPart) && encPart.length > 0 && HEX.test(encPart);
}

const IV_LENGTH_HEX = 32;

export function tryDecryptCapitalGithubStoredToken(stored: string): string | null {
  if (!stored || !looksLikeAesEncryptedPayload(stored)) {
    return null;
  }
  try {
    const plain = decrypt(stored);
    return plain.length > 0 ? plain : null;
  } catch {
    return null;
  }
}

/**
 * Плоский токен для GitHub API: значение из конфига Capital (AES-строка из `encrypt()` или plaintext при ручной настройке), иначе GITHUB_TOKEN из окружения.
 */
export function resolveCapitalGithubApiPlainToken(githubApiTokenEncrypted: string | undefined): string {
  const raw = typeof githubApiTokenEncrypted === 'string' ? githubApiTokenEncrypted.trim() : '';
  if (raw.length > 0) {
    const decrypted = tryDecryptCapitalGithubStoredToken(raw);
    if (decrypted) {
      return decrypted;
    }
    return raw;
  }
  return typeof config.github.token === 'string' && config.github.token.length > 0 ? config.github.token : '';
}

export function hasEffectiveCapitalGithubApiToken(githubApiTokenEncrypted: string | undefined): boolean {
  return resolveCapitalGithubApiPlainToken(githubApiTokenEncrypted).length > 0;
}
