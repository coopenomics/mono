/**
 * Универсальный optimistic-overlay для program_wallets.
 *
 * Любая фича, инициирующая движение денег между кошельками (инвестиция, вывод,
 * перевод и т.п.), синхронно описывает, на сколько и в каких кошельках
 * изменяется `available`. Стор моментально отражает изменение в UI
 * через overlay поверх серверной правды; при следующем `loadUserWallet`
 * сервер-снимок выигрывает и overlay сбрасывается.
 *
 * Если мутация упала или дельта-сихнхрон не догнал за TTL — патч откатывается
 * автоматически.
 *
 * В будущем механизм заменится на push-подписку на дельты ledger2 — фичи
 * не изменятся, изменится источник «правды» и TTL.
 */

export interface IWalletPatchEntry {
  /** Если не задан — патч применяется ко всем username в сторе. */
  username?: string;
  /** Альтернативно: matched по program_type ('wallet' | 'capital' | ...). */
  program_type?: string;
  /** Альтернативно: matched по program_id (число). */
  program_id?: number | string;
  /** Дельта `available` как asset-строка ("-50.0000 RUB" или "50.0000 RUB"). */
  available_delta?: string;
}

export interface IWalletPatch {
  id: string;
  entries: IWalletPatchEntry[];
  appliedAt: number;
  ttlMs: number;
}

interface IParsedAsset {
  raw: bigint;
  decimals: number;
  symbol: string;
}

function parseAsset(asset: string): IParsedAsset {
  const trimmed = asset.trim();
  const negative = trimmed.startsWith('-');
  const positive = trimmed.startsWith('+');
  const body = negative || positive ? trimmed.slice(1).trim() : trimmed;
  const [amountPart, symbol] = body.split(/\s+/);
  if (!amountPart || !symbol) {
    throw new Error(`Не удалось распарсить asset "${asset}"`);
  }
  const [intPart, fracPart = ''] = amountPart.split('.');
  const decimals = fracPart.length;
  const cleanInt = intPart.replace(/[^0-9]/g, '');
  const cleanFrac = fracPart.replace(/[^0-9]/g, '').padEnd(decimals, '0');
  const raw = BigInt(`${cleanInt || '0'}${cleanFrac}`);
  return {
    raw: negative ? -raw : raw,
    decimals,
    symbol,
  };
}

function formatAsset(parsed: IParsedAsset): string {
  const negative = parsed.raw < 0n;
  const absRaw = negative ? -parsed.raw : parsed.raw;
  const factor = 10n ** BigInt(parsed.decimals);
  const intPart = absRaw / factor;
  const fracPart = absRaw % factor;
  const fracStr = parsed.decimals > 0
    ? '.' + fracPart.toString().padStart(parsed.decimals, '0')
    : '';
  const sign = negative ? '-' : '';
  return `${sign}${intPart.toString()}${fracStr} ${parsed.symbol}`;
}

export function applyAssetDelta(asset: string, delta: string): string {
  const a = parseAsset(asset);
  const d = parseAsset(delta);
  if (a.symbol !== d.symbol) {
    throw new Error(`Несовместимые символы asset: "${a.symbol}" vs "${d.symbol}"`);
  }
  const decimals = Math.max(a.decimals, d.decimals);
  const aScale = 10n ** BigInt(decimals - a.decimals);
  const dScale = 10n ** BigInt(decimals - d.decimals);
  const result: IParsedAsset = {
    raw: a.raw * aScale + d.raw * dScale,
    decimals,
    symbol: a.symbol,
  };
  return formatAsset(result);
}

interface IMatchTarget {
  username?: string;
  program_type?: string;
  program_id?: number | string;
}

export function matchesEntry<
  T extends { username?: string; program_type?: string; program_id?: number | string },
>(item: T, entry: IMatchTarget): boolean {
  if (entry.username !== undefined && item.username !== entry.username) return false;
  if (entry.program_type !== undefined && item.program_type !== entry.program_type) return false;
  if (entry.program_id !== undefined && String(item.program_id) !== String(entry.program_id)) return false;
  return true;
}

let nextId = 0;
export function generatePatchId(): string {
  nextId += 1;
  return `wp_${Date.now().toString(36)}_${nextId.toString(36)}`;
}
