/**
 * Грант раскрытия — то, чем кооператив-получатель доказывает согласие держателя (story 7.8, FR-F3).
 *
 * Кооператив B приходит к нам за анкетой человека, которого у нас проверяли по паспорту.
 * Отдавать её по одной только просьбе нельзя, а спросить самого человека мы не можем: у нас
 * нет с ним связи по этому поводу, и вообще это не наш разговор. Спрашивает card.coop —
 * единственный, кто знает обе стороны, — и удостоверяет ответ короткоживущим compact JWS.
 * Грант и есть этот ответ: «держатель такой-то карты разрешил кооперативу B взять его анкету
 * у кооператива A, до такого-то момента».
 *
 * Разбор отделён от криптографии намеренно. Подпись доказывает, что документ не менялся, но
 * не то, что он про нас и не просрочен, — а принять чужой или вечный грант хуже, чем
 * поддельный: поддельный не проходит подпись, чужой прошёл бы.
 *
 * Проверяется грант ключом из JWKS card.coop, а не общим секретом: подключение кооператива к
 * сети не должно требовать передачи секретов, а ротация ключа — обхода всех кооперативов.
 */
import { createPublicKey, verify } from 'node:crypto';

/** Тип документа в заголовке: грант нельзя предъявить вместо заверения цепи доверия и наоборот. */
export const GRANT_TYP = 'cardcoop-grant+jws';

/** Единственный признаваемый издатель согласия. */
export const GRANT_ISSUER = 'card.coop';

/** Единственный алгоритм подписи контура — secp256k1 (DECISION D5 проекта «Карта кооператора»). */
export const GRANT_ALG = 'ES256K';

/**
 * Допуск на расхождение часов, секунды.
 *
 * Грант живёт минуты, и рассинхронизация часов на полминуты не должна превращаться в отказ
 * посреди регистрации человека. Больше брать нельзя: допуск продлевает жизнь гранта ровно
 * на свою величину.
 */
const CLOCK_SKEW_SECONDS = 30;

/** Что сказано в гранте. */
export interface CardcoopGrantClaims {
  /** Кто выпустил — всегда card.coop. */
  iss: string;
  /** Чья анкета — карта держателя. */
  sub: string;
  /** Кому разрешено взять анкету — системное имя кооператива-получателя. */
  aud: string;
  /** У кого брать — системное имя нашего кооператива. */
  from: string;
  /** Идентификатор согласия; он же ключ одноразовости. */
  jti: string;
  /** Момент выпуска, секунды эпохи. */
  iat: number;
  /** Момент истечения, секунды эпохи. */
  exp: number;
}

/** Открытый ключ card.coop, как он лежит в JWKS. */
export interface CardcoopGrantJwk {
  kty: string;
  crv: string;
  x: string;
  y: string;
  kid?: string;
  alg?: string;
  use?: string;
}

/** Разобранный compact JWS до всякой проверки подписи. */
export interface CardcoopGrantParts {
  /** Отпечаток ключа из заголовка; по нему выбирается ключ в JWKS при ротации. */
  kid: string | null;
  claims: CardcoopGrantClaims;
  signingInput: Buffer;
  signature: Buffer;
}

/** Читает строковое поле документа. */
function readString(source: Record<string, unknown>, field: string): string | null {
  const value = source[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Читает числовое поле документа: момент времени в секундах эпохи. */
function readNumber(source: Record<string, unknown>, field: string): number | null {
  const value = source[field];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Разбирает сегмент JWS в объект; всё, что не объект, — не документ. */
function decodeSegment(segment: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Состав утверждений гранта; `null` — предъявлено не то. */
function readClaims(source: Record<string, unknown>): CardcoopGrantClaims | null {
  const iss = readString(source, 'iss');
  const sub = readString(source, 'sub');
  const aud = readString(source, 'aud');
  const from = readString(source, 'from');
  const jti = readString(source, 'jti');
  const iat = readNumber(source, 'iat');
  const exp = readNumber(source, 'exp');

  if (!iss || !sub || !aud || !from || !jti || iat === null || exp === null) return null;
  return { iss, sub, aud, from, jti, iat, exp };
}

/**
 * Разбирает грант, не проверяя подпись.
 *
 * @param grant — строка `<header>.<payload>.<signature>`.
 * @returns Части гранта либо `null`, если это не грант нужного вида.
 */
export function parseGrant(grant: string): CardcoopGrantParts | null {
  const parts = grant.split('.');
  if (parts.length !== 3) return null;

  const [head, body, signature] = parts as [string, string, string];
  const header = decodeSegment(head);
  const payload = decodeSegment(body);
  if (!header || !payload) return null;

  if (header.alg !== GRANT_ALG) return null;
  // Тип обязателен: без него грант и заверение цепи доверия отличались бы только составом
  // полей, и подписанное для одного назначения предъявлялось бы для другого.
  if (header.typ !== GRANT_TYP) return null;

  const claims = readClaims(payload);
  if (!claims || claims.iss !== GRANT_ISSUER) return null;

  return {
    kid: typeof header.kid === 'string' ? header.kid : null,
    claims,
    signingInput: Buffer.from(`${head}.${body}`, 'utf8'),
    signature: Buffer.from(signature, 'base64url'),
  };
}

/**
 * Сходится ли подпись гранта с ключом card.coop.
 *
 * Проверяет Node, а не библиотека цепи: JWKS описывает ключ координатами точки, цепь —
 * сжатой точкой в своём формате, и своя арифметика на кривой ради перевода одного в другое
 * была бы лишним способом ошибиться.
 *
 * @param parts — разобранный грант.
 * @param jwk — ключ из JWKS card.coop.
 * @returns `true`, если подпись сходится; неразбираемый ключ — тоже «не сходится».
 */
export function grantSignatureMatches(parts: CardcoopGrantParts, jwk: CardcoopGrantJwk): boolean {
  // Подпись в JWS — ровно R||S: 64 байта. Всё прочее не разбирается и до проверки не доходит.
  if (parts.signature.length !== 64) return false;

  try {
    const key = createPublicKey({ key: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }, format: 'jwk' });
    return verify('sha256', parts.signingInput, { key, dsaEncoding: 'ieee-p1363' }, parts.signature);
  } catch {
    return false;
  }
}

/**
 * Про нас ли этот грант и не просрочен ли он.
 *
 * @param claims — утверждения гранта.
 * @param coopname — системное имя нашего кооператива.
 * @param now — текущий момент, секунды эпохи.
 * @returns Причина отказа для журнала либо `null`, если грант применим.
 */
export function grantRejectionReason(
  claims: CardcoopGrantClaims,
  coopname: string,
  now: number
): string | null {
  // Анкету у нас — значит `from` обязан быть нами. Иначе это грант на чужую анкету, и
  // предъявитель просто принёс его не в ту дверь.
  if (claims.from !== coopname) return `грант выдан на анкету кооператива ${claims.from}`;
  if (claims.aud === coopname) return 'грант выдан нам же — раскрывать анкету самим себе незачем';
  if (claims.exp <= now - CLOCK_SKEW_SECONDS) return 'грант просрочен';
  if (claims.iat > now + CLOCK_SKEW_SECONDS) return 'грант выпущен будущим временем';

  return null;
}
