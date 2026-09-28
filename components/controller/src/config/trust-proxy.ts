/**
 * Значение `trust proxy` для Express из строки окружения: `true`/`false`,
 * число звеньев или список адресов и подсетей (`loopback, 10.0.0.0/8`).
 *
 * По умолчанию X-Forwarded-For принимается только от прокси в частных сетях.
 * Прежде ему верили от любого отправителя: на узле за nginx это безопасно
 * (внешний край заголовок затирает), но открытый наружу порт контроллера
 * позволял назваться чужим адресом и обойти лимиты попыток по IP (решение
 * владельца 25.09.2026: стенду — локально, боевому — осторожно; C28-80).
 */
export function parseTrustProxy(value: string): boolean | number | string {
  const v = value.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}
