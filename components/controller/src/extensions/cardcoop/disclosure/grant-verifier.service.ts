/**
 * Проверка гранта раскрытия ключом card.coop (story 7.8, FR-F3).
 *
 * Ключ берётся из JWKS сети и кэшируется. Кэш здесь не про скорость: без него каждый запрос
 * анкеты означал бы поход в сеть, и card.coop оказался бы в критическом пути обмена, который
 * задуман идущим мимо него. Незнакомый отпечаток ключа кэш обходит — так ротация ключа
 * подхватывается первым же грантом, подписанным новым ключом, без простоя и перенастройки.
 *
 * Причина отказа наружу не выходит. Ответить «у нас такого пайщика нет» значит рассказать
 * чужому о членстве человека — ровно то, что сеть запрещает (архитектура §8). Поэтому
 * причина пишется в журнал, а предъявителю достаётся один и тот же отказ.
 */
import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import {
  grantRejectionReason,
  grantSignatureMatches,
  parseGrant,
  type CardcoopGrantClaims,
  type CardcoopGrantJwk,
} from './grant';

/** Сколько держать прочитанный набор ключей. */
const JWKS_CACHE_MS = 5 * 60 * 1000;

/** Сколько ждать ответа JWKS: сеть в критическом пути обмена, и висеть на ней нельзя. */
const JWKS_TIMEOUT_MS = 5_000;

/**
 * Грант не принят.
 *
 * Причина внутри — для журнала кооператива; наружу уходит один и тот же отказ.
 */
export class CardcoopGrantRejected extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'CardcoopGrantRejected';
  }
}

@Injectable()
export class CardcoopGrantVerifier {
  private cached: { keys: CardcoopGrantJwk[]; readAt: number } | null = null;

  constructor(@Inject(LOGGER_PORT) private readonly logger: ILoggerPort) {
    this.logger.setContext(CardcoopGrantVerifier.name);
  }

  /**
   * Проверяет грант и возвращает то, что в нём сказано.
   *
   * @param apiUrl — адрес узла сети из конфигурации расширения.
   * @param grant — compact JWS, предъявленный кооперативом-получателем.
   * @returns Утверждения гранта.
   * @throws CardcoopGrantRejected Если грант не разбирается, не про нас, просрочен либо
   *   подписан не ключом сети.
   */
  async verify(apiUrl: string, grant: string): Promise<CardcoopGrantClaims> {
    const parts = parseGrant(grant);
    if (!parts) throw new CardcoopGrantRejected('грант не разбирается либо предъявлен документ другого вида');

    const reason = grantRejectionReason(parts.claims, platformSettings().coopname, Math.floor(Date.now() / 1000));
    if (reason) throw new CardcoopGrantRejected(reason);

    if (await this.signedByNetwork(apiUrl, parts.kid, (jwk) => grantSignatureMatches(parts, jwk))) {
      return parts.claims;
    }

    throw new CardcoopGrantRejected('подпись гранта не сходится с ключом сети');
  }

  /**
   * Сходится ли подпись хоть с одним из опубликованных ключей сети.
   *
   * Незнакомый отпечаток — повод перечитать набор, а не отказать: ключи меняются, и первый
   * грант, подписанный новым ключом, приходит раньше, чем истекает кэш.
   *
   * @param apiUrl — адрес узла сети.
   * @param kid — отпечаток ключа из заголовка гранта; `null` — заголовок его не назвал.
   * @param matches — проверка подписи конкретным ключом.
   */
  private async signedByNetwork(
    apiUrl: string,
    kid: string | null,
    matches: (jwk: CardcoopGrantJwk) => boolean
  ): Promise<boolean> {
    const cached = await this.keys(apiUrl, false);
    if (selectKeys(cached, kid).some(matches)) return true;

    if (kid !== null && cached.some((key) => key.kid === kid)) return false;

    const fresh = await this.keys(apiUrl, true);
    return selectKeys(fresh, kid).some(matches);
  }

  /**
   * Набор ключей сети.
   *
   * Недоступность JWKS не роняет запрос исключением: она означает ровно «проверить нечем», и
   * дальше это станет обычным отказом. Пустой набор в кэш не кладём — иначе одна неудачная
   * минута выключила бы раскрытия на пять.
   *
   * @param apiUrl — адрес узла сети.
   * @param fresh — читать мимо кэша.
   */
  private async keys(apiUrl: string, fresh: boolean): Promise<CardcoopGrantJwk[]> {
    if (!fresh && this.cached && Date.now() - this.cached.readAt < JWKS_CACHE_MS) return this.cached.keys;

    const keys = await this.fetchKeys(apiUrl);
    if (keys.length > 0) this.cached = { keys, readAt: Date.now() };

    return keys;
  }

  /** Читает JWKS сети; любая неудача — пустой набор и запись в журнал. */
  private async fetchKeys(apiUrl: string): Promise<CardcoopGrantJwk[]> {
    const url = `${apiUrl.replace(/\/+$/, '')}/v1/disclosures/jwks`;

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(JWKS_TIMEOUT_MS) });
      if (!response.ok) {
        this.logger.error(`Ключи сети карт не прочитаны: ${url} ответил ${response.status}`);
        return [];
      }

      return readJwks(await response.json());
    } catch (error) {
      this.logger.error(
        `Ключи сети карт не прочитаны: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }
}

/** Ключи, которыми имеет смысл проверять этот грант. */
function selectKeys(keys: CardcoopGrantJwk[], kid: string | null): CardcoopGrantJwk[] {
  if (kid === null) return keys;

  const named = keys.filter((key) => key.kid === kid);
  return named.length > 0 ? named : keys;
}

/** Разбирает тело JWKS; всё, что не похоже на ключ secp256k1, отбрасывается. */
function readJwks(body: unknown): CardcoopGrantJwk[] {
  if (typeof body !== 'object' || body === null) return [];

  const keys = (body as { keys?: unknown }).keys;
  if (!Array.isArray(keys)) return [];

  return keys.filter(isGrantJwk);
}

/** Похоже ли это на открытый ключ secp256k1 в форме JWK. */
function isGrantJwk(value: unknown): value is CardcoopGrantJwk {
  if (typeof value !== 'object' || value === null) return false;

  const jwk = value as Record<string, unknown>;
  return jwk.kty === 'EC' && jwk.crv === 'secp256k1' && typeof jwk.x === 'string' && typeof jwk.y === 'string';
}
