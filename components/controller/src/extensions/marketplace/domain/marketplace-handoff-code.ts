/**
 * Код передачи на участке (задача 598-62). Пайщик показывает QR, оператор
 * сканирует его одним общим сканером, сервер по коду определяет, кто пришёл и
 * за чем. Разбор строки живёт только здесь: стол в браузере код не разбирает,
 * а передаёт строку запросом `marketplaceResolveScan`.
 *
 * Код пайщика — временный: случайная строка из `TOKEN_LENGTH` знаков, которую
 * выдал сервер и которая живёт `HANDOFF_CODE_TTL_HOURS`. Её сервер ищет в
 * таблице кодов и так узнаёт учётную запись. Алфавит без 0/O/1/I — код
 * читается с экрана и набирается руками без ошибок. Кодов пайщика с учётной
 * записью внутри (прежние `receive`/`pickup`) и кода заявления (`return`)
 * больше нет: по ним мог бы прийти кто угодно.
 *
 * Коды предметов постоянны: `<kind>:<coopname>:<ref>`
 *  - `shipment:<coop>:<id партии>`   — QR на накладной экспедитора;
 *  - `container:<coop>:<код бокса>`  — QR на боксе (`BX-0001`).
 * Старый формат с префиксом `blago:` (четыре сегмента) сервер понимает: такие
 * накладные и этикетки уже напечатаны.
 *
 * Ручной ввод без камеры: голый логин пайщика считается кодом заказчика, код
 * бокса с этикетки — кодом бокса.
 */

export const HANDOFF_CODE_TTL_HOURS = 24;
export const TOKEN_LENGTH = 10;
/** Без 0/O/1/I: 32 знака, по пять бит на знак. */
export const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const LEGACY_PREFIX = 'blago';
const SEP = ':';

export enum MarketplaceHandoffCodeKind {
  Shipment = 'shipment',
  Container = 'container',
}

export type MarketplaceHandoffCode =
  | { kind: MarketplaceHandoffCodeKind; coopname: string; ref: string }
  /** Временный код пайщика: учётную запись по нему знает таблица кодов. */
  | { kind: 'token'; coopname: string; ref: string }
  /** Голый логин — ручной ввод оператора. */
  | { kind: 'login'; coopname: string; ref: string };

const KINDS = new Set<string>(Object.values(MarketplaceHandoffCodeKind));

/** Код бокса с этикетки: `BX-0001`. */
const CONTAINER_CODE_RE = /^BX-\d{4,}$/i;

/** Учётная запись цепи: `a-z`, `1-5`, `.`, до 12 символов. */
const ACCOUNT_NAME_RE = /(^[a-z1-5.]{1,11}[a-z1-5]$)|(^[a-z1-5.]{12}[a-j1-5]$)/;

const TOKEN_RE = new RegExp(`^[${TOKEN_ALPHABET}]{${TOKEN_LENGTH}}$`);

/** Голый логин пайщика — ручной путь оператора без камеры. */
export function isAccountName(value: string): boolean {
  return ACCOUNT_NAME_RE.test(value);
}

export function encodeMarketplaceHandoffCode(code: { kind: MarketplaceHandoffCodeKind; coopname: string; ref: string }): string {
  return [code.kind, code.coopname, code.ref].join(SEP);
}

/** Случайный код пайщика из байтов, которые дал вызывающий (`crypto.randomBytes`). */
export function tokenFromBytes(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < TOKEN_LENGTH; i++) out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  return out;
}

/** Строка из сканера или с клавиатуры в виде кода пайщика: без пробелов и дефисов, прописными. */
export function normalizeToken(raw: string): string | null {
  const value = raw.replace(/[\s-]/g, '').toUpperCase();
  return TOKEN_RE.test(value) ? value : null;
}

/**
 * Разобрать строку из сканера или из поля ручного ввода. `null` — строка не
 * является кодом передачи. Принадлежность кооперативу здесь не сверяется:
 * это делает сервис, чтобы ответить своим кодом ошибки. Код пайщика
 * возвращается видом `token`: учётную запись по нему знает только таблица.
 */
export function parseMarketplaceHandoffCode(raw: string, coopname: string): MarketplaceHandoffCode | null {
  const value = raw.trim();
  if (!value) return null;
  return value.includes(SEP) ? parseStructured(value) : parseBare(value, coopname);
}

/** `<kind>:<coop>:<ref>` либо старый `blago:<kind>:<coop>:<ref>`. */
function parseStructured(value: string): MarketplaceHandoffCode | null {
  const parts = value.split(SEP);
  if (parts.length === 4 && parts[0] === LEGACY_PREFIX) parts.shift();
  if (parts.length !== 3) return null;
  const [kind, codeCoopname, ref] = parts;
  if (!KINDS.has(kind) || !codeCoopname || !ref) return null;
  return { kind: kind as MarketplaceHandoffCodeKind, coopname: codeCoopname, ref };
}

/** Строка без разделителя: временный код, код бокса с этикетки либо логин. */
function parseBare(value: string, coopname: string): MarketplaceHandoffCode | null {
  const token = normalizeToken(value);
  if (token) return { kind: 'token', coopname, ref: token };
  if (CONTAINER_CODE_RE.test(value)) {
    return { kind: MarketplaceHandoffCodeKind.Container, coopname, ref: value.toUpperCase() };
  }
  if (ACCOUNT_NAME_RE.test(value)) {
    return { kind: 'login', coopname, ref: value };
  }
  return null;
}
