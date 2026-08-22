/**
 * Человекочитаемое описание входа для уведомления «вход с нового устройства».
 *
 * Сырой User-Agent («Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)…») пайщику
 * ничего не говорит и раздувает текст — сводим его к «Chrome на macOS».
 * Полный UA остаётся в device-tracking'е для форензики, тут только витрина.
 */

/** Браузер по маркерам UA. Порядок важен: Chrome-клоны объявляют и Chrome тоже. */
function browserOf(ua: string): string | null {
  if (/YaBrowser\//i.test(ua)) return 'Яндекс Браузер';
  if (/Edg(e|A|iOS)?\//i.test(ua)) return 'Edge';
  if (/(OPR|Opera)\//i.test(ua)) return 'Opera';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/CriOS\//i.test(ua)) return 'Chrome';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Version\/[\d.]+.*Safari\//i.test(ua)) return 'Safari';
  return null;
}

function osOf(ua: string): string | null {
  if (/iPhone|iPod/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows NT/i.test(ua)) return 'Windows';
  if (/Mac OS X/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return null;
}

/** «Chrome на macOS» / «Safari» / «неизвестное устройство». */
export function describeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent) return 'неизвестное устройство';
  const browser = browserOf(userAgent);
  const os = osOf(userAgent);
  if (browser && os) return `${browser} на ${os}`;
  if (browser) return browser;
  if (os) return os;
  return 'неизвестное устройство';
}

/** Приватный/служебный адрес: гео спрашивать не у кого, это локальная сеть. */
export function isPrivateIp(ip: string): boolean {
  const bare = ip.replace(/^::ffff:/i, '');
  if (bare === '::1' || bare === 'localhost') return true;
  if (/^(10\.|127\.|192\.168\.|169\.254\.)/.test(bare)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(bare)) return true;
  // fc00::/7 (ULA) и fe80::/10 (link-local)
  if (/^f[cd][0-9a-f]{2}:/i.test(bare) || /^fe[89ab][0-9a-f]:/i.test(bare)) return true;
  return false;
}

/** Таймаут гео-запроса: уведомление не должно ждать внешний сервис заметное время. */
const GEO_TIMEOUT_MS = 2500;

/**
 * Гео по публичному IP через ipwho.is (бесплатно, без ключа) — строго best-effort:
 * любой сбой/таймаут → null, уведомление уходит без геометки. Для приватных
 * адресов внешний сервис не спрашиваем — это заведомо «локальная сеть».
 */
export async function resolveIpLocation(ip: string | null | undefined): Promise<string | null> {
  if (!ip) return null;
  const bare = ip.replace(/^::ffff:/i, '');
  if (isPrivateIp(bare)) return 'локальная сеть';
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(bare)}`, {
      signal: AbortSignal.timeout(GEO_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as
      | { success?: boolean; city?: string; country?: string }
      | null;
    if (!data?.success) return null;
    const parts = [data.city, data.country].filter((s): s is string => !!s && s.trim().length > 0);
    return parts.length ? parts.join(', ') : null;
  } catch {
    return null;
  }
}
