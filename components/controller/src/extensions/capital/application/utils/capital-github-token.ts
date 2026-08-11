
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

/**
 * Чем разжать сохранённый токен и чем его заменить, если своего нет.
 *
 * Передаётся аргументом, а не берётся из ядра: расшифровка живёт за портом, а
 * запасной токен контура — за настройками внешних служб.
 */
export interface CapitalGithubTokenSources {
  decrypt(ciphertext: string): string;
  /** Токен контура: используется, когда в настройке расширения своего нет. */
  fallbackToken?: string;
}

export function tryDecryptCapitalGithubStoredToken(
  stored: string,
  sources: Pick<CapitalGithubTokenSources, 'decrypt'>
): string | null {
  if (!stored || !looksLikeAesEncryptedPayload(stored)) {
    return null;
  }
  try {
    const plain = sources.decrypt(stored);
    return plain.length > 0 ? plain : null;
  } catch {
    return null;
  }
}

/**
 * Плоский токен для GitHub API: значение из конфига Capital (AES-строка из `encrypt()` или plaintext при ручной настройке), иначе GITHUB_TOKEN из окружения.
 */
export function resolveCapitalGithubApiPlainToken(
  githubApiTokenEncrypted: string | undefined,
  sources: CapitalGithubTokenSources
): string {
  const raw = typeof githubApiTokenEncrypted === 'string' ? githubApiTokenEncrypted.trim() : '';
  if (raw.length > 0) {
    const decrypted = tryDecryptCapitalGithubStoredToken(raw, sources);
    if (decrypted) {
      return decrypted;
    }
    return raw;
  }
  const fallback = sources.fallbackToken;
  return typeof fallback === 'string' && fallback.length > 0 ? fallback : '';
}

export function hasEffectiveCapitalGithubApiToken(
  githubApiTokenEncrypted: string | undefined,
  sources: CapitalGithubTokenSources
): boolean {
  return resolveCapitalGithubApiPlainToken(githubApiTokenEncrypted, sources).length > 0;
}
